"""CRUD autenticado de Agentes, Espaços e Eventos.

Regras de permissão:
- admin: vê e altera tudo; o status que enviar é respeitado (pode publicar direto).
- agent (cadastro público): vê e altera só o que é seu (agente dele, e espaços/eventos
  ligados aos agentes dele). Tudo que cria ou edita volta para PENDENTE (status 0) e só
  aparece no mapa e na sincronização depois que um administrador aprovar.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.meta_keys import AGENT_META_KEYS, MAX_META_VALUE_LEN, SPACE_META_KEYS
from app.core.security import current_user
from app.db.session import get_db
from app.models.cms import Event, EventOccurrence, User
from app.models.entities import Agent, AgentMeta, Space, SpaceMeta

STATUS_TRASH = -1
STATUS_PENDING = 0
STATUS_PUBLISHED = 1


# ---------- schemas ----------
class AgentIn(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    type: int = 1
    short_description: str | None = None
    long_description: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    public_location: bool = True
    status: int = 1
    meta: dict[str, str | None] = {}


class SpaceIn(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    type: int = 1
    agent_id: int
    short_description: str | None = None
    long_description: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    public: bool = True
    status: int = 1
    meta: dict[str, str | None] = {}


class EventIn(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    type: int = 1
    agent_id: int
    short_description: str | None = None
    long_description: str | None = None
    rules: str | None = None
    status: int = 1
    # uma ocorrência simples (a tabela suporta várias; o painel edita a primeira)
    space_id: int | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None


# ---------- permissões ----------
def is_admin(user: User) -> bool:
    return user.role == "admin"


def _my_agent_ids(db: Session, user: User) -> set[int]:
    return set(db.scalars(
        select(Agent.id).where(Agent.user_id == user.id, Agent.status != STATUS_TRASH)))


def _forbid() -> None:
    raise HTTPException(403, "Você só pode alterar os seus próprios cadastros")


def _require_own_agent(db: Session, user: User, agent_id: int) -> None:
    if not is_admin(user) and agent_id not in _my_agent_ids(db, user):
        raise HTTPException(403, "Escolha um agente que seja seu")


def _status_for(user: User, requested: int) -> int:
    """Não-admin nunca publica: sempre pendente de aprovação."""
    return requested if is_admin(user) else STATUS_PENDING


# ---------- helpers ----------
def _clean_meta(meta: dict, allowed: frozenset) -> dict:
    unknown = set(meta) - allowed
    if unknown:
        raise HTTPException(422, f"Campos não permitidos: {', '.join(sorted(unknown))}")
    for k, v in meta.items():
        if v is not None and len(v) > MAX_META_VALUE_LEN:
            raise HTTPException(422, f"'{k}' excede {MAX_META_VALUE_LEN} caracteres")
    return meta


def _set_meta(obj, meta_cls, meta: dict) -> None:
    existing = {m.key: m for m in obj.meta}
    for key, value in meta.items():
        if key in existing:
            existing[key].value = value
        else:
            obj.meta.append(meta_cls(key=key, value=value))


def _geo_dict(o) -> dict:
    return {"latitude": o.latitude, "longitude": o.longitude}


def agent_dict(a: Agent) -> dict:
    return {"id": a.id, "name": a.name, "type": a.type, "status": a.status,
            "short_description": a.short_description, "long_description": a.long_description,
            "public_location": a.public_location, **_geo_dict(a),
            "meta": {m.key: m.value for m in a.meta}}


def space_dict(s: Space) -> dict:
    return {"id": s.id, "name": s.name, "type": s.type, "status": s.status,
            "agent_id": s.agent_id, "short_description": s.short_description,
            "long_description": s.long_description, "public": s.public, **_geo_dict(s),
            "meta": {m.key: m.value for m in s.meta}}


def event_dict(e: Event) -> dict:
    occ = e.occurrences[0] if e.occurrences else None
    return {"id": e.id, "name": e.name, "type": e.type, "status": e.status,
            "agent_id": e.agent_id, "short_description": e.short_description,
            "long_description": e.long_description, "rules": e.rules,
            "space_id": occ.space_id if occ else None,
            "starts_at": occ.starts_at.isoformat() if occ and occ.starts_at else None,
            "ends_at": occ.ends_at.isoformat() if occ and occ.ends_at else None}


def _get_or_404(db: Session, model, obj_id: int):
    obj = db.get(model, obj_id)
    if not obj or obj.status == STATUS_TRASH:
        raise HTTPException(404, "Não encontrado")
    return obj


def _check_exists(db: Session, model, obj_id: int | None, label: str) -> None:
    if obj_id is not None and not db.get(model, obj_id):
        raise HTTPException(422, f"{label} {obj_id} não existe")


# ---------- agentes ----------
agents = APIRouter(prefix="/api/agents", tags=["agentes"])


@agents.get("")
def list_agents(db: Session = Depends(get_db), user: User = Depends(current_user)):
    stmt = select(Agent).where(Agent.status != STATUS_TRASH)
    if not is_admin(user):
        stmt = stmt.where(Agent.user_id == user.id)
    return [agent_dict(a) for a in db.scalars(stmt.order_by(Agent.name))]


@agents.post("", status_code=201)
def create_agent(data: AgentIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    meta = _clean_meta(data.meta, AGENT_META_KEYS)
    fields = data.model_dump(exclude={"meta", "status"})
    a = Agent(user_id=user.id, status=_status_for(user, data.status), **fields)
    _set_meta(a, AgentMeta, meta)
    db.add(a)
    db.commit()
    return agent_dict(a)


@agents.put("/{agent_id}")
def update_agent(agent_id: int, data: AgentIn, db: Session = Depends(get_db),
                 user: User = Depends(current_user)):
    a = _get_or_404(db, Agent, agent_id)
    if not is_admin(user) and a.user_id != user.id:
        _forbid()
    meta = _clean_meta(data.meta, AGENT_META_KEYS)
    for k, v in data.model_dump(exclude={"meta", "status"}).items():
        setattr(a, k, v)
    a.status = _status_for(user, data.status)
    _set_meta(a, AgentMeta, meta)
    db.commit()
    return agent_dict(a)


@agents.delete("/{agent_id}", status_code=204)
def delete_agent(agent_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    a = _get_or_404(db, Agent, agent_id)
    if not is_admin(user) and a.user_id != user.id:
        _forbid()
    a.status = STATUS_TRASH  # lixeira, como no Mapas
    db.commit()


# ---------- espaços ----------
spaces = APIRouter(prefix="/api/spaces", tags=["espaços"])


@spaces.get("")
def list_spaces(db: Session = Depends(get_db), user: User = Depends(current_user)):
    stmt = select(Space).where(Space.status != STATUS_TRASH)
    if not is_admin(user):
        stmt = stmt.where(Space.agent_id.in_(_my_agent_ids(db, user)))
    return [space_dict(s) for s in db.scalars(stmt.order_by(Space.name))]


@spaces.post("", status_code=201)
def create_space(data: SpaceIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    _check_exists(db, Agent, data.agent_id, "Agente")
    _require_own_agent(db, user, data.agent_id)
    meta = _clean_meta(data.meta, SPACE_META_KEYS)
    s = Space(status=_status_for(user, data.status),
              **data.model_dump(exclude={"meta", "status"}))
    _set_meta(s, SpaceMeta, meta)
    db.add(s)
    db.commit()
    return space_dict(s)


@spaces.put("/{space_id}")
def update_space(space_id: int, data: SpaceIn, db: Session = Depends(get_db),
                 user: User = Depends(current_user)):
    s = _get_or_404(db, Space, space_id)
    _check_exists(db, Agent, data.agent_id, "Agente")
    if not is_admin(user) and s.agent_id not in _my_agent_ids(db, user):
        _forbid()
    _require_own_agent(db, user, data.agent_id)
    meta = _clean_meta(data.meta, SPACE_META_KEYS)
    for k, v in data.model_dump(exclude={"meta", "status"}).items():
        setattr(s, k, v)
    s.status = _status_for(user, data.status)
    _set_meta(s, SpaceMeta, meta)
    db.commit()
    return space_dict(s)


@spaces.delete("/{space_id}", status_code=204)
def delete_space(space_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    s = _get_or_404(db, Space, space_id)
    if not is_admin(user) and s.agent_id not in _my_agent_ids(db, user):
        _forbid()
    s.status = STATUS_TRASH
    db.commit()


# ---------- eventos ----------
events = APIRouter(prefix="/api/events", tags=["eventos"])


def _apply_event(db: Session, user: User, e: Event, data: EventIn) -> None:
    _check_exists(db, Agent, data.agent_id, "Agente")
    _require_own_agent(db, user, data.agent_id)
    _check_exists(db, Space, data.space_id, "Espaço")
    if data.space_id is not None and not is_admin(user):
        # o evento pode acontecer em espaço publicado de qualquer pessoa ou em espaço próprio
        sp = db.get(Space, data.space_id)
        if sp.status != STATUS_PUBLISHED and sp.agent_id not in _my_agent_ids(db, user):
            raise HTTPException(422, "Espaço indisponível")
    if data.starts_at and data.ends_at and data.ends_at < data.starts_at:
        raise HTTPException(422, "O fim não pode ser anterior ao início")
    for k, v in data.model_dump(exclude={"space_id", "starts_at", "ends_at", "status"}).items():
        setattr(e, k, v)
    e.status = _status_for(user, data.status)
    if data.space_id is None:
        return
    occ = e.occurrences[0] if e.occurrences else None
    if occ is None:
        occ = EventOccurrence(space_id=data.space_id)
        e.occurrences.append(occ)
    occ.space_id = data.space_id
    occ.starts_at, occ.ends_at = data.starts_at, data.ends_at
    occ.starts_on = data.starts_at.date() if data.starts_at else None
    occ.ends_on = data.ends_at.date() if data.ends_at else None


@events.get("")
def list_events(db: Session = Depends(get_db), user: User = Depends(current_user)):
    stmt = select(Event).where(Event.status != STATUS_TRASH)
    if not is_admin(user):
        stmt = stmt.where(Event.agent_id.in_(_my_agent_ids(db, user)))
    return [event_dict(e) for e in db.scalars(stmt.order_by(Event.name))]


@events.post("", status_code=201)
def create_event(data: EventIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    e = Event(agent_id=data.agent_id, name=data.name)
    _apply_event(db, user, e, data)
    db.add(e)
    db.commit()
    return event_dict(e)


@events.put("/{event_id}")
def update_event(event_id: int, data: EventIn, db: Session = Depends(get_db),
                 user: User = Depends(current_user)):
    e = _get_or_404(db, Event, event_id)
    if not is_admin(user) and e.agent_id not in _my_agent_ids(db, user):
        _forbid()
    _apply_event(db, user, e, data)
    db.commit()
    return event_dict(e)


@events.delete("/{event_id}", status_code=204)
def delete_event(event_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    e = _get_or_404(db, Event, event_id)
    if not is_admin(user) and e.agent_id not in _my_agent_ids(db, user):
        _forbid()
    e.status = STATUS_TRASH
    db.commit()
