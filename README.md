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
