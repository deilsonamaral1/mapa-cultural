# Mapa Cultural Municipal

Site e painel de administração de um mapa cultural municipal (agentes, espaços e eventos),
com schema PostgreSQL/PostGIS inspirado no Mapas Culturais e módulo de sincronização via API REST.

- **frontend/** Next.js + React + Tailwind (mapa público e painel `/admin`)
- **backend/** FastAPI + SQLAlchemy (API, autenticação JWT, sincronização)
- **backend/sql/** schema do banco (carregado automaticamente pelo docker compose)

## Modo atual no Netlify (sem backend)

A tela inicial (`/`) é a página de boas-vindas; o mapa fica em `/mapa` (aceita `?tab=event|space|agent&q=busca`).
Fotos opcionais do topo: `frontend/public/hero/1.jpg`, `2.jpg`, `3.jpg` (veja `LEIAME.txt` na pasta).

O mapa lê **ao vivo** os Mapas Culturais de Aquiraz e do Ceará pela API pública deles,
passando pelo proxy definido em `netlify.toml` (`/proxy/aquiraz/*` e `/proxy/estado/*`), o que evita
bloqueio de CORS. O cadastro (`/cadastro`) leva ao cadastro oficial; quem publica lá aparece aqui.
Não há banco nem servidor próprios nesse modo. O painel `/admin` e a pasta `backend/` só funcionam
se o backend for publicado e `NEXT_PUBLIC_API_URL` for definida no Netlify.

Variáveis opcionais no Netlify: `NEXT_PUBLIC_CITY_NAME`, `NEXT_PUBLIC_MAP_LAT`, `NEXT_PUBLIC_MAP_LNG`,
`NEXT_PUBLIC_MAP_ZOOM`.

## Rodando localmente

```bash
cp .env.example .env     # defina JWT_SECRET e ADMIN_PASSWORD (mín. 10 caracteres)
docker compose up -d
docker compose exec api python -m scripts.seed
```

Site: http://localhost:3000 · Painel: `/admin/login` · API: http://localhost:8000/docs

## Sincronização

Mantida em **dry-run** por padrão (`SYNC_DRY_RUN=true`): nada é enviado.

Para enviar de verdade, em cada instância de destino é preciso criar um **App** (Painel > Meus Apps)
e copiar a chave pública e a privada para o `.env`. Quem cria o App define em nome de quem os
dados são gravados. A autenticação é um JWT assinado com a chave privada, enviado cru no cabeçalho
`authorization` junto com `MapasSDK-REQUEST: true`.

## Compatibilidade com o Mapas Culturais

Alinhado ao repositório de referência [secultce/mapacultural](https://github.com/secultce/mapacultural)
(branch `develop`, lido em nov/2026): colunas e tipos de `agent`, `space`, `event` e
`event_occurrence`; status (1 publicado, 0 rascunho, -10 lixeira); `shortDescription` obrigatória
com até 400 caracteres; localização obrigatória para agente/espaço; 110 tipos oficiais de espaço
(`backend/app/core/mapas_types.py`); endpoints `POST /{entidade}/index` e `PATCH /{entidade}/single/{id}`.
Agentes e espaços só podem ser publicados completos (validado na API e por CHECK no banco).

Pontos que **precisam de confirmação com a administração de cada instância**:
- No código dessa versão, o gancho que ativa o JWT pelo cabeçalho `authorization`
  (`src/modules/Apps/Module.php`) está **comentado**. A API de escrita pode estar inativa na versão que
  Aquiraz/Secult-CE executam.
- Se a instância usa tipos, metadados obrigatórios ou taxonomias (área, linguagem) personalizados.
- O envio usa corpo de formulário, como nos exemplos da documentação. O JWT é gerado sem `-`/`_`
  no payload (`backend/app/services/mapas_auth.py`), porque o servidor decodifica com `base64_decode`
  não estrito e perderia a chave pública.

Apague os dados de exemplo antes de ligar o envio real. Se você já subiu o banco antes desta
versão, recrie-o para aplicar o novo schema: `docker compose down -v && docker compose up -d`.

## Cadastro de agentes e moderação

- `/cadastro`: qualquer pessoa cria conta (papel `agent`) e um perfil de agente **pendente**.
- Cada agente vê e edita só o que é seu. Tudo que cria ou edita volta para **pendente** (status 0).
- Administradores aprovam ou rejeitam em `/admin/moderacao`. Só o aprovado (status 1) aparece no
  mapa e entra na sincronização. Espaços e eventos só podem ser aprovados depois do agente.
- Metadados aceitos ficam em `backend/app/core/meta_keys.py` (lista fechada, também aplicada no envio).
- Anti-spam atual: campo isca + limite de 5 cadastros/hora por IP, em memória. Para produção,
  adicione verificação de e-mail e/ou captcha, e um limite no proxy.
