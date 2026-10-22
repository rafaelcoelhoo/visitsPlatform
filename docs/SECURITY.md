# Segurança

## Princípios

1. **RLS em todas as tabelas de `public`.** Testado em `001_invariants.test.sql`.
2. **Sem `organization_id` no JWT.** O acesso resolve-se por lookup a `organization_members`, através de `app.user_org_ids()`. Desativar um membro corta o acesso no pedido seguinte. Testado em `011_org_isolation`, "revogação imediata".
3. **Funções em políticas envolvidas em `(select ...)`**, para serem avaliadas uma vez por query e não uma vez por linha.
4. **`organization_id` indexado** como 1.ª coluna de um índice. Testado como invariante.
5. **Grants mínimos e RLS:** são duas camadas independentes. Uma tabela sem grant de escrita não depende só da ausência de política.
6. **`WITH CHECK` em todas as políticas de escrita.** As políticas `FOR SELECT` não aceitam `WITH CHECK` (limitação do Postgres). Nesses casos a escrita fica negada por falta de política e de grant, e há teste que o prova.
7. **`SECURITY DEFINER` só no schema `app`.** Esse schema não está exposto no PostgREST. Todas as funções definer têm `set search_path = ''` e nomes totalmente qualificados, e o `EXECUTE` é revogado de `PUBLIC` explicitamente. Testado como invariante.
8. **Views só com `security_invoker = true`.** Testado como invariante.
9. **`service_role` nunca no frontend nem no repositório.**

## Invariantes do MVP

- **Um consultor = uma organização.** Garantido por um índice único em `organization_members(user_id)`, que é também a chave de idempotência de `app.create_consultant`. Remover na Fase 3, quando houver equipas.

## Matriz de acesso (etapa 1)

| Tabela | anon | authenticated: leitura | authenticated: escrita | service_role |
|---|---|---|---|---|
| `organizations` | — | orgs onde é membro **ativo** | — | total |
| `organization_members` | — | só a própria linha (incluindo se estiver inativo) | — | total |
| `user_profiles` | — | só o próprio | UPDATE de `display_name`, `avatar_url`, `locale` do próprio | total |
| `audit_log` | — | — | — (append-only via funções definer) | total |

| Função | Quem executa |
|---|---|
| `app.user_org_ids()` | authenticated (usada nas políticas) |
| `app.create_consultant()` | service_role (e o owner, no seed) |
| `public.admin_create_consultant()` (INVOKER) | service_role |

## Onboarding de consultores

1. O script de admin chama `supabase.auth.admin.inviteUserByEmail(email)`. O consultor define a própria password e o script nunca gera nem guarda passwords.
2. Depois chama `rpc('admin_create_consultant', { p_user_id, p_email, p_display_name })`.
3. A função é idempotente. Se o passo 2 falhar, repete-se sem duplicar nada. Não reativa membros desativados.
4. Não há trigger em `auth.users`. `raw_user_meta_data` nunca é lido para definir papéis.

No frontend, `signInWithOtp` é sempre chamado com `shouldCreateUser: false`.

## Deployment: passos obrigatórios

> O `supabase/config.toml` **só afeta o ambiente local.** O projeto hospedado tem configuração própria.

Para cada projeto hospedado (staging, produção):

1. Criar o projeto numa **região da UE** (`eu-central-1` Frankfurt ou `eu-west-1` Irlanda). Esta decisão não se pode mudar sem migração.
2. **Desativar o signup:** Dashboard › Authentication › Sign In / Providers › "Allow new users to sign up" = off, e também Email › signup off. Em alternativa: `supabase config push`, revendo o diff.
3. **Verificar** que um signup direto falha:
   ```sh
   curl -s -X POST "$SUPABASE_URL/auth/v1/signup" \
     -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
     -d '{"email":"probe@example.com","password":"probe-password-123"}'
   # esperado: erro "Signups not allowed for this instance"
   ```
4. Confirmar em API Settings que os schemas expostos são só `public`.
5. Definir OTP com 6 dígitos e expiração de 10 minutos, e um template de email que mostre `{{ .Token }}` e não o link.
6. `supabase db push` e depois correr os testes contra a base local equivalente. **Nunca correr o seed em produção.**

## Riscos conhecidos e mitigação

- **Enumeração de emails via OTP** (`shouldCreateUser: false` devolve erro para emails desconhecidos). A UI mostra sempre a mesma mensagem.
- **`inviteUserByEmail` envia um link e não um código.** É aceitável para consultores em desktop. Nos clientes usa-se OTP.
