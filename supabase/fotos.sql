-- Fotos dos cadastros: cria o "bucket" público mc-fotos (até 5 MB por foto, só imagens).
-- Cole no SQL Editor do Supabase e clique em Run. Pode rodar mais de uma vez.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mc-fotos', 'mc-fotos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- cada pessoa só grava e apaga dentro da própria pasta (nome da pasta = id da conta)
drop policy if exists mc_fotos_enviar on storage.objects;
create policy mc_fotos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'mc-fotos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists mc_fotos_apagar on storage.objects;
create policy mc_fotos_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'mc-fotos' and ((storage.foldername(name))[1] = auth.uid()::text or public.mc_is_admin()));
