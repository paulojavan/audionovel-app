# Audio Novel BR

Aplicação Next.js com Prisma/PostgreSQL para publicação e reprodução de áudio novels.

## Desenvolvimento

```bash
npm install
npm run prisma:generate
npm run dev
```

Antes de enviar mudanças:

```bash
npm test
npm run lint
npm run build
```

## Configuração de segurança

Segredos devem existir apenas nas variáveis do servidor. Nunca use prefixo `NEXT_PUBLIC_` em chaves do banco, autenticação, e-mail ou pagamento.

Variáveis obrigatórias ou recomendadas em produção:

- `DATABASE_URL`: conexão PostgreSQL usada pelo Prisma.
- `NEXTAUTH_SECRET`: segredo forte da sessão e do hash de rate limit.
- `RATE_LIMIT_SECRET`: segredo opcional dedicado ao hash de rate limit; se ausente, usa `NEXTAUTH_SECRET`.
- `NEXTAUTH_URL`: origem pública HTTPS.
- `MEDIA_URL_ALLOWED_HOSTS`: hosts adicionais autorizados a fornecer áudio, separados por vírgula.
- `IMAGE_URL_ALLOWED_HOSTS`: hosts adicionais autorizados a fornecer capas, separados por vírgula.
- `MERCADO_PAGO_ACCESS_TOKEN`: credencial privada da API.
- `MERCADO_PAGO_WEBHOOK_SECRET`: segredo de assinatura do webhook.
- `AGENTMAIL_API_KEY` e `AGENTMAIL_INBOX_ID`: entrega de recuperação de senha.

Exemplo de allowlists, sem credenciais:

```dotenv
MEDIA_URL_ALLOWED_HOSTS=audio.exemplo.com
IMAGE_URL_ALLOWED_HOSTS=imagens.exemplo.com,images.unsplash.com
```

O navegador recebe somente URLs locais como `/api/chapters/:id/audio`. A URL real do áudio permanece no banco e é buscada pelo servidor depois da autorização.
Os hosts exatos usados atualmente no banco já fazem parte da allowlist; use as variáveis acima somente ao adicionar um novo provedor.

## Banco de dados

Após implantar esta versão no PostgreSQL existente, aplique uma vez:

```bash
npx prisma db execute --file prisma/aiven-2026-07-01-security-hardening.sql
```

O script cria a tabela compartilhada de rate limit e os índices usados na recuperação de senha. Downloads offline são criptografados e vinculados ao ID da mesma conta; sair da conta não os transfere para outro usuário.
