-- Blog e podcast: tabela de publicações, espaço para áudios e regras de acesso.
-- Cole no SQL Editor do Supabase e clique em Run. Pode rodar mais de uma vez.
-- Precisa que o setup.sql já tenha sido rodado (usa a função mc_is_admin).

create table if not exists public.mc_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text,
  kind text not null check (kind in ('blog', 'podcast')),
  title text not null,
  summary text,
  body text,
  cover text,
  audio text,
  embed text,
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  note text,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists mc_posts_status_idx on public.mc_posts (status, kind, published_at desc);
create index if not exists mc_posts_author_idx on public.mc_posts (author_id);

alter table public.mc_posts enable row level security;
revoke all on public.mc_posts from anon, authenticated;
grant select on public.mc_posts to anon;
grant select, insert, update, delete on public.mc_posts to authenticated;

-- público: só o que está publicado
drop policy if exists mc_posts_publico on public.mc_posts;
create policy mc_posts_publico on public.mc_posts for select to anon, authenticated using (status = 'published');

-- autor: vê os próprios, cria (sempre pendente), edita enquanto não publicado, apaga
drop policy if exists mc_posts_autor_ler on public.mc_posts;
create policy mc_posts_autor_ler on public.mc_posts for select to authenticated using (author_id = auth.uid());
drop policy if exists mc_posts_autor_criar on public.mc_posts;
create policy mc_posts_autor_criar on public.mc_posts for insert to authenticated
  with check (author_id = auth.uid() and status = 'pending');
drop policy if exists mc_posts_autor_editar on public.mc_posts;
create policy mc_posts_autor_editar on public.mc_posts for update to authenticated
  using (author_id = auth.uid() and status in ('pending', 'rejected'))
  with check (author_id = auth.uid() and status = 'pending');
drop policy if exists mc_posts_autor_apagar on public.mc_posts;
create policy mc_posts_autor_apagar on public.mc_posts for delete to authenticated using (author_id = auth.uid());

-- administrador: tudo
drop policy if exists mc_posts_admin on public.mc_posts;
create policy mc_posts_admin on public.mc_posts for all to authenticated
  using (public.mc_is_admin()) with check (public.mc_is_admin());

-- áudios (mp3, m4a, ogg, wav): até 50 MB por arquivo, que é o máximo do plano grátis
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mc-audio', 'mc-audio', true, 52428800,
  array['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm'])
on conflict (id) do update set public = true, file_size_limit = 52428800,
  allowed_mime_types = array['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm'];

drop policy if exists mc_audio_enviar on storage.objects;
create policy mc_audio_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'mc-audio' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists mc_audio_apagar on storage.objects;
create policy mc_audio_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'mc-audio' and ((storage.foldername(name))[1] = auth.uid()::text or public.mc_is_admin()));
