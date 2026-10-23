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

## Matriz de acesso (etapas 1 a 4a)

Uma conta pode ser consultor numa org e comprador noutra. As políticas permissivas somam-se (OR); o frontend filtra sempre por `organization_id` da org ativa.

| Tabela | anon | authenticated: leitura | authenticated: escrita | service_role |
|---|---|---|---|---|
| `organizations` | — | orgs onde é membro **ativo**; orgs onde tem ligação de cliente **ativa** | — | total |
| `organization_members` | — | a própria linha (incluindo inativa); membros **ativos** das orgs onde tem ligação de cliente ativa | — | total |
| `user_profiles` | — | só o próprio. Nem o consultor lê o perfil do seu cliente | UPDATE de `display_name`, `avatar_url`, `locale` do próprio | total |
| `audit_log` | — | — | — (append-only via funções definer) | total |
| `clients` | — | membros ativos: os da sua org. Comprador: só o seu registo (ligação ativa) | membros ativos: INSERT (`organization_id`, `name`, `email`, `phone`), UPDATE (`name`, `email`, `phone`, `archived_at`), DELETE, na sua org. `organization_id` é imutável | total |
| `properties` | — | membros ativos: os da sua org. O comprador **não** lê imóveis (acesso virá com os roteiros) | membros ativos: INSERT (`organization_id`, `title`, `price_eur`, `location_text`, `typology`, `area_m2`, `monthly_charges_eur`), UPDATE (os mesmos, sem `organization_id`, mais `archived_at`). Sem DELETE: arquivar | total |
| `property_images` | — | membros ativos: as da sua org | membros ativos: INSERT (`property_id`, `organization_id`, `slot`; sempre `pending`), UPDATE só de `status` `pending -> ready`. Sem DELETE: só a Edge Function (service_role) | total |
| `storage.objects` (bucket `property-images`) | sem acesso | membros ativos: objetos que correspondam a uma reserva da sua org | INSERT só do caminho de uma reserva `pending` da sua org. Sem UPDATE/DELETE | total |
| `client_links` | — | membros ativos: as da sua org. Comprador: as suas (ativas) | só o comprador, UPDATE de `last_seen_at` nas suas. Convite, aceitação e revogação: Edge Function (service_role) | total |

Exposição conhecida e aceite: o comprador, ao ler `organizations` e `organization_members` da org onde está ligado, vê também `created_by`, `user_id`, `role` e `created_at` do consultor (UUIDs e metadados, sem email). Restringir por coluna obrigaria `select` explícito em todas as queries da app; revisitar na Fase 3, quando houver equipas.

Eliminar a conta (`auth.users`) apaga as suas `client_links` (cascade) mas não o registo `clients`, que é dado da organização. O apagamento do cliente na org e dos dados que ele gerou entra na etapa de RGPD.

| Função | Quem executa |
|---|---|
| `app.user_org_ids()` | authenticated (usada nas políticas) |
| `app.user_client_ids()`, `app.user_client_org_ids()` | authenticated (usadas nas políticas; só ligações `active`) |
| `public.reserve_property_image(property_id)` (INVOKER) | authenticated; o RLS do chamador aplica-se |
| `app.property_images_confirm_guard()` (trigger) | ninguém executa diretamente |
| `app.create_consultant()` | service_role (e o owner, no seed) |
| `public.admin_create_consultant()` (INVOKER) | service_role |

## Fotografias

Padrão **reservar -> carregar -> confirmar -> reconciliar**:

1. **Reservar:** `rpc('reserve_property_image', { p_property_id })` insere em `property_images` o primeiro slot livre (`pending`) e devolve a linha com o `storage_path`, que é gerado pelo servidor (`{org}/{imóvel}/{id}.webp`) e não é definível pelo cliente.
2. **Carregar:** `storage.upload(storage_path)`. A política só aceita caminhos de reservas `pending` da própria org, o bucket é privado, aceita só `image/webp` e até 1 MiB.
3. **Confirmar:** `update status = 'ready'`. O trigger só deixa se o objeto existe no bucket com `mimetype = image/webp`.
4. **Reconciliar:** job de limpeza (pg_cron + Edge Function), **ainda por implementar (etapa 4b)**.

O limite de 8 fotos é do Postgres: `check (slot between 1 and 8)` e `unique (property_id, slot)`. `reserve_property_image` tenta cada slot numa subtransação e, sob concorrência, quem perde recebe `unique_violation` e tenta o seguinte; sem slot livre devolve `photo_limit_reached`. Provado com ligações paralelas reais (`pnpm test:integration`): 12 reservas simultâneas dão exatamente os slots 1..8 e 4 recusas, em 5 rondas.

Lacunas conhecidas até à etapa 4b:
- O `mimetype` verificado ao confirmar é o **declarado** no upload (forjável). A validação por **magic bytes** vai para a Edge Function.
- Não há apagar fotos (nem imóveis) pela aplicação: sem DELETE direto, por desenho. A Edge Function valida a permissão, apaga a linha e o ficheiro.
- Ficheiros órfãos (reserva `pending` sem upload, upload sem confirmação) ficam até existir o job de limpeza.
- Signed URLs: TTL de `LIMITS.photos.signedUrlTtlSeconds` (10 min). Quem os partilhar dá acesso até expirarem.
- O comprador ainda não lê imóveis nem fotos; o acesso vem com os roteiros (etapa 7), com testes de isolamento entre compradores.

## Onboarding de consultores

`pnpm admin:create-consultant --email ana@exemplo.pt --name "Ana Martins" [--org-name "Imobiliária X"] [--yes]`, com `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` exportadas na shell (nunca em ficheiros). Para um URL que não seja local, o script exige `--yes`.

1. O script chama `supabase.auth.admin.inviteUserByEmail(email)` com `redirectTo` = `{SITE_URL}/definir-password`. O consultor define a própria password nessa página; o script nunca gera nem guarda passwords.
2. Depois chama `rpc('admin_create_consultant', { p_user_id, p_email, p_display_name })`.
3. É idempotente: repetir com um convite por aceitar reenvia o email e devolve a mesma organização; com um utilizador já confirmado não envia nada e devolve a mesma organização. Não reativa membros desativados.
4. Não há trigger em `auth.users`. `raw_user_meta_data` nunca é lido para definir papéis.
5. O script só imprime ids (`user_id`, `organization_id`); não imprime emails nem chaves.

Verificado de ponta a ponta contra o Supabase local: convite, link do email, password curta rejeitada (mínimo 12), login, leitura via RLS só da própria org e do próprio perfil, `audit_log` negado.

No frontend, `signInWithOtp` é sempre chamado com `shouldCreateUser: false`.

## Deployment: passos obrigatórios

> O `supabase/config.toml` **só afeta o ambiente local.** O projeto hospedado tem configuração própria.

Para cada projeto hospedado (staging, produção):

1. Criar o projeto numa **região da UE** (`eu-central-1` Frankfurt ou `eu-west-1` Irlanda). Esta decisão não se pode mudar sem migração.
2. **Desativar o registo público, mantendo o fornecedor de email ATIVO.** Dashboard › Authentication › Sign In / Providers › "Allow new users to sign up" = **off** (interruptor global), e o fornecedor **Email = enabled**. Atenção: desativar o próprio fornecedor de email (em `config.toml`, `[auth.email] enable_signup = false`) não corta só o registo: corta também o login por password e o OTP (`422 email_provider_disabled`, verificado). Em alternativa: `supabase config push`, revendo o diff.
   Depois de alterar `config.toml` localmente, `db:reset` não chega: é preciso `pnpm db:stop && pnpm db:start` para o contentor de auth reler a configuração.
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
