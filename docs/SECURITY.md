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

## Matriz de acesso (etapas 1 e 2)

Uma conta pode ser consultor numa org e comprador noutra. As políticas permissivas somam-se (OR); o frontend filtra sempre por `organization_id` da org ativa.

| Tabela | anon | authenticated: leitura | authenticated: escrita | service_role |
|---|---|---|---|---|
| `organizations` | — | orgs onde é membro **ativo**; orgs onde tem ligação de cliente **ativa** | — | total |
| `organization_members` | — | a própria linha (incluindo inativa); membros **ativos** das orgs onde tem ligação de cliente ativa | — | total |
| `user_profiles` | — | só o próprio. Nem o consultor lê o perfil do seu cliente | UPDATE de `display_name`, `avatar_url`, `locale` do próprio | total |
| `audit_log` | — | — | — (append-only via funções definer) | total |
| `clients` | — | membros ativos: os da sua org. Comprador: só o seu registo (ligação ativa) | membros ativos: INSERT (`organization_id`, `name`, `email`, `phone`), UPDATE (`name`, `email`, `phone`, `archived_at`), DELETE, na sua org. `organization_id` é imutável | total |
| `client_links` | — | membros ativos: as da sua org. Comprador: as suas (ativas) | só o comprador, UPDATE de `last_seen_at` nas suas. Convite, aceitação e revogação: Edge Function (service_role) | total |

Exposição conhecida e aceite: o comprador, ao ler `organizations` e `organization_members` da org onde está ligado, vê também `created_by`, `user_id`, `role` e `created_at` do consultor (UUIDs e metadados, sem email). Restringir por coluna obrigaria `select` explícito em todas as queries da app; revisitar na Fase 3, quando houver equipas.

Eliminar a conta (`auth.users`) apaga as suas `client_links` (cascade) mas não o registo `clients`, que é dado da organização. O apagamento do cliente na org e dos dados que ele gerou entra na etapa de RGPD.

| Função | Quem executa |
|---|---|
| `app.user_org_ids()` | authenticated (usada nas políticas) |
| `app.user_client_ids()`, `app.user_client_org_ids()` | authenticated (usadas nas políticas; só ligações `active`) |
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
     -H "apikey: $SUPABASE_PUBLISHABLE_KEY" -H "Content-Type: application/json" \
     -d '{"email":"probe@example.com","password":"probe-password-123"}'
   # esperado: erro "Signups not allowed for this instance"
   ```
4. Confirmar em API Settings que os schemas expostos são só `public`.
5. Definir OTP com 6 dígitos e expiração de 10 minutos, e um template de email que mostre `{{ .Token }}` e não o link.
6. `supabase db push` e depois correr os testes contra a base local equivalente. **Nunca correr o seed em produção.**

### Frontend no Netlify

1. Ligar o repositório. O build usa `netlify.toml` (`pnpm build`, `dist`, Node 22).
2. Variáveis de ambiente, por contexto: **Production** aponta para o projeto Supabase de produção; **Deploy previews** e **Branch deploys** apontam para um projeto de **staging**, nunca para produção. Só `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. A `service_role` não é variável do Netlify.
3. `SECRETS_SCAN_OMIT_KEYS` já está em `netlify.toml` para essas duas chaves públicas. Não alargar a lista a mais nada.
4. Supabase › Authentication › URL Configuration: *Site URL* = URL de produção; *Redirect URLs* = esse URL. No projeto de **staging**, acrescentar `https://deploy-preview-*--<site>.netlify.app/**`. Nunca wildcards no projeto de produção.
5. Verificar num deploy preview, antes de ir para produção:
   ```sh
   curl -sI https://<deploy>/ | grep -iE 'content-security-policy|x-content-type|referrer|permissions'
   curl -sI https://<deploy>/assets/<ficheiro>.js | grep -i cache-control   # immutable
   curl -sI https://<deploy>/index.html | grep -i cache-control             # no-cache
   curl -s -o /dev/null -w '%{http_code}\n' https://<deploy>/uma/rota/qualquer  # 200 (SPA)
   ```
6. A CSP usa `https://*.supabase.co` em `connect-src` e `img-src`. Depois de criar o projeto, restringir ao URL exato `https://<ref>.supabase.co`.
7. `browser-image-compression` carrega por omissão o script do worker a partir de uma CDN (jsdelivr). Isso violaria a CSP e acrescentaria um terceiro. Resolver na etapa das fotos (`libURL` local ou `useWebWorker: false`); **não** abrir a CSP à CDN.

## Riscos conhecidos e mitigação

- **Enumeração de emails via OTP.** Verificado na base local: `POST /auth/v1/otp` com `create_user: false` devolve `422 otp_disabled` para emails desconhecidos e `200` para conhecidos. A UI tem de mostrar sempre a mesma mensagem ("Se o email estiver registado, enviámos um código"), mesmo quando o pedido falha com 422.
- **`inviteUserByEmail` envia um link e não um código.** É aceitável para consultores em desktop. Nos clientes usa-se OTP.
