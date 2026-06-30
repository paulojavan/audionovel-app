# Recuperação de Senha com AgentMail

## Objetivo

Tornar o fluxo de recuperação de senha funcional em produção, enviando o link
por e-mail via AgentMail e preservando a resposta genérica que evita revelar se
uma conta existe.

## Arquitetura

O projeto enviará e-mails diretamente pela API HTTP do AgentMail, sem adicionar
um SDK. A integração usará:

- `AGENTMAIL_API_KEY`: credencial secreta enviada como Bearer token;
- `AGENTMAIL_INBOX_ID`: endereço ou identificador do inbox remetente;
- `PASSWORD_RESET_WEBHOOK_URL`: fallback compatível com a integração existente.

Em produção, o envio estará configurado quando o par AgentMail estiver completo
ou quando o webhook legado existir. Em desenvolvimento, o link local continuará
disponível sem provedor externo.

## Fluxo

1. A API valida o e-mail e aplica o rate limit existente.
2. A aplicação confirma que há um meio de entrega configurado.
3. Para uma conta válida e não bloqueada, invalida tokens anteriores e cria um
   novo token de uso único com expiração curta.
4. A aplicação envia uma mensagem em texto e HTML com o link de redefinição.
5. A resposta pública permanece genérica, independentemente de a conta existir.

AgentMail terá prioridade quando suas duas variáveis estiverem presentes. O
webhook existente será usado apenas quando AgentMail não estiver configurado.

## Tratamento de falhas e segurança

- A chave da API nunca será enviada ao cliente nem registrada em logs.
- O link será escapado antes de entrar no HTML.
- Respostas não `2xx` do AgentMail serão tratadas como falha de entrega.
- A API não devolverá detalhes do provedor nem indicará se o e-mail pertence a
  uma conta.
- Falhas operacionais serão registradas no servidor para diagnóstico.
- O token continuará armazenado somente como hash e será invalidado após uso.

## Provisionamento e deploy

O AgentMail será provisionado pelo Stripe Projects. O CLI será a fonte de
verdade para credenciais locais; valores secretos não serão incluídos no Git.

O Coolify precisará receber `AGENTMAIL_API_KEY` e `AGENTMAIL_INBOX_ID` como
variáveis de ambiente e executar um novo deploy. A documentação de deploy será
atualizada com os nomes das variáveis, nunca com os valores.

## Testes e verificação

Os testes devem cobrir:

- produção sem provedor configurado;
- configuração AgentMail completa e incompleta;
- prioridade do AgentMail sobre o webhook;
- formato da requisição, autenticação e conteúdo texto/HTML;
- falha em resposta não `2xx`;
- manutenção do fallback webhook e do modo local.

A verificação final executará testes, lint e build. Um envio real só será feito
para um endereço explicitamente autorizado pelo usuário.
