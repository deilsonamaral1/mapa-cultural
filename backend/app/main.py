from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.routers import auth, content, public
from app.routers import sync as sync_router
from app.services.sync import run_sync

settings = get_settings()

app = FastAPI(title="Mapa Cultural Municipal – API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(public.router)
app.include_router(auth.router)
app.include_router(content.agents)
app.include_router(content.spaces)
app.include_router(content.events)
app.include_router(sync_router.router)


def _scheduled_sync() -> None:
    with SessionLocal() as db:
        run_sync(db)


@app.on_event("startup")
def start_scheduler() -> None:
    scheduler = BackgroundScheduler(timezone="America/Fortaleza")
    scheduler.add_job(_scheduled_sync, "interval", minutes=settings.sync_interval_minutes,
                      max_instances=1, coalesce=True)
    scheduler.start()


@app.get("/health")
def health():
    return {"ok": True}
