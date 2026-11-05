"""CRUD autenticado de Agentes, Espaços e Eventos (painel de administração)."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import current_user
from app.db.session import get_db
from app.models.cms import Event, EventOccurrence, User
from app.models.entities import Agent, AgentMeta, Space, SpaceMeta

STATUS_TRASH = -1


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


# ---------- helpers ----------
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
def list_agents(db: Session = Depends(get_db), _: User = Depends(current_user)):
    rows = db.scalars(select(Agent).where(Agent.status != STATUS_TRASH).order_by(Agent.name))
    return [agent_dict(a) for a in rows]


@agents.post("", status_code=201)
def create_agent(data: AgentIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    a = Agent(user_id=user.id, **data.model_dump(exclude={"meta"}))
    _set_meta(a, AgentMeta, data.meta)
    db.add(a)
    db.commit()
    return agent_dict(a)


@agents.put("/{agent_id}")
def update_agent(agent_id: int, data: AgentIn, db: Session = Depends(get_db),
                 _: User = Depends(current_user)):
    a = _get_or_404(db, Agent, agent_id)
    for k, v in data.model_dump(exclude={"meta"}).items():
        setattr(a, k, v)
    _set_meta(a, AgentMeta, data.meta)
    db.commit()
    return agent_dict(a)


@agents.delete("/{agent_id}", status_code=204)
def delete_agent(agent_id: int, db: Session = Depends(get_db), _: User = Depends(current_user)):
    _get_or_404(db, Agent, agent_id).status = STATUS_TRASH  # lixeira, como no Mapas
    db.commit()


# ---------- espaços ----------
spaces = APIRouter(prefix="/api/spaces", tags=["espaços"])


@spaces.get("")
def list_spaces(db: Session = Depends(get_db), _: User = Depends(current_user)):
    rows = db.scalars(select(Space).where(Space.status != STATUS_TRASH).order_by(Space.name))
    return [space_dict(s) for s in rows]


@spaces.post("", status_code=201)
def create_space(data: SpaceIn, db: Session = Depends(get_db), _: User = Depends(current_user)):
    _check_exists(db, Agent, data.agent_id, "Agente")
    s = Space(**data.model_dump(exclude={"meta"}))
    _set_meta(s, SpaceMeta, data.meta)
    db.add(s)
    db.commit()
    return space_dict(s)


@spaces.put("/{space_id}")
def update_space(space_id: int, data: SpaceIn, db: Session = Depends(get_db),
                 _: User = Depends(current_user)):
    s = _get_or_404(db, Space, space_id)
    _check_exists(db, Agent, data.agent_id, "Agente")
    for k, v in data.model_dump(exclude={"meta"}).items():
        setattr(s, k, v)
    _set_meta(s, SpaceMeta, data.meta)
    db.commit()
    return space_dict(s)


@spaces.delete("/{space_id}", status_code=204)
def delete_space(space_id: int, db: Session = Depends(get_db), _: User = Depends(current_user)):
    _get_or_404(db, Space, space_id).status = STATUS_TRASH
    db.commit()


# ---------- eventos ----------
events = APIRouter(prefix="/api/events", tags=["eventos"])


def _apply_event(db: Session, e: Event, data: EventIn) -> None:
    _check_exists(db, Agent, data.agent_id, "Agente")
    _check_exists(db, Space, data.space_id, "Espaço")
    if data.starts_at and data.ends_at and data.ends_at < data.starts_at:
        raise HTTPException(422, "O fim não pode ser anterior ao início")
    for k, v in data.model_dump(exclude={"space_id", "starts_at", "ends_at"}).items():
        setattr(e, k, v)
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
def list_events(db: Session = Depends(get_db), _: User = Depends(current_user)):
    rows = db.scalars(select(Event).where(Event.status != STATUS_TRASH).order_by(Event.name))
    return [event_dict(e) for e in rows]


@events.post("", status_code=201)
def create_event(data: EventIn, db: Session = Depends(get_db), _: User = Depends(current_user)):
    e = Event(agent_id=data.agent_id, name=data.name)
    _apply_event(db, e, data)
    db.add(e)
    db.commit()
    return event_dict(e)


@events.put("/{event_id}")
def update_event(event_id: int, data: EventIn, db: Session = Depends(get_db),
                 _: User = Depends(current_user)):
    e = _get_or_404(db, Event, event_id)
    _apply_event(db, e, data)
    db.commit()
    return event_dict(e)


@events.delete("/{event_id}", status_code=204)
def delete_event(event_id: int, db: Session = Depends(get_db), _: User = Depends(current_user)):
    _get_or_404(db, Event, event_id).status = STATUS_TRASH
    db.commit()
