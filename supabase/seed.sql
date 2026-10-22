-- =============================================================================
-- Dados FICTÍCIOS de desenvolvimento local (supabase db reset). Nunca dados reais.
-- Password de dev de todos os utilizadores: visitbook-dev-1234  (só local)
--
-- Os auth users são inseridos diretamente porque é ambiente local. Em produção os
-- consultores são criados por inviteUserByEmail + public.admin_create_consultant().
-- As tabelas da app são preenchidas SÓ através de app.create_consultant().
-- =============================================================================

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ana.consultora@example.com',
   extensions.crypt('visitbook-dev-1234', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'joao.consultor@example.com',
   extensions.crypt('visitbook-dev-1234', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
select gen_random_uuid(), u.id, u.id::text, 'email',
       json_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true)::jsonb,
       now(), now(), now()
from auth.users u
where u.id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222');

select app.create_consultant('11111111-1111-4111-8111-111111111111', 'ana.consultora@example.com',
                             'Ana Martins', 'Ana Martins · Imobiliária Atlântico');
select app.create_consultant('22222222-2222-4222-8222-222222222222', 'joao.consultor@example.com',
                             'João Ferreira', 'João Ferreira (independente)');
