export const ptPT = {
  app: {
    name: 'VisitBook',
    tagline: 'As suas impressões das visitas, comparadas.',
    loading: 'A carregar…',
    startupError: 'Não foi possível iniciar a aplicação: configuração inválida.',
  },
  a11y: {
    skipToContent: 'Saltar para o conteúdo',
  },
  notFound: {
    title: 'Página não encontrada',
    body: 'O endereço que abriu não existe.',
    home: 'Ir para o início',
  },
  auth: {
    login: {
      title: 'Entrar',
      email: 'Email',
      password: 'Password',
      submit: 'Entrar',
      submitting: 'A entrar…',
    },
    setPassword: {
      title: 'Definir password',
      intro: 'Escolha uma password para a sua conta.',
      password: 'Nova password',
      confirm: 'Confirmar password',
      hint: 'Pelo menos {{min}} caracteres. Pode usar uma frase.',
      submit: 'Guardar password',
      submitting: 'A guardar…',
      invalidLink: 'Este link expirou ou já foi usado. Peça um novo convite.',
      toLogin: 'Ir para a entrada',
    },
    errors: {
      emailRequired: 'Indique o email.',
      emailInvalid: 'Indique um email válido, por exemplo nome@exemplo.pt.',
      passwordRequired: 'Indique a password.',
      passwordTooShort: 'A password é demasiado curta.',
      passwordMismatch: 'As passwords não coincidem.',
    },
    failure: {
      invalidCredentials: 'Email ou password incorretos.',
      rateLimited: 'Demasiadas tentativas. Aguarde um momento e tente de novo.',
      network: 'Sem ligação. Verifique a rede e tente de novo.',
      weakPassword: 'Password demasiado fraca. Escolha outra.',
      samePassword: 'A nova password tem de ser diferente da atual.',
      unknown: 'Não foi possível concluir. Tente de novo.',
    },
    signOut: 'Terminar sessão',
  },
  home: {
    greeting: 'Olá, {{name}}',
    loadError: 'Não foi possível carregar a sua conta.',
    retry: 'Tentar de novo',
    inactive: {
      title: 'Acesso desativado',
      body: 'O seu acesso a esta organização foi desativado. Contacte quem o convidou.',
    },
    noAccess: {
      title: 'Conta sem acesso de consultor',
      body: 'Esta conta não tem acesso de consultor.',
    },
  },
} as const
