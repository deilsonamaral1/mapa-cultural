"""Endpoints PÚBLICOS (sem login) que alimentam o mapa e a busca do site."""
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.cms import Event
from app.models.entities import Agent, Space

router = APIRouter(prefix="/api/public", tags=["público"])


def _like(q: str) -> str:
    # escapa curingas do LIKE para a busca ser literal
    return "%" + q.replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_") + "%"


@router.get("/search")
def search(
    type: Literal["agent", "space", "event"] = "agent",
    q: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(get_db),
):
    if type == "agent":
        stmt = select(Agent).where(Agent.status == 1)
        if q:
            stmt = stmt.where(Agent.name.ilike(_like(q), escape="\\"))
        return [
            {"id": a.id, "name": a.name, "type": a.type,
             "description": a.short_description,
             # respeita "localização pública" do agente
             "latitude": a.latitude if a.public_location else None,
             "longitude": a.longitude if a.public_location else None}
            for a in db.scalars(stmt.order_by(Agent.name).limit(limit))
        ]

    if type == "space":
        stmt = select(Space).where(Space.status == 1, Space.public.is_(True))
        if q:
            stmt = stmt.where(Space.name.ilike(_like(q), escape="\\"))
        return [
            {"id": s.id, "name": s.name, "type": s.type, "description": s.short_description,
             "latitude": s.latitude, "longitude": s.longitude}
            for s in db.scalars(stmt.order_by(Space.name).limit(limit))
        ]

    stmt = select(Event).where(Event.status == 1)
    if q:
        stmt = stmt.where(Event.name.ilike(_like(q), escape="\\"))
    out = []
    for e in db.scalars(stmt.limit(limit)):
        occ = e.occurrences[0] if e.occurrences else None
        space = db.get(Space, occ.space_id) if occ else None
        # esconde eventos que já terminaram
        if occ and occ.ends_at and occ.ends_at < datetime.now():
            continue
        out.append({
            "id": e.id, "name": e.name, "type": e.type, "description": e.short_description,
            "starts_at": occ.starts_at.isoformat() if occ and occ.starts_at else None,
            "place": space.name if space else None,
            "latitude": space.latitude if space and space.public else None,
            "longitude": space.longitude if space and space.public else None,
        })
    return sorted(out, key=lambda x: x["starts_at"] or "9999")
