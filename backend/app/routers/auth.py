import time
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_token, hash_password, verify_password
from app.db.session import get_db
from app.models.cms import User
from app.models.entities import Agent

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Limite simples por IP, em memória (vale por processo). Para produção com vários
# processos/servidores, use Redis ou o rate limit do proxy/CDN.
_REGISTER_WINDOW = 3600
_REGISTER_MAX = 5
_attempts: dict[str, deque] = defaultdict(deque)


class LoginIn(BaseModel):
    email: str
    password: str


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=255)   # nome do agente cultural
    email: str = Field(min_length=5, max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=10, max_length=128)
    website: str | None = None  # campo isca (honeypot): humanos não preenchem


def _token_response(user: User) -> dict:
    return {"access_token": create_token(user), "token_type": "bearer", "role": user.role}


@router.post("/login")
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == data.email.strip().lower()))
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "E-mail ou senha inválidos")
    return _token_response(user)


@router.post("/register", status_code=201)
def register(data: RegisterIn, request: Request, db: Session = Depends(get_db)):
    """Cadastro público de agente cultural. Cria o usuário (papel 'agent') e o perfil de
    agente PENDENTE de aprovação (status 0): ele só aparece no mapa após moderação."""
    if data.website:  # robô preencheu o campo isca: finge sucesso, não cria nada
        return {"ok": True}

    ip = request.client.host if request.client else "?"
    now = time.time()
    q = _attempts[ip]
    while q and now - q[0] > _REGISTER_WINDOW:
        q.popleft()
    if len(q) >= _REGISTER_MAX:
        raise HTTPException(429, "Muitas tentativas. Tente novamente mais tarde.")
    q.append(now)

    email = data.email.strip().lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, "Este e-mail já está cadastrado")

    user = User(email=email, password_hash=hash_password(data.password), role="agent")
    db.add(user)
    db.flush()
    db.add(Agent(user_id=user.id, name=data.name.strip(), type=1, status=0))
    db.commit()
    return _token_response(user)
