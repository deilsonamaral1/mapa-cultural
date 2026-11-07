# Mapa Cultural Municipal

Site e painel de administração de um mapa cultural municipal (agentes, espaços e eventos),
com schema PostgreSQL/PostGIS inspirado no Mapas Culturais e módulo de sincronização via API REST.

- **frontend/** Next.js + React + Tailwind (mapa público e painel `/admin`)
- **backend/** FastAPI + SQLAlchemy (API, autenticação JWT, sincronização)
- **backend/sql/** schema do banco (carregado automaticamente pelo docker compose)

## Cadastro, login e aprovação (Appwrite)

Agentes e administração usam o **Appwrite** (Auth + Databases). Não há backend próprio para hospedar.

| Tela | Quem | O que faz |
|---|---|---|
| `/cadastro`, `/entrar` | qualquer pessoa | cria conta e entra |
| `/painel` | agente logado | cria, edita e acompanha cadastros (agente, espaço, evento) |
| `/admin` | conta com o rótulo `admin` | aprova, rejeita (com motivo) ou tira do mapa |
| `/mapa?tab=project` e `?tab=opportunity` | público | Projetos e Oportunidades, lidos dos mapas oficiais (com prazo de inscrição) |
| `/mapa` | público | mostra os mapas oficiais **e** os cadastros aprovados (filtro "Site") |

**Como a segurança funciona.** Há duas coleções. Em `submissions` qualquer pessoa logada cria, e cada agente só
vê os próprios envios. Em `published` o público só lê, e **somente o rótulo `admin` grava**. Aprovar é copiar o
envio para `published`; por isso ninguém consegue se aprovar sozinho. Editar um cadastro volta o status para pendente.

**Acesso do administrador.** É a conta (e-mail e senha) que você criou em `/cadastro` e marcou com o rótulo `admin`
no Appwrite. Entre em `/entrar`: o cabeçalho passa a mostrar o botão **Administração** (só para quem tem o rótulo),
que leva a `/admin`. O rodapé do site também tem o link "Administração da equipe". Para dar acesso a outra pessoa,
repita o passo 3 abaixo na conta dela.

**Configuração pelo painel do Appwrite (sem instalar nada).** Em Databases, abra o banco e crie **duas tabelas**.
O **Table ID** precisa ser exatamente `submissions` e `published` (na janela de criar a tabela, clique no ícone de
lápis ao lado do nome para digitar o ID). Se as tabelas já existem com outro ID, anote o ID de cada uma (Settings da
tabela) e use as variáveis `NEXT_PUBLIC_APPWRITE_SUBMISSIONS_ID` e `NEXT_PUBLIC_APPWRITE_PUBLISHED_ID` no Netlify.

*Tabela `submissions`*
- Colunas (todas do tipo **String**): `ownerId` (tamanho 64, obrigatória), `status` (16, obrigatória), `note` (500, opcional) e `data` (tamanho 10000, obrigatória; pode ser o tipo **Text**).
- Índices (tipo Key): `idx_owner` na coluna `ownerId` e `idx_status` na coluna `status`.
- Settings → Permissions: adicione **Users → Create**; e, como função personalizada `label:admin`, marque **Read, Update e Delete**. Ligue **Row security**.

*Tabela `published`*
- Colunas (String): `kind` (16, obrigatória) e `data` (10000, obrigatória).
- Índice (Key): `idx_kind` na coluna `kind`.
- Settings → Permissions: **Any → Read**; e `label:admin` com **Create, Update e Delete**. Deixe **Row security** desligada.

Depois:
1. Appwrite → Overview → **Plataformas → Web**: adicione `mapaculturalaquiraz.netlify.app` (sem isso o navegador é bloqueado e aparece "Failed to fetch").
2. Cadastre-se no site, depois no Appwrite → Auth → seu usuário → **Labels** → adicione `admin`. Saia e entre de novo.

*Alternativa com script:* quem preferir pode rodar `appwrite/setup.mjs` (precisa de Node.js e de uma chave de API temporária,
que é segredo: nunca no GitHub nem em conversas).

Endereço e IDs do projeto estão em `frontend/src/lib/appwrite.ts` (não são segredo) e podem ser trocados pelas
variáveis `NEXT_PUBLIC_APPWRITE_ENDPOINT`, `NEXT_PUBLIC_APPWRITE_PROJECT_ID` e `NEXT_PUBLIC_APPWRITE_DATABASE_ID`.

**Limites desta versão:** o envio de volta para o Mapa Cultural do Aquiraz e da Secult **ainda não existe**
(depende de chaves de App criadas pelos administradores deles); ao apagar um envio já publicado, a administração
precisa tirá-lo do mapa em `/admin`; a verificação de e-mail do Appwrite ainda não está exigida.

> O painel antigo (`/admin/*` ligado ao FastAPI) foi removido do site. A pasta `backend/` continua no repositório,
> mas não é usada pelo site publicado.

## Modo atual no Netlify (sem backend)

A tela inicial (`/`) é a página de boas-vindas; o mapa fica em `/mapa` (aceita `?tab=event|space|agent&q=busca`).
A ilustração da tela inicial é um SVG (`components/HeroArt.tsx`); as cores da marca ficam em `frontend/tailwind.config.ts`.

O mapa lê **ao vivo** os Mapas Culturais de Aquiraz e do Ceará pela API pública deles,
passando pelo proxy definido em `netlify.toml` (`/proxy/aquiraz/*` e `/proxy/estado/*`), o que evita
bloqueio de CORS. Quem publica nos mapas oficiais aparece aqui automaticamente.

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
