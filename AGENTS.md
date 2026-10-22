# AGENTS.md

## Comandos
- A Supabase CLI é uma devDependency fixada, não está instalada globalmente. Usar sempre os scripts `pnpm db:*` ou `pnpm supabase <comando>`, nunca `supabase` diretamente.
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
- `SECURITY DEFINER` só no schema `app`, sempre com `set search_path = ''` e `revoke execute ... from public`.
- Dados em falta são `NULL`, nunca `0` nem `''`.
- `role`/`status` em `text` com check, não enum.
- Nenhum requisito de segurança é dado como concluído sem um teste que o prove.
- Não acrescentar dependências sem justificação.
- Limites de negócio centralizados em `src/config/limits.ts`.
