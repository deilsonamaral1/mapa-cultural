# Mapa Cultural Municipal

Site e painel de administração de um mapa cultural municipal (agentes, espaços e eventos),
com schema PostgreSQL/PostGIS inspirado no Mapas Culturais e módulo de sincronização via API REST.

- **frontend/** Next.js + React + Tailwind (mapa público e painel `/admin`)
- **backend/** FastAPI + SQLAlchemy (API, autenticação JWT, sincronização)
- **backend/sql/** schema do banco (carregado automaticamente pelo docker compose)

## Rodando localmente

```bash
cp .env.example .env     # defina JWT_SECRET e ADMIN_PASSWORD (mín. 10 caracteres)
docker compose up -d
docker compose exec api python -m scripts.seed
```

Site: http://localhost:3000 · Painel: `/admin/login` · API: http://localhost:8000/docs

## Sincronização

Mantida em **dry-run** por padrão (`SYNC_DRY_RUN=true`): nada é enviado. Para enviar de verdade
é preciso um token emitido pela administração da instância de destino, com permissão de escrita,
e confirmar o esquema de autenticação em `backend/app/services/mapas_client.py`.
Apague os dados de exemplo antes de ligar o envio real.

## Cadastro de agentes e moderação

- `/cadastro`: qualquer pessoa cria conta (papel `agent`) e um perfil de agente **pendente**.
- Cada agente vê e edita só o que é seu. Tudo que cria ou edita volta para **pendente** (status 0).
- Administradores aprovam ou rejeitam em `/admin/moderacao`. Só o aprovado (status 1) aparece no
  mapa e entra na sincronização. Espaços e eventos só podem ser aprovados depois do agente.
- Metadados aceitos ficam em `backend/app/core/meta_keys.py` (lista fechada, também aplicada no envio).
- Anti-spam atual: campo isca + limite de 5 cadastros/hora por IP, em memória. Para produção,
  adicione verificação de e-mail e/ou captcha, e um limite no proxy.
