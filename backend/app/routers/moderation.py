"""Fila de moderação (somente administradores)."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import require_admin
from app.db.session import get_db
from app.models.cms import Event, User
from app.models.entities import Agent, Space
from app.routers.content import (
    STATUS_PENDING, STATUS_PUBLISHED, STATUS_TRASH, agent_dict, event_dict, publish_problems,
    space_dict,
)

router = APIRouter(prefix="/api/moderation", tags=["moderação"],
                   dependencies=[Depends(require_admin)])

MODELS = {"agents": Agent, "spaces": Space, "events": Event}


@router.get("/pending")
def pending(db: Session = Depends(get_db)):
    def owner_email(user_id: int) -> str | None:
        u = db.get(User, user_id)
        return u.email if u else None

    ags = db.scalars(select(Agent).where(Agent.status == STATUS_PENDING).order_by(Agent.id))
    sps = db.scalars(select(Space).where(Space.status == STATUS_PENDING).order_by(Space.id))
    evs = db.scalars(select(Event).where(Event.status == STATUS_PENDING).order_by(Event.id))
    return {
        "agents": [{**agent_dict(a), "owner_email": owner_email(a.user_id)} for a in ags],
        "spaces": [space_dict(s) for s in sps],
        "events": [event_dict(e) for e in evs],
    }


@router.post("/{kind}/{item_id}/{action}")
def decide(kind: Literal["agents", "spaces", "events"], item_id: int,
           action: Literal["approve", "reject"], db: Session = Depends(get_db)):
    obj = db.get(MODELS[kind], item_id)
    if not obj or obj.status == STATUS_TRASH:
        raise HTTPException(404, "Não encontrado")

    if action == "approve":
        # espaço/evento só vai ao ar se o agente responsável já estiver publicado
        if kind != "agents":
            parent = db.get(Agent, obj.agent_id)
            if not parent or parent.status != STATUS_PUBLISHED:
                raise HTTPException(422, "Aprove primeiro o agente responsável")
        # o Mapas exige descrição curta (e localização, para agente/espaço): sem isso o envio falharia
        missing = publish_problems(obj.short_description, getattr(obj, "latitude", None),
                                   getattr(obj, "longitude", None),
                                   needs_location=kind != "events")
        if missing:
            raise HTTPException(422, "Cadastro incompleto. Falta: " + ", ".join(missing))
        obj.status = STATUS_PUBLISHED
    else:
        obj.status = STATUS_TRASH
    db.commit()
    return {"id": item_id, "status": obj.status}
