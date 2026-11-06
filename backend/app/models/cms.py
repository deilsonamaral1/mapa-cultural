"""Usuários do painel, eventos e ocorrências."""
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class User(Base):
    __tablename__ = "app_user"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(32), default="editor")  # admin | editor
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Event(Base):
    __tablename__ = "event"

    id: Mapped[int] = mapped_column(primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agent.id"))
    type: Mapped[int] = mapped_column(SmallInteger, default=1)
    name: Mapped[str] = mapped_column(String(255))
    short_description: Mapped[str | None] = mapped_column(Text)
    long_description: Mapped[str | None] = mapped_column(Text)
    rules: Mapped[str | None] = mapped_column(Text)
    create_timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    update_timestamp: Mapped[datetime | None] = mapped_column(DateTime, onupdate=datetime.utcnow)
    status: Mapped[int] = mapped_column(SmallInteger, default=1)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    occurrences: Mapped[list["EventOccurrence"]] = relationship(
        cascade="all, delete-orphan", order_by="EventOccurrence.starts_at")


class EventOccurrence(Base):
    __tablename__ = "event_occurrence"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("event.id", ondelete="CASCADE"))
    space_id: Mapped[int] = mapped_column(ForeignKey("space.id"))
    starts_on: Mapped[date | None] = mapped_column(Date)
    ends_on: Mapped[date | None] = mapped_column(Date)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime)
    frequency: Mapped[str | None] = mapped_column(String(32))
    timezone_name: Mapped[str] = mapped_column(String(64), default="America/Fortaleza")
    # colunas do event_occurrence do Mapas Culturais; `rule` guarda o JSON da regra de recorrência
    separation: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    count: Mapped[int | None] = mapped_column(Integer)
    until: Mapped[date | None] = mapped_column(Date)
    description: Mapped[str | None] = mapped_column(Text)
    price: Mapped[str | None] = mapped_column(Text)
    price_info: Mapped[str | None] = mapped_column("priceInfo", Text)
    rule: Mapped[str] = mapped_column(Text, default="", server_default="")
    status: Mapped[int] = mapped_column(SmallInteger, default=1)
