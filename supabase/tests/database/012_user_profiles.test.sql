begin;
select plan(9);

-- P1 e P2 na MESMA org (P2 inserido diretamente, como acontecerá com equipas na Fase 3).
select tests.create_auth_user('a2000000-0000-0000-0000-000000000001', 'p1@example.com');
select tests.create_auth_user('b2000000-0000-0000-0000-000000000002', 'p2@example.com');
select app.create_consultant('a2000000-0000-0000-0000-000000000001', 'p1@example.com', 'Pessoa Um');
insert into public.organization_members (organization_id, user_id, role, display_name)
values (tests.org_id_of('a2000000-0000-0000-0000-000000000001'),
        'b2000000-0000-0000-0000-000000000002', 'consultant', 'Pessoa Dois');
insert into public.user_profiles (user_id, display_name)
values ('b2000000-0000-0000-0000-000000000002', 'Pessoa Dois');

select tests.authenticate_as('a2000000-0000-0000-0000-000000000001');

select results_eq($$ select user_id from public.user_profiles $$,
  $$ values ('a2000000-0000-0000-0000-000000000001'::uuid) $$,
  'utilizador lê exatamente 1 perfil: o seu');
select is_empty($$
  select 1 from public.user_profiles where user_id = 'b2000000-0000-0000-0000-000000000002'
$$, 'membros da mesma org não leem o perfil um do outro');

-- UPDATE com user_id alheio: o RLS filtra, 0 linhas afetadas (verificado abaixo como postgres).
update public.user_profiles set display_name = 'Pirata'
where user_id = 'b2000000-0000-0000-0000-000000000002';

select throws_ok($$
  update public.user_profiles set user_id = 'b2000000-0000-0000-0000-000000000002'
  where user_id = 'a2000000-0000-0000-0000-000000000001'
$$, '42501', null, 'não é possível mudar o próprio user_id');
select throws_ok($$
  insert into public.user_profiles (user_id) values ('b2000000-0000-0000-0000-000000000002')
$$, '42501', null, 'authenticated não insere perfis');
select throws_ok($$ delete from public.user_profiles $$, '42501', null, 'authenticated não apaga perfis');
select throws_ok($$ update public.user_profiles set display_name = '  ' $$,
  '23514', null, 'display_name em branco rejeitado (usar NULL)');

select lives_ok($$
  update public.user_profiles set display_name = 'Pessoa Um Editada'
  where user_id = 'a2000000-0000-0000-0000-000000000001'
$$, 'utilizador edita o próprio perfil');
reset role;

select results_eq($$
  select display_name from public.user_profiles where user_id = 'b2000000-0000-0000-0000-000000000002'
$$, $$ values ('Pessoa Dois'::text) $$, 'UPDATE ao perfil alheio não teve efeito');
select results_eq($$
  select display_name from public.user_profiles where user_id = 'a2000000-0000-0000-0000-000000000001'
$$, $$ values ('Pessoa Um Editada'::text) $$, 'UPDATE ao próprio perfil persistiu');

select * from finish();
rollback;
