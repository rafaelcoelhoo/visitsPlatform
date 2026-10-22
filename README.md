# VisitBook

Os compradores registam impressões das visitas a imóveis. O consultor vê sinais (interesse, dúvidas), não as notas.

## Pré-requisitos

- Node ≥ 22 e pnpm 9
- Docker (Docker Desktop ou OrbStack)
- Supabase CLI: vem como devDependency fixada (`pnpm install`). Não é preciso instalação global. Para comandos avulsos: `pnpm supabase <comando>`.

## Base de dados local

```sh
pnpm install
pnpm db:start     # arranca os containers (migrações + seed)
pnpm db:reset     # recria a base: migrações + seed
pnpm db:test      # testes pgTAP (RLS, invariantes)
pnpm db:lint
pnpm db:stop
```

Utilizadores de desenvolvimento (fictícios, só local), password `visitbook-dev-1234`:
- `ana.consultora@example.com`
- `joao.consultor@example.com`

## Variáveis de ambiente

Ver `.env.example`. A `service_role` key nunca entra no repositório.

## Documentação

- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`: matriz RLS e **passos obrigatórios de deployment**
- `docs/SUBPROCESSORS.md`
