-- Agentes da equipe = contas cadastradas no site (o e-mail é a identidade). O formulário enviado pelo administrador
-- aparece no painel do agente. Cole no SQL Editor e clique em Run. Precisa do equipes.sql já rodado.

alter table public.mc_membros add column if not exists user_id uuid references auth.users(id) on delete cascade;
create unique index if not exists mc_membros_equipe_user_idx on public.mc_membros (equipe_id, user_id) where user_id is not null;

-- o administrador adiciona o agente pelo e-mail; a conta precisa existir
create or replace function public.mc_adicionar_membro(p_equipe uuid, p_email text) returns text
language plpgsql security definer set search_path = public as $$
declare perfil public.mc_perfis%rowtype;
        nome_final text;
begin
  if not public.mc_is_admin() then
    raise exception 'Só administradores podem fazer isso.';
  end if;
  select * into perfil from public.mc_perfis where email = lower(trim(p_email));
  if perfil.id is null then
    raise exception 'Nenhuma conta com o e-mail %. A pessoa precisa se cadastrar no site primeiro.', lower(trim(p_email));
  end if;
  if exists (select 1 from public.mc_membros where equipe_id = p_equipe and user_id = perfil.id) then
    raise exception '% já está nesta equipe.', perfil.email;
  end if;
  nome_final := coalesce(nullif(trim(perfil.nome), ''), split_part(perfil.email, '@', 1));
  insert into public.mc_membros (equipe_id, nome, email, user_id) values (p_equipe, nome_final, perfil.email, perfil.id);
  return nome_final;
end;
$$;
grant execute on function public.mc_adicionar_membro(uuid, text) to authenticated;

-- formulários enviados para a conta de quem está logado (aparecem no painel do agente)
create or replace function public.mc_meus_formularios()
returns table (envio_id uuid, form_id uuid, titulo text, descricao text, enviado_em timestamptz, respondido boolean)
language sql stable security definer set search_path = public as $$
  select e.id, f.id, f.titulo, f.descricao, e.created_at,
         exists (select 1 from public.mc_respostas r where r.envio_id = e.id)
  from public.mc_membros m
  join public.mc_envios e on e.membro_id = m.id
  join public.mc_formularios f on f.id = e.form_id
  where m.user_id = auth.uid() and f.aberto
  order by e.created_at desc;
$$;
grant execute on function public.mc_meus_formularios() to authenticated;
