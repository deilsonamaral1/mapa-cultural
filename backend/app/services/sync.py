"""Orquestra o envio (push) de agentes e espaços do painel para as instâncias configuradas.

Ordem importa: agentes primeiro (espaços referenciam o agente responsável).
Idempotência: sync_state guarda remote_id + hash do último payload enviado.
Segurança: SYNC_DRY_RUN=true (padrão) apenas registra o que SERIA enviado.
"""
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.entities import Agent, Space, SyncLog, SyncState, SyncTarget
from app.services.mapas_client import MapasClient
from app.services.mapper import agent_payload, content_hash, space_payload


@dataclass
class SyncReport:
    target: str
    created: int = 0
    updated: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)
    dry_run: bool = True


def _get_target(db: Session, name: str, base_url: str) -> SyncTarget:
    t = db.scalar(select(SyncTarget).where(SyncTarget.name == name))
    if not t:
        t = SyncTarget(name=name, base_url=base_url, enabled=True)
        db.add(t)
        db.flush()
    return t


def _state(db: Session, target_id: int, entity: str, local_id: int) -> SyncState:
    st = db.scalar(select(SyncState).where(
        SyncState.target_id == target_id,
        SyncState.entity_type == entity,
        SyncState.local_id == local_id,
    ))
    if not st:
        st = SyncState(target_id=target_id, entity_type=entity, local_id=local_id)
        db.add(st)
        db.flush()
    return st


def _push_one(db: Session, client: MapasClient, target: SyncTarget, entity: str,
              local_id: int, payload: dict, dry_run: bool, report: SyncReport) -> None:
    st = _state(db, target.id, entity, local_id)
    h = content_hash(payload)

    if st.status == "synced" and st.content_hash == h:
        report.skipped += 1
        return

    method = "PUT" if st.remote_id else "POST"

    if dry_run:
        db.add(SyncLog(target_id=target.id, entity_type=entity, local_id=local_id,
                       method=method, dry_run=True, message=f"DRY-RUN payload={payload}"))
        report.skipped += 1
        return

    try:
        res = (client.update(entity, st.remote_id, payload) if st.remote_id
               else client.create(entity, payload))
        db.add(SyncLog(target_id=target.id, entity_type=entity, local_id=local_id,
                       method=method, http_status=res.status_code, dry_run=False))

        if res.status_code in (200, 201) and isinstance(res.body, dict):
            st.remote_id = st.remote_id or res.body.get("id")
            st.content_hash, st.status, st.last_error = h, "synced", None
            st.last_synced_at = datetime.utcnow()
            report.updated += method == "PUT"
            report.created += method == "POST"
        else:
            st.status, st.last_error = "error", f"HTTP {res.status_code}: {str(res.body)[:500]}"
            report.errors.append(f"{entity}#{local_id}: {st.last_error}")
    except Exception as exc:  # noqa: BLE001 - registramos e seguimos para o próximo item
        st.status, st.last_error = "error", str(exc)
        report.errors.append(f"{entity}#{local_id}: {exc}")


def run_sync(db: Session, only_target: str | None = None,
             dry_run: bool | None = None) -> list[SyncReport]:
    settings = get_settings()
    dry = settings.sync_dry_run if dry_run is None else dry_run
    reports: list[SyncReport] = []

    for name, cfg in settings.targets().items():
        if only_target and name != only_target:
            continue
        target = _get_target(db, name, cfg["base_url"])
        client = MapasClient(cfg["base_url"], cfg["token"], target.auth_mode)
        report = SyncReport(target=name, dry_run=dry)

        try:
            # 1) Agentes publicados
            for agent in db.scalars(select(Agent).where(Agent.status == 1)):
                _push_one(db, client, target, "agent", agent.id,
                          agent_payload(agent), dry, report)

            # 2) Espaços publicados (dependem do remote_id do agente responsável)
            for space in db.scalars(select(Space).where(Space.status == 1)):
                owner_state = db.scalar(select(SyncState).where(
                    SyncState.target_id == target.id,
                    SyncState.entity_type == "agent",
                    SyncState.local_id == space.agent_id,
                ))
                owner_remote = owner_state.remote_id if owner_state else None
                if owner_remote is None and not dry:
                    report.errors.append(
                        f"space#{space.id}: agente responsável ainda não sincronizado")
                    continue
                _push_one(db, client, target, "space", space.id,
                          space_payload(space, owner_remote), dry, report)

            db.commit()
        finally:
            client.close()

        reports.append(report)

    return reports
