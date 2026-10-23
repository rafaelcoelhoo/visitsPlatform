# Arquitetura

## Estado atual (etapa 2)

Base de dados: identidade, organizações, clientes e auditoria. Frontend: apenas o esqueleto (Vite, React 18, TypeScript strict, Tailwind, Radix, i18n, Vitest), sem ecrãs de produto.

## Pastas

```
supabase/
  config.toml            ambiente local (ver SECURITY.md: não afeta o projeto hospedado)
  migrations/            SQL versionado; nunca editar migrações já aplicadas
  seed.sql               dados fictícios locais, via app.create_consultant()
  tests/database/        pgTAP (supabase test db)
scripts/integration/     testes por HTTP com ligações paralelas reais (concorrência, Storage); só contra o Supabase local
  functions/             Edge Functions (Deno): confirm-property-image, delete-property-image, reconcile-property-images
    _shared/             lógica pura e tipada (webp, confirm, delete, reconcile) + testes Vitest; espelho dos limites
    _deno/               ligação ao runtime Deno (clientes Supabase, autenticação); fora do tsc
    dev.env              segredos de desenvolvimento local (não são reais)
scripts/admin/           scripts com service_role, executados localmente (Node corre .ts diretamente; sem dependências extra)
src/                     SPA React (a partir da etapa 3)
  app/  config/  lib/  i18n/  ui/  types/  test/
  features/auth/{domain,api,components,routes}   sessão, login por password, definir password
  features/<feature>/{domain,api,components,routes}
docs/
```

Dependências entre camadas no frontend: `components → api → domain`. `domain/` é TypeScript puro, sem React nem Supabase.

## Modelo de dados

- **`organizations`**: um consultor individual é uma organização de 1 pessoa.
- **`organization_members`**: role e status. Invariante MVP: 1 org por utilizador.
- **`user_profiles`**: a pessoa, global, sem `organization_id` e sem email (a fonte de verdade do email é `auth.users`).
- **`clients`**: a relação da org com uma pessoa (nome, email, telefone). Email único por org, sem distinção de maiúsculas.
- **`client_links`**: liga `clients.id` a uma conta (`user_id`) quando o convite é aceite. FK composta `(client_id, organization_id)` impede ligações cruzadas entre orgs.
- **`properties`**: o imóvel (só o título é obrigatório; o resto é `NULL` quando desconhecido). Sem DELETE: arquiva-se.
- **`property_images`**: até 8 por imóvel (`slot` 1..8, único por imóvel), `pending -> ready`. FK composta `(property_id, organization_id)`.
- **Storage**: bucket privado `property-images`, só `image/webp`, 1 MiB. Confirmar e apagar fotos só por Edge Functions; job `pg_cron` de reconciliação.
- **`audit_log`**: append-only, só ids.
- **Schema `app`**: funções privilegiadas, não exposto na API.

Esboço das tabelas seguintes: ver o plano aprovado e as próximas migrações.
