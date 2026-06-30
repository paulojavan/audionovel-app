# Recuperação de Senha com AgentMail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enviar links de recuperação de senha em produção pela API AgentMail, mantendo o webhook legado e respostas que não enumeram contas.

**Architecture:** Um módulo focado de entrega montará mensagens texto/HTML e escolherá AgentMail, webhook ou modo local a partir das variáveis disponíveis. O armazenamento de tokens continuará em `password-reset-store.ts`; a rota pública tratará falhas operacionais com resposta genérica e log no servidor.

**Tech Stack:** Next.js 16 Route Handlers, TypeScript, API HTTP AgentMail, Stripe Projects, Node test runner com `tsx`.

---

### Task 1: Provisionar AgentMail com Stripe Projects

**Files:**
- Generated locally and ignored: `.projects/**`
- Generated locally and ignored: `.env*`

- [ ] **Step 1: Initialize the project**

Run: `stripe projects init audio-novel-br --yes`

Expected: projeto inicializado e skill local `stripe-projects-cli` instalada.

- [ ] **Step 2: Read the installed CLI skill**

Read: `.claude/skills/stripe-projects-cli/SKILL.md`

Expected: instruções locais disponíveis para provisionar e sincronizar variáveis.

- [ ] **Step 3: Add AgentMail**

Run: `stripe projects add agentmail/api --json --yes`

Expected: serviço AgentMail gratuito provisionado.

- [ ] **Step 4: Inspect status and environment names**

Run: `stripe projects status --json`

Run: `stripe projects env --json`

Expected: recurso AgentMail saudável e nomes das variáveis disponíveis, sem registrar valores no Git.

### Task 2: Modelar configuração e conteúdo da entrega

**Files:**
- Create: `src/lib/password-reset-delivery.ts`
- Create: `src/lib/password-reset-delivery.test.ts`
- Modify: `src/lib/password-reset-store.ts`

- [ ] **Step 1: Write failing configuration tests**

Cobrir produção sem provedor, AgentMail completo/incompleto, webhook legado e
desenvolvimento sem provedor.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test src/lib/password-reset-delivery.test.ts`

Expected: FAIL porque a nova API de entrega ainda não existe.

- [ ] **Step 3: Implement configuration selection**

Criar `getPasswordResetDeliveryConfig(env)` retornando os modos `agentmail`,
`webhook`, `local` ou `unconfigured`. AgentMail requer simultaneamente
`AGENTMAIL_API_KEY` e `AGENTMAIL_INBOX_ID` e tem prioridade sobre webhook.

- [ ] **Step 4: Write failing message tests**

Cobrir escaping do link no HTML, corpo texto, endpoint codificado, Bearer token,
payload e erro para resposta não `2xx`.

- [ ] **Step 5: Implement AgentMail and webhook delivery**

Usar:

```text
POST https://api.agentmail.to/v0/inboxes/{inboxId}/messages/send
Authorization: Bearer {apiKey}
```

Enviar `to`, `subject`, `text` e `html`. O webhook legado continua recebendo
`to`, `subject` e `resetUrl`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx tsx --test src/lib/password-reset-delivery.test.ts`

Expected: todos PASS.

### Task 3: Integrar entrega sem enumerar contas

**Files:**
- Modify: `src/lib/password-reset-store.ts`
- Modify: `src/app/api/password-reset/request/route.ts`
- Create: `src/lib/password-reset-request.test.ts`

- [ ] **Step 1: Write failing route/error tests**

Testar que falha de provedor é registrada no servidor e que a resposta pública
continua com a mensagem genérica, sem detalhes do AgentMail ou confirmação de
existência da conta.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test src/lib/password-reset-request.test.ts`

Expected: FAIL porque a integração ainda propaga falhas.

- [ ] **Step 3: Integrate the delivery module**

Remover a entrega embutida de `password-reset-store.ts`, chamar o novo módulo
depois de criar o token e tratar falhas na rota com `console.error` e resposta
genérica.

- [ ] **Step 4: Run focused tests**

Run: `npx tsx --test src/lib/password-reset-delivery.test.ts src/lib/password-reset-request.test.ts src/lib/password-reset-token.test.ts`

Expected: todos PASS.

### Task 4: Documentar deploy e verificar

**Files:**
- Modify: `docs/coolify-deploy.md`
- Modify: `.gitignore`

- [ ] **Step 1: Document environment names**

Adicionar `AGENTMAIL_API_KEY` e `AGENTMAIL_INBOX_ID` aos blocos de variáveis do
Coolify e instruir um novo deploy. Não incluir valores.

- [ ] **Step 2: Normalize local tool ignores**

Manter `.projects/`, `.superpowers/`, `.agents/` e arquivos `.env*` fora do Git,
removendo a linha corrompida com bytes nulos já existente em `.gitignore`.

- [ ] **Step 3: Run complete verification**

Run: `npm test`

Run: `npm run lint`

Run: `npm run build`

Expected: comandos com exit code 0. Falhas de conexão com banco durante
prerender podem aparecer como avisos se a Aiven estiver inacessível.

- [ ] **Step 4: Review and commit**

Run: `git diff --check`

Run: `git status --short`

Commit only source, tests, docs and normalized `.gitignore`; never commit
`.projects/`, `.env*`, `.superpowers/` or credential values.
