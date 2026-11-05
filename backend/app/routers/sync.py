from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import require_admin
from app.db.session import get_db
from app.models.entities import SyncLog, SyncState
from app.services.sync import run_sync

router = APIRouter(prefix="/api/sync", tags=["sincronização"],
                   dependencies=[Depends(require_admin)])


@router.post("/run")
def trigger_sync(target: str | None = None, dry_run: bool | None = None,
                 db: Session = Depends(get_db)):
    """Dispara a sincronização manualmente. `dry_run` omitido usa SYNC_DRY_RUN do .env."""
    return run_sync(db, only_target=target, dry_run=dry_run)


@router.get("/status")
def status(db: Session = Depends(get_db)):
    rows = db.scalars(select(SyncState).order_by(SyncState.id.desc()).limit(200)).all()
    return [
        {"entity": r.entity_type, "local_id": r.local_id, "remote_id": r.remote_id,
         "status": r.status, "error": r.last_error, "last_synced_at": r.last_synced_at}
        for r in rows
    ]


@router.get("/log")
def log(limit: int = 100, db: Session = Depends(get_db)):
    rows = db.scalars(select(SyncLog).order_by(SyncLog.id.desc()).limit(limit)).all()
    return [
        {"at": r.created_at, "entity": r.entity_type, "local_id": r.local_id,
         "method": r.method, "http": r.http_status, "dry_run": r.dry_run, "msg": r.message}
        for r in rows
    ]
