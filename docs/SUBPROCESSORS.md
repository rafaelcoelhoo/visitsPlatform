# Subprocessadores (rascunho)

| Subprocessador | Finalidade | Dados | Região |
|---|---|---|---|
| Supabase (infraestrutura AWS) | Base de dados, Auth, Storage, Edge Functions | Todos os dados da aplicação | UE: `eu-central-1` ou `eu-west-1` (a confirmar na criação) |
| Resend | Emails transacionais (OTP, convites) | Email e nome do destinatário | A confirmar (região UE) |
| Netlify ou Cloudflare Pages (a decidir) | Hosting do frontend estático | Logs de acesso (IP, user agent) | A confirmar |

DPAs formais: adiados para a fase comercial.
