"""Modelos ORM espelhando as tabelas agent/space do Mapas Culturais + controle de sync.

Geometria: o Mapas guarda `location` (POINT lng,lat) e `_geo_location` (geography).
Aqui mantemos latitude/longitude explícitas para simplificar o painel e o mapper;
um trigger/serviço preenche `location` e `_geo_location` a partir delas (ver README).
"""
from datetime import datetime

from sqlalchemy import (
    BigInteger, Boolean, DateTime, ForeignKey, Integer, SmallInteger, String, Text,
    UniqueConstraint, Float,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Agent(Base):
    __tablename__ = "agent"

    id: Mapped[int] = mapped_column(primary_key=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("agent.id"))
    user_id: Mapped[int] = mapped_column(Integer, nullable=False)
    type: Mapped[int] = mapped_column(SmallInteger, default=1)  # 1 individual, 2 coletivo
    name: Mapped[str] = mapped_column(String(255))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    short_description: Mapped[str | None] = mapped_column(Text)
    long_description: Mapped[str | None] = mapped_column(Text)
    create_timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    update_timestamp: Mapped[datetime | None] = mapped_column(DateTime, onupdate=datetime.utcnow)
    status: Mapped[int] = mapped_column(SmallInteger, default=1)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    public_location: Mapped[bool] = mapped_column(Boolean, default=True)

    meta: Mapped[list["AgentMeta"]] = relationship(cascade="all, delete-orphan")


class AgentMeta(Base):
    __tablename__ = "agent_meta"
    __table_args__ = (UniqueConstraint("object_id", "key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    object_id: Mapped[int] = mapped_column(ForeignKey("agent.id", ondelete="CASCADE"))
    key: Mapped[str] = mapped_column(String(255))
    value: Mapped[str | None] = mapped_column(Text)


class Space(Base):
    __tablename__ = "space"

    id: Mapped[int] = mapped_column(primary_key=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("space.id"))
    agent_id: Mapped[int] = mapped_column(ForeignKey("agent.id"))
    type: Mapped[int] = mapped_column(SmallInteger)
    name: Mapped[str] = mapped_column(String(255))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    short_description: Mapped[str | None] = mapped_column(Text)
    long_description: Mapped[str | None] = mapped_column(Text)
    create_timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    update_timestamp: Mapped[datetime | None] = mapped_column(DateTime, onupdate=datetime.utcnow)
    status: Mapped[int] = mapped_column(SmallInteger, default=1)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    public: Mapped[bool] = mapped_column(Boolean, default=True)

    meta: Mapped[list["SpaceMeta"]] = relationship(cascade="all, delete-orphan")


class SpaceMeta(Base):
    __tablename__ = "space_meta"
    __table_args__ = (UniqueConstraint("object_id", "key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    object_id: Mapped[int] = mapped_column(ForeignKey("space.id", ondelete="CASCADE"))
    key: Mapped[str] = mapped_column(String(255))
    value: Mapped[str | None] = mapped_column(Text)


class SyncTarget(Base):
    __tablename__ = "sync_target"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    base_url: Mapped[str] = mapped_column(String(255))
    auth_mode: Mapped[str] = mapped_column(String(32), default="bearer")
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)


class SyncState(Base):
    __tablename__ = "sync_state"
    __table_args__ = (UniqueConstraint("target_id", "entity_type", "local_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    target_id: Mapped[int] = mapped_column(ForeignKey("sync_target.id"))
    entity_type: Mapped[str] = mapped_column(String(16))
    local_id: Mapped[int] = mapped_column(Integer)
    remote_id: Mapped[int | None] = mapped_column(Integer)
    content_hash: Mapped[str | None] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(16), default="pending")
    last_error: Mapped[str | None] = mapped_column(Text)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime)


class SyncLog(Base):
    __tablename__ = "sync_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    target_id: Mapped[int | None] = mapped_column(ForeignKey("sync_target.id"))
    entity_type: Mapped[str | None] = mapped_column(String(16))
    local_id: Mapped[int | None] = mapped_column(Integer)
    method: Mapped[str | None] = mapped_column(String(8))
    http_status: Mapped[int | None] = mapped_column(Integer)
    dry_run: Mapped[bool] = mapped_column(Boolean, default=True)
    message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
