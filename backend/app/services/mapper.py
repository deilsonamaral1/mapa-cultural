"""Converte registros locais no payload esperado pela API do Mapas Culturais.

Formato conforme o repositório de referência (secultce/mapacultural):
- campos em camelCase (shortDescription, longDescription, publicLocation);
- `location` é uma lista [longitude, latitude] (strings), NÃO um objeto;
- `owner` é o id do agente dono (usado por espaços e eventos);
- shortDescription é obrigatória e tem no máximo 400 caracteres (agente, espaço e evento);
- `type` é obrigatório para agente e espaço.
"""
import hashlib
import json

from app.core.meta_keys import AGENT_META_KEYS, SPACE_META_KEYS
from app.models.entities import Agent, Space

SHORT_DESCRIPTION_MAX = 400


def _location(obj) -> list[str] | None:
    if obj.latitude is None or obj.longitude is None:
        return None
    return [str(obj.longitude), str(obj.latitude)]  # ordem do Mapas: [lng, lat]


def _meta(obj, allowed: frozenset) -> dict:
    # só chaves da lista permitida seguem para a instância oficial
    return {m.key: m.value for m in obj.meta
            if m.key in allowed and m.value not in (None, "")}


def agent_payload(a: Agent) -> dict:
    payload = {
        "name": a.name,
        "type": a.type,
        "shortDescription": a.short_description,
        "longDescription": a.long_description,
        "location": _location(a),
        "publicLocation": a.public_location,
        **_meta(a, AGENT_META_KEYS),
    }
    return {k: v for k, v in payload.items() if v is not None}


def space_payload(s: Space, owner_remote_id: int | None) -> dict:
    payload = {
        "name": s.name,
        "type": s.type,
        "shortDescription": s.short_description,
        "longDescription": s.long_description,
        "location": _location(s),
        "public": s.public,  # no Mapas: "qualquer agente pode cadastrar eventos neste espaço"
        "owner": owner_remote_id,  # agente responsável precisa existir na instância destino
        **_meta(s, SPACE_META_KEYS),
    }
    return {k: v for k, v in payload.items() if v is not None}


def missing_fields(entity: str, payload: dict) -> list[str]:
    """O que a validação do Mapas recusaria. Evita enviar requisições que vão falhar."""
    problems = []
    if not payload.get("name"):
        problems.append("name")
    desc = payload.get("shortDescription")
    if not desc:
        problems.append("shortDescription (obrigatória)")
    elif len(desc) > SHORT_DESCRIPTION_MAX:
        problems.append(f"shortDescription (máx. {SHORT_DESCRIPTION_MAX} caracteres)")
    if entity in ("agent", "space"):
        if not payload.get("type"):
            problems.append("type")
        if not payload.get("location"):
            problems.append("location (obrigatória)")
    return problems


def content_hash(payload: dict) -> str:
    """Hash estável: só reenviamos quando o conteúdo realmente mudou."""
    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()
