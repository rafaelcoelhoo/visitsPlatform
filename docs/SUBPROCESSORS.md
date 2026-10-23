# Subprocessadores (rascunho)

| Subprocessador | Finalidade | Dados | Região |
|---|---|---|---|
| Supabase (infraestrutura AWS) | Base de dados, Auth, Storage, Edge Functions | Todos os dados da aplicação | UE: `eu-central-1` ou `eu-west-1` (a confirmar na criação) |
| Resend | Emails transacionais (OTP, convites) | Email e nome do destinatário | A confirmar (região UE) |
| Netlify | Hosting do frontend estático (CDN) | Só ficheiros estáticos; logs de acesso (IP, user agent). Sem dados da aplicação | CDN global; a confirmar o DPA e a retenção de logs |

DPAs formais: adiados para a fase comercial.
