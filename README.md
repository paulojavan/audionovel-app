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
- `PRISMA_CONNECTION_LIMIT`: override opcional do pool por processo do Next.js. Sem ele, a aplicação preserva `connection_limit` da `DATABASE_URL`; se nenhum dos dois existir, usa `3`.
- `NEXTAUTH_SECRET`: segredo forte da sessão e do hash de rate limit.
- `RATE_LIMIT_SECRET`: segredo opcional dedicado ao hash de rate limit; se ausente, usa `NEXTAUTH_SECRET`.
- `TRUSTED_PROXY_IP_HEADER`: cabeçalho de IP sanitizado pelo proxy (`x-real-ip`, `cf-connecting-ip` ou `x-forwarded-for`). Sem ele, limites anônimos por IP são desativados em produção para não bloquear todos os usuários no mesmo bucket; limites por conta/e-mail continuam ativos.
- `APP_ORIGIN` (preferencial) ou `NEXTAUTH_URL`: origem pública HTTPS. Em produção, cabeçalhos `Host` enviados pelo cliente nunca são usados para gerar links; na ausência da variável, o domínio oficial `https://audionovelbr.com.br` é usado como contingência.
- `MEDIA_URL_ALLOWED_HOSTS`: hosts adicionais autorizados a fornecer áudio, separados por vírgula.
- `IMAGE_URL_ALLOWED_HOSTS`: hosts adicionais autorizados a fornecer capas, separados por vírgula.
- `MERCADO_PAGO_ACCESS_TOKEN`: credencial privada da API.
- `MERCADO_PAGO_WEBHOOK_SECRET`: segredo de assinatura do webhook.
- `AGENTMAIL_API_KEY` e `AGENTMAIL_INBOX_ID`: entrega de recuperação de senha.

O seed não contém senhas padrão. Para executá-lo em desenvolvimento, defina `SEED_ADMIN_PASSWORD` e `SEED_DEMO_PASSWORD` (mínimo de 12 caracteres). Em produção ele é bloqueado; uma carga deliberada exige também `ALLOW_PRODUCTION_SEED=true`.

Exemplo de allowlists, sem credenciais:

```dotenv
MEDIA_URL_ALLOWED_HOSTS=audio.exemplo.com
IMAGE_URL_ALLOWED_HOSTS=imagens.exemplo.com,images.unsplash.com
```

O navegador recebe somente URLs locais como `/api/chapters/:id/audio`. A URL real do áudio permanece no banco e é buscada pelo servidor depois da autorização. Range requests usam pequenas reservas no rate limit compartilhado, reduzindo gravações sem perder a proteção entre instâncias.
Os hosts exatos usados atualmente no banco já fazem parte da allowlist; use as variáveis acima somente ao adicionar um novo provedor.

## Banco de dados

Após implantar esta versão no PostgreSQL existente, aplique uma vez:

```bash
npx prisma db execute --file prisma/aiven-2026-07-01-security-hardening.sql
npx prisma db execute --file prisma/aiven-2026-07-28-billing-intent-snapshots.sql
```

Os scripts criam a tabela compartilhada de rate limit, os índices de recuperação de senha e os snapshots imutáveis usados para validar pagamentos. Downloads offline são criptografados e vinculados ao ID da mesma conta; sair da conta não os transfere para outro usuário.
