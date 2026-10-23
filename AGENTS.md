# AGENTS.md

## Comandos
- A Supabase CLI é uma devDependency fixada, não está instalada globalmente. Usar sempre os scripts `pnpm db:*` ou `pnpm supabase <comando>`, nunca `supabase` diretamente.
- `pnpm dev`: servidor de desenvolvimento (precisa de `.env.local`; ver `.env.example`)
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`: têm de passar antes de qualquer commit que toque em `src/`
- `pnpm types:gen`: regenera `src/types/database.ts` a partir da base local; correr depois de qualquer migração (o CI falha se estiver desatualizado)
- `pnpm db:start` / `pnpm db:stop`
- `pnpm db:reset`: aplica as migrações e o seed na base local
- `pnpm db:test`: pgTAP; tem de passar antes de qualquer commit que toque em `supabase/`
- `pnpm db:lint`

## Regras
- Trabalho por etapas pequenas; parar e esperar validação no fim de cada etapa.
- Toda a tabela nova em `public`:
  - RLS ativo;
  - índice com `organization_id` como 1.ª coluna (se for tenant-scoped);
  - grants explícitos;
  - `WITH CHECK` em todas as políticas de escrita;
  - testes pgTAP de isolamento.
- Políticas com arrays de funções: escrever `x = any ((select f())::uuid[])`. Sem o cast, o Postgres lê `any ((select ...))` como subconsulta de linhas e falha com `uuid = uuid[]`.
- `SECURITY DEFINER` só no schema `app`, sempre com `set search_path = ''` e `revoke execute ... from public`.
- Dados em falta são `NULL`, nunca `0` nem `''`.
- `role`/`status` em `text` com check, não enum.
- Nenhum requisito de segurança é dado como concluído sem um teste que o prove.
- Não acrescentar dependências sem justificação. Versões fixas (`-E`), publicadas há pelo menos 7 dias. React fica na 18 (o `react-router` fica na 7; a 8 exige React 19), TypeScript na 6 e ESLint na 9 (limites de `typescript-eslint` e `eslint-plugin-jsx-a11y`).
- Frontend: camadas `components → api → domain`; `domain/` é TypeScript puro. Textos só em `src/i18n/pt-PT.ts`, nunca literais em JSX. `import.meta.env` só passa por `src/config/env.ts`.
- Nunca `VITE_*` com segredos. O código recusa qualquer variável `VITE_*service_role*`.
- Limites de negócio centralizados em `src/config/limits.ts`.
