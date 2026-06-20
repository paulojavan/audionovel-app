# Deploy no Coolify

Este projeto e um app Next.js 16 com Prisma, NextAuth e Stripe. O build de producao usa um servidor Node, entao nao use export estatico.

## Opcao recomendada: Postgres no Coolify

Use esta opcao para producao real.

1. No Coolify, crie um banco PostgreSQL.
2. Altere o provider do Prisma para Postgres antes do deploy:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

3. Crie uma aplicacao a partir do repositorio Git.
4. Use Nixpacks ou Node.js buildpack.
5. Configure:

```bash
Build Command: npm ci && npx prisma generate && npm run build
Start Command: npx prisma db push && npm run start
Port: 3000
```

6. Configure as variaveis de ambiente da aplicacao:

```bash
DATABASE_URL=<connection string do Postgres do Coolify>
NEXTAUTH_URL=https://seu-dominio.com
NEXTAUTH_SECRET=<segredo forte>
GOOGLE_CLIENT_ID=<client id do Google OAuth>
GOOGLE_CLIENT_SECRET=<client secret do Google OAuth>
GOOGLE_ADMIN_EMAILS=<emails admins separados por virgula>
STRIPE_SECRET_KEY=<secret key da Stripe>
STRIPE_WEBHOOK_SECRET=<webhook secret da Stripe>
STRIPE_PREMIUM_PRICE_ID=<price id da assinatura>
DEV_AUTH_BYPASS=false
```

7. No Google OAuth, adicione a URL autorizada:

```text
https://seu-dominio.com/api/auth/callback/google
```

8. Na Stripe, crie um webhook apontando para:

```text
https://seu-dominio.com/api/billing/webhook
```

## Opcao rapida: SQLite com volume persistente

Use apenas se quiser subir rapidamente sem migrar para Postgres.

1. Mantenha o Prisma com `provider = "sqlite"`.
2. No Coolify, crie a aplicacao com Nixpacks ou Node.js buildpack.
3. Configure:

```bash
Build Command: npm ci && npx prisma generate && npm run build
Start Command: npx prisma db push && npm run start
Port: 3000
```

4. Adicione um volume persistente:

```text
/app/data
```

5. Configure:

```bash
DATABASE_URL=file:/app/data/prod.db
NEXTAUTH_URL=https://seu-dominio.com
NEXTAUTH_SECRET=<segredo forte>
GOOGLE_CLIENT_ID=<client id do Google OAuth>
GOOGLE_CLIENT_SECRET=<client secret do Google OAuth>
GOOGLE_ADMIN_EMAILS=<emails admins separados por virgula>
STRIPE_SECRET_KEY=<secret key da Stripe>
STRIPE_WEBHOOK_SECRET=<webhook secret da Stripe>
STRIPE_PREMIUM_PRICE_ID=<price id da assinatura>
DEV_AUTH_BYPASS=false
```

## Verificacao local

Antes de enviar para o Coolify:

```bash
npm run build
```

O build precisa terminar sem erro. Depois do primeiro deploy, confira os logs da aplicacao para confirmar que o `prisma db push` executou e que o Next iniciou na porta 3000.
