# Arquitetura

## Estado atual (etapa 1)

Até agora só existe a base de dados: identidade, organizações e auditoria. O frontend ainda não foi criado.

## Pastas

```
supabase/
  config.toml            ambiente local (ver SECURITY.md: não afeta o projeto hospedado)
  migrations/            SQL versionado; nunca editar migrações já aplicadas
  seed.sql               dados fictícios locais, via app.create_consultant()
  tests/database/        pgTAP (supabase test db)
  functions/             Edge Functions (a partir da etapa 6)
scripts/admin/           scripts com service_role, executados localmente (etapa 3)
src/                     SPA React (a partir da etapa 3)
  app/  config/  lib/  i18n/  ui/  types/
  features/<feature>/{domain,api,components,routes}
docs/
```

Dependências entre camadas no frontend: `components → api → domain`. `domain/` é TypeScript puro, sem React nem Supabase.

## Modelo de dados

- **`organizations`**: um consultor individual é uma organização de 1 pessoa.
- **`organization_members`**: role e status. Invariante MVP: 1 org por utilizador.
- **`user_profiles`**: a pessoa, global, sem `organization_id` e sem email (a fonte de verdade do email é `auth.users`).
- **`audit_log`**: append-only, só ids.
- **Schema `app`**: funções privilegiadas, não exposto na API.

Esboço das tabelas seguintes: ver o plano aprovado e as próximas migrações.
