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

Comprador de desenvolvimento: `marta.compradora@example.com` (cliente das duas consultoras). Entra por OTP; o código aparece no Mailpit (`http://127.0.0.1:54324`).

## Frontend

```sh
cp .env.example .env.local   # preencher VITE_SUPABASE_PUBLISHABLE_KEY (pnpm supabase status)
pnpm dev                     # http://127.0.0.1:5173
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm types:gen               # depois de alterar migrações
```

O deployment é no Netlify (`netlify.toml`); ver `docs/SECURITY.md` › "Frontend no Netlify".

## Variáveis de ambiente

Ver `.env.example`. A `service_role` key nunca entra no repositório nem no frontend.

## Documentação

- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`: matriz RLS e **passos obrigatórios de deployment**
- `docs/SUBPROCESSORS.md`
