"""Cria o usuário admin e dados de exemplo.

Uso (dentro de backend/):
  ADMIN_EMAIL=voce@exemplo.com ADMIN_PASSWORD='senha-forte' python -m scripts.seed
"""
import os
import sys
from datetime import datetime, timedelta

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.cms import Event, EventOccurrence, User
from app.models.entities import Agent, Space


def main() -> None:
    email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    password = os.environ.get("ADMIN_PASSWORD", "")
    if not email or len(password) < 10:
        sys.exit("Defina ADMIN_EMAIL e ADMIN_PASSWORD (mín. 10 caracteres).")

    with SessionLocal() as db:
        if db.scalar(select(User).where(User.email == email)):
            sys.exit("Esse admin já existe.")
        admin = User(email=email, password_hash=hash_password(password), role="admin")
        db.add(admin)
        db.flush()

        if os.environ.get("SEED_SAMPLE", "1") == "1":
            ag = Agent(user_id=admin.id, name="Coletivo Exemplo", type=2,
                       short_description="Agente de exemplo — apague depois.",
                       latitude=-3.9014, longitude=-38.3892)
            db.add(ag)
            db.flush()
            sp = Space(agent_id=ag.id, type=1, name="Casa de Cultura (exemplo)",
                       short_description="Espaço de exemplo.",
                       latitude=-3.9020, longitude=-38.3880)
            db.add(sp)
            db.flush()
            ev = Event(agent_id=ag.id, name="Sarau de Exemplo",
                       short_description="Evento de exemplo.")
            start = datetime.now() + timedelta(days=7)
            ev.occurrences.append(EventOccurrence(
                space_id=sp.id, starts_at=start, ends_at=start + timedelta(hours=3),
                starts_on=start.date(), ends_on=start.date()))
            db.add(ev)

        db.commit()
        print(f"Admin criado: {email}")


if __name__ == "__main__":
    main()
