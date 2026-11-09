-- Equipe: papel "moderador", histórico de quem aprovou e permissões. Cole no SQL Editor e clique em Run.
-- Precisa do setup.sql e do blog.sql já rodados. Pode rodar mais de uma vez.

-- papéis: agente (padrão), moderador (aprova cadastros e textos) e admin (tudo, inclusive Equipe e formulários)
alter table public.mc_perfis drop constraint if exists mc_perfis_papel_check;
alter table public.mc_perfis add constraint mc_perfis_papel_check check (papel in ('agente', 'moderador', 'admin'));

create or replace function public.mc_is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mc_perfis where id = auth.uid() and papel in ('admin', 'moderador'));
$$;
grant execute on function public.mc_is_staff() to authenticated;

-- histórico: quem decidiu e quando
alter table public.mc_cadastros add column if not exists reviewed_by uuid;
alter table public.mc_cadastros add column if not exists reviewed_by_name text;
alter table public.mc_cadastros add column if not exists reviewed_at timestamptz;
alter table public.mc_posts add column if not exists reviewed_by uuid;
alter table public.mc_posts add column if not exists reviewed_by_name text;
alter table public.mc_posts add column if not exists reviewed_at timestamptz;

-- moderador também aprova cadastros, publica no mapa e modera o blog
drop policy if exists mc_cad_admin on public.mc_cadastros;
create policy mc_cad_admin on public.mc_cadastros for all to authenticated
  using (public.mc_is_staff()) with check (public.mc_is_staff());
drop policy if exists mc_pub_admin on public.mc_publicados;
create policy mc_pub_admin on public.mc_publicados for all to authenticated
  using (public.mc_is_staff()) with check (public.mc_is_staff());
drop policy if exists mc_posts_admin on public.mc_posts;
create policy mc_posts_admin on public.mc_posts for all to authenticated
  using (public.mc_is_staff()) with check (public.mc_is_staff());

-- só administrador muda papéis
create or replace function public.mc_definir_papel(p_email text, p_papel text) returns void
language plpgsql security definer set search_path = public as $$
declare alvo uuid;
begin
  if not public.mc_is_admin() then
    raise exception 'Só administradores podem fazer isso.';
  end if;
  if p_papel not in ('agente', 'moderador', 'admin') then
    raise exception 'Papel inválido.';
  end if;
  select id into alvo from public.mc_perfis where email = lower(trim(p_email));
  if alvo is null then
    raise exception 'Nenhuma conta com este e-mail. A pessoa precisa criar a conta no site primeiro.';
  end if;
  if alvo = auth.uid() and p_papel <> 'admin' then
    raise exception 'Você não pode tirar o seu próprio acesso de administrador.';
  end if;
  update public.mc_perfis set papel = p_papel where id = alvo;
end;
$$;
grant execute on function public.mc_definir_papel(text, text) to authenticated;
