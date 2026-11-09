-- Equipes de agentes e envio de formulários: individual (link próprio por agente) ou para a equipe toda,
-- e formulários publicados no site. Cole no SQL Editor e clique em Run. Precisa do campo.sql já rodado.

create table if not exists public.mc_equipes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.mc_membros (
  id uuid primary key default gen_random_uuid(),
  equipe_id uuid not null references public.mc_equipes(id) on delete cascade,
  nome text not null,
  telefone text,
  email text,
  created_at timestamptz not null default now()
);
create index if not exists mc_membros_equipe_idx on public.mc_membros (equipe_id);

-- um envio = o formulário mandado para UM agente (cada agente recebe um link só dele)
create table if not exists public.mc_envios (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.mc_formularios(id) on delete cascade,
  membro_id uuid not null references public.mc_membros(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (form_id, membro_id)
);

alter table public.mc_respostas add column if not exists envio_id uuid references public.mc_envios(id) on delete set null;
alter table public.mc_formularios add column if not exists publico boolean not null default false;

alter table public.mc_equipes enable row level security;
alter table public.mc_membros enable row level security;
alter table public.mc_envios enable row level security;
revoke all on public.mc_equipes, public.mc_membros, public.mc_envios from anon, authenticated;
grant select, insert, update, delete on public.mc_equipes, public.mc_membros, public.mc_envios to authenticated;

drop policy if exists mc_equipes_admin on public.mc_equipes;
create policy mc_equipes_admin on public.mc_equipes for all to authenticated
  using (public.mc_is_admin()) with check (public.mc_is_admin());
drop policy if exists mc_membros_admin on public.mc_membros;
create policy mc_membros_admin on public.mc_membros for all to authenticated
  using (public.mc_is_admin()) with check (public.mc_is_admin());
drop policy if exists mc_envios_admin on public.mc_envios;
create policy mc_envios_admin on public.mc_envios for all to authenticated
  using (public.mc_is_admin()) with check (public.mc_is_admin());

-- o link pessoal do agente: abre o formulário já com o nome dele (só enquanto o formulário está aberto)
create or replace function public.mc_envio_publico(p_id uuid)
returns table (form_id uuid, titulo text, descricao text, perguntas jsonb, nome text)
language sql stable security definer set search_path = public as $$
  select f.id, f.titulo, f.descricao, f.perguntas, m.nome
  from public.mc_envios e
  join public.mc_formularios f on f.id = e.form_id
  join public.mc_membros m on m.id = e.membro_id
  where e.id = p_id and f.aberto;
$$;
grant execute on function public.mc_envio_publico(uuid) to anon, authenticated;

-- formulários que o administrador escolheu publicar no site
create or replace function public.mc_formularios_publicos()
returns table (id uuid, titulo text, descricao text)
language sql stable security definer set search_path = public as $$
  select f.id, f.titulo, f.descricao from public.mc_formularios f where f.aberto and f.publico order by f.created_at desc;
$$;
grant execute on function public.mc_formularios_publicos() to anon, authenticated;
