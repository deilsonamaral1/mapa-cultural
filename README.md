# Mapa Cultural Municipal

Site e painel de administração de um mapa cultural municipal (agentes, espaços e eventos),
com schema PostgreSQL/PostGIS inspirado no Mapas Culturais e módulo de sincronização via API REST.

- **frontend/** Next.js + React + Tailwind (mapa público e painel `/admin`)
- **backend/** FastAPI + SQLAlchemy (API, autenticação JWT, sincronização)
- **backend/sql/** schema do banco (carregado automaticamente pelo docker compose)

## Cadastro, login e aprovação (Supabase)

Agentes e administração usam o **Supabase** (login + banco PostgreSQL, plano grátis). Não há backend próprio para hospedar.

| Tela | Quem | O que faz |
|---|---|---|
| `/cadastro`, `/entrar` | qualquer pessoa | cria conta e entra |
| `/painel` | agente logado | cria, edita e acompanha cadastros (agente, espaço, evento) |
| `/admin` | administrador | **Aprovações**: aprova, rejeita (com motivo) ou tira do mapa. **Equipe**: promove ou remove administradores pelo e-mail |
| `/mapa` | público | mostra os mapas oficiais **e** os cadastros aprovados (filtro "Site") |

**Segurança.** As regras ficam no próprio banco (`supabase/setup.sql`, Row Level Security). O agente só vê e edita os
próprios envios (sempre como "pendente"); o público só lê `mc_publicados`; só quem tem `papel = 'admin'` aprova,
rejeita e promove outros administradores. A chave "anon" do site é pública por natureza; a `service_role` nunca é usada.

### Configuração (sem instalar nada)

1. No Supabase, abra **SQL Editor**, cole todo o `supabase/setup.sql` e clique em **Run**. Ele só cria tabelas com o
   prefixo `mc_`, então pode ser o mesmo projeto de outro sistema.
2. **Project Settings → API**: copie a **Project URL** e a chave **anon / public**.
3. No Netlify, **Site configuration → Environment variables**: crie `NEXT_PUBLIC_SUPABASE_URL` e
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` com esses dois valores e faça um novo deploy.
4. Supabase → **Authentication → URL Configuration**: em *Site URL* coloque `https://mapaculturalaquiraz.netlify.app`
   (se o projeto já serve outro site, deixe o dele em *Site URL* e adicione este em *Redirect URLs*).
5. Crie sua conta em `/cadastro` e, no SQL Editor, rode **uma vez**:
   `update public.mc_perfis set papel = 'admin' where email = 'seu-email@exemplo.com';`

6. **Fotos:** cole também o `supabase/fotos.sql` no SQL Editor e rode (cria o bucket público `mc-fotos`, 5 MB por foto, e as regras: cada pessoa só grava na própria pasta). Os vídeos ficam no YouTube e só aparecem em player dentro do site (`/ver`).

Depois disso, novos administradores são promovidos dentro do site (Administração, aba Equipe).
Em *Authentication → Providers → Email*, "Confirm email" decide se a pessoa precisa confirmar o e-mail antes de entrar
(o envio padrão do Supabase tem limite baixo de e-mails por hora).

**Dados dos mapas oficiais dentro do site.** Clicar em um evento, espaço, agente, projeto ou oportunidade do Aquiraz ou do Ceará abre a página `/oficial` aqui mesmo, com descrição, fotos e vídeos lidos ao vivo da API pública deles (sem copiar nada para o seu banco, então fica sempre atualizado). Só a inscrição em editais continua no mapa oficial, porque exige login lá.

**Blog e podcast.** Rode também o `supabase/blog.sql` no SQL Editor. Agentes enviam textos e episódios pelo `/painel` (seção Blog e podcast) e a equipe aprova em Administração → Blog e podcast; administradores publicam direto. O áudio pode ser arquivo (até 50 MB, limite do plano grátis) ou link do Spotify, YouTube ou SoundCloud. Páginas: `/blog`, `/podcast` e `/leitura?id=…`.

**Formulários de campo.** Rode o `supabase/campo.sql`. Em Administração → Formulários de campo, o administrador cria perguntas (resposta curta, longa, escolha ou só anexos); em qualquer tipo o agente também pode juntar fotos, áudios, vídeos e links, copia o link ou manda por WhatsApp e recebe as respostas ali mesmo. O agente abre `/campo?f=…` sem criar conta, responde e toca em *Salvar e enviar*; o texto fica guardado no aparelho até enviar. Os anexos vão para um espaço **privado** (`mc-campo`, 50 MB por arquivo) que só o administrador abre. Encerrar o formulário bloqueia novos envios.

**Backup e "pausa" do Supabase.** Dois robôs grátis do GitHub Actions (pasta `.github/workflows`):
- `keepalive.yml`: uma consulta pública por dia, para o projeto não ser pausado por inatividade. Não precisa de configuração.
- `backup.yml`: toda segunda-feira exporta as tabelas `mc_*` para um arquivo **criptografado** (o repositório é público), guardado 90 dias em *Actions → execução → Artifacts*. Para ligar, crie dois segredos em *Settings → Secrets and variables → Actions → New repository secret*: `SUPABASE_SERVICE_KEY` (a chave secreta do Supabase, só aqui) e `BACKUP_PASSPHRASE` (uma senha longa que você inventa e guarda). Para abrir um backup: `openssl enc -d -aes-256-cbc -pbkdf2 -in backup-AAAA-MM-DD.json.gz.enc -out backup.json.gz` e depois `gunzip backup.json.gz`. Os arquivos de foto, áudio e vídeo (Storage) **não** entram nesse backup, só os dados das tabelas.

**Limites desta versão:** o envio de volta para o Mapa Cultural do Aquiraz e da Secult **ainda não existe**
(depende de chaves de App criadas pelos administradores deles); ao apagar um envio já publicado, a administração
precisa tirá-lo do mapa em `/admin`. No plano grátis o Supabase pausa o projeto após cerca de 7 dias sem uso
(basta clicar em *Restore*).

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
