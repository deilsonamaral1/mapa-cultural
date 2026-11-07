-- Mapa Cultural de Aquiraz: tabelas e regras de acesso no Supabase.
-- Cole tudo no SQL Editor do Supabase e clique em Run. Pode rodar mais de uma vez sem problema.
-- Só CRIA coisas com o prefixo mc_ : não altera nem apaga nada de outros sistemas do mesmo projeto.

-- ---------- tabelas ----------
create table if not exists public.mc_perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nome text,
  papel text not null default 'agente' check (papel in ('agente', 'admin')),
  criado_em timestamptz not null default now()
);

create table if not exists public.mc_cadastros (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  note text,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists mc_cadastros_owner_idx on public.mc_cadastros (owner_id);
create index if not exists mc_cadastros_status_idx on public.mc_cadastros (status);

create table if not exists public.mc_publicados (
  id uuid primary key,
  kind text not null,
  data jsonb not null
);
create index if not exists mc_publicados_kind_idx on public.mc_publicados (kind);

-- ---------- quem é administrador ----------
create or replace function public.mc_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mc_perfis where id = auth.uid() and papel = 'admin');
$$;
grant execute on function public.mc_is_admin() to authenticated;

-- ---------- perfil criado sozinho no cadastro ----------
create or replace function public.mc_novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.mc_perfis (id, email, nome)
  values (new.id, lower(new.email), new.raw_user_meta_data ->> 'name')
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists mc_on_signup on auth.users;
create trigger mc_on_signup after insert on auth.users
  for each row execute function public.mc_novo_usuario();

-- contas que já existiam no projeto (de outro sistema) também ganham perfil de agente
insert into public.mc_perfis (id, email, nome)
select id, lower(email), raw_user_meta_data ->> 'name' from auth.users
where email is not null
on conflict (id) do nothing;

-- ---------- promover / remover administrador (usado pela tela "Equipe") ----------
create or replace function public.mc_definir_papel(p_email text, p_papel text) returns void
language plpgsql security definer set search_path = public as $$
declare alvo uuid;
begin
  if not public.mc_is_admin() then
    raise exception 'Só administradores podem fazer isso.';
  end if;
  if p_papel not in ('agente', 'admin') then
    raise exception 'Papel inválido.';
  end if;
  select id into alvo from public.mc_perfis where email = lower(trim(p_email));
  if alvo is null then
    raise exception 'Nenhuma conta com este e-mail. A pessoa precisa criar a conta no site primeiro.';
  end if;
  if alvo = auth.uid() and p_papel <> 'admin' then
    raise exception 'Você não pode remover o seu próprio acesso.';
  end if;
  update public.mc_perfis set papel = p_papel where id = alvo;
end;
$$;
grant execute on function public.mc_definir_papel(text, text) to authenticated;

-- ---------- permissões ----------
alter table public.mc_perfis enable row level security;
alter table public.mc_cadastros enable row level security;
alter table public.mc_publicados enable row level security;

revoke all on public.mc_perfis, public.mc_cadastros, public.mc_publicados from anon, authenticated;
grant select on public.mc_perfis to authenticated;
grant select, insert, update, delete on public.mc_cadastros to authenticated;
grant select on public.mc_publicados to anon, authenticated;
grant insert, update, delete on public.mc_publicados to authenticated;

-- perfis: cada pessoa vê o seu; administrador vê todos. Ninguém altera direto (só pela função acima).
drop policy if exists mc_perfis_ler on public.mc_perfis;
create policy mc_perfis_ler on public.mc_perfis for select to authenticated
  using (id = auth.uid() or public.mc_is_admin());

-- cadastros: o agente cria/edita/apaga só os seus (sempre "pendente"); administrador vê e decide tudo
drop policy if exists mc_cad_dono_ler on public.mc_cadastros;
create policy mc_cad_dono_ler on public.mc_cadastros for select to authenticated
  using (owner_id = auth.uid());
drop policy if exists mc_cad_dono_criar on public.mc_cadastros;
create policy mc_cad_dono_criar on public.mc_cadastros for insert to authenticated
  with check (owner_id = auth.uid() and status = 'pending');
drop policy if exists mc_cad_dono_editar on public.mc_cadastros;
create policy mc_cad_dono_editar on public.mc_cadastros for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and status = 'pending');
drop policy if exists mc_cad_dono_apagar on public.mc_cadastros;
create policy mc_cad_dono_apagar on public.mc_cadastros for delete to authenticated
  using (owner_id = auth.uid());
drop policy if exists mc_cad_admin on public.mc_cadastros;
create policy mc_cad_admin on public.mc_cadastros for all to authenticated
  using (public.mc_is_admin()) with check (public.mc_is_admin());

-- publicados: qualquer pessoa lê; só administrador grava
drop policy if exists mc_pub_ler on public.mc_publicados;
create policy mc_pub_ler on public.mc_publicados for select to anon, authenticated using (true);
drop policy if exists mc_pub_admin on public.mc_publicados;
create policy mc_pub_admin on public.mc_publicados for all to authenticated
  using (public.mc_is_admin()) with check (public.mc_is_admin());

-- ---------- o PRIMEIRO administrador ----------
-- Depois de criar a sua conta no site, rode UMA vez (troque pelo seu e-mail):
--
--   update public.mc_perfis set papel = 'admin' where email = 'seu-email@exemplo.com';
--
-- Os demais administradores você promove dentro do site, em Administração > Equipe.
