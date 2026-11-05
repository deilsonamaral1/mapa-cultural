"""Converte registros locais no payload JSON esperado pela API do Mapas Culturais.

Os nomes de campo da API do Mapas usam camelCase (shortDescription, longDescription).
O formato de `location` e dos metadados pode variar por versão: valide com um
GET /api/agent/find numa instância de teste antes de ligar o envio real.
"""
import hashlib
import json

from app.core.meta_keys import AGENT_META_KEYS, SPACE_META_KEYS
from app.models.entities import Agent, Space


def _location(obj) -> dict | None:
    if obj.latitude is None or obj.longitude is None:
        return None
    return {"latitude": obj.latitude, "longitude": obj.longitude}


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
        "public": s.public,
        "owner": owner_remote_id,  # agente responsável precisa existir na instância destino
        **_meta(s, SPACE_META_KEYS),
    }
    return {k: v for k, v in payload.items() if v is not None}


def content_hash(payload: dict) -> str:
    """Hash estável: só reenviamos quando o conteúdo realmente mudou."""
    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()
