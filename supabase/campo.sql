-- Formulários de campo: o administrador cria perguntas, manda o link ao agente e recebe as respostas
-- (com fotos, áudios e vídeos) dentro do site. Cole no SQL Editor do Supabase e clique em Run.
-- Precisa que o setup.sql já tenha sido rodado (usa mc_is_admin). Pode rodar mais de uma vez.

create table if not exists public.mc_formularios (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  perguntas jsonb not null default '[]'::jsonb,
  aberto boolean not null default true,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.mc_respostas (
  id uuid primary key,
  form_id uuid not null references public.mc_formularios(id) on delete cascade,
  respondente text,
  contato text,
  respostas jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists mc_respostas_form_idx on public.mc_respostas (form_id, created_at desc);

-- o link do formulário (id aleatório) basta para o agente abrir e responder, sem criar conta
create or replace function public.mc_form_publico(p_id uuid)
returns table (id uuid, titulo text, descricao text, perguntas jsonb)
language sql stable security definer set search_path = public as $$
  select f.id, f.titulo, f.descricao, f.perguntas from public.mc_formularios f where f.id = p_id and f.aberto;
$$;
grant execute on function public.mc_form_publico(uuid) to anon, authenticated;

create or replace function public.mc_form_aberto(p_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mc_formularios where id::text = p_id and aberto);
$$;
grant execute on function public.mc_form_aberto(text) to anon, authenticated;

alter table public.mc_formularios enable row level security;
alter table public.mc_respostas enable row level security;
revoke all on public.mc_formularios, public.mc_respostas from anon, authenticated;
grant select, insert, update, delete on public.mc_formularios to authenticated;
grant select, update, delete on public.mc_respostas to authenticated;
grant insert on public.mc_respostas to anon, authenticated;

drop policy if exists mc_form_admin on public.mc_formularios;
create policy mc_form_admin on public.mc_formularios for all to authenticated
  using (public.mc_is_admin()) with check (public.mc_is_admin());

-- qualquer pessoa com o link envia respostas, mas só enquanto o formulário está aberto; só o admin lê
drop policy if exists mc_resp_enviar on public.mc_respostas;
create policy mc_resp_enviar on public.mc_respostas for insert to anon, authenticated
  with check (public.mc_form_aberto(form_id::text));
drop policy if exists mc_resp_admin on public.mc_respostas;
create policy mc_resp_admin on public.mc_respostas for all to authenticated
  using (public.mc_is_admin()) with check (public.mc_is_admin());

-- anexos (fotos, áudios, vídeos): espaço PRIVADO, só o administrador vê. Até 50 MB por arquivo (limite do plano grátis).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mc-campo', 'mc-campo', false, 52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm', 'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update set public = false, file_size_limit = 52428800,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm', 'video/mp4', 'video/quicktime', 'video/webm'];

drop policy if exists mc_campo_enviar on storage.objects;
create policy mc_campo_enviar on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'mc-campo' and public.mc_form_aberto((storage.foldername(name))[1]));
drop policy if exists mc_campo_ler on storage.objects;
create policy mc_campo_ler on storage.objects for select to authenticated
  using (bucket_id = 'mc-campo' and public.mc_is_admin());
drop policy if exists mc_campo_apagar on storage.objects;
create policy mc_campo_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'mc-campo' and public.mc_is_admin());
