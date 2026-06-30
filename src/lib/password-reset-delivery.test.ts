import assert from "node:assert/strict";
import test from "node:test";
import {
  deliverPasswordResetLink,
  deliverPasswordResetLinkSafely,
  getPasswordResetDeliveryConfig,
} from "./password-reset-delivery";

test("producao sem provedor fica sem entrega configurada", () => {
  assert.deepEqual(
    getPasswordResetDeliveryConfig({ NODE_ENV: "production" }),
    { mode: "unconfigured" },
  );
});

test("AgentMail exige chave e inbox e tem prioridade sobre webhook", () => {
  assert.deepEqual(
    getPasswordResetDeliveryConfig({
      NODE_ENV: "production",
      AGENTMAIL_API_KEY: "secret",
    }),
    { mode: "unconfigured" },
  );
  assert.deepEqual(
    getPasswordResetDeliveryConfig({
      NODE_ENV: "production",
      AGENTMAIL_API_KEY: "secret",
      AGENTMAIL_INBOX_ID: "audio-novel@agentmail.to",
      PASSWORD_RESET_WEBHOOK_URL: "https://example.com/reset",
    }),
    {
      mode: "agentmail",
      apiKey: "secret",
      inboxId: "audio-novel@agentmail.to",
    },
  );
});

test("webhook legado e desenvolvimento continuam suportados", () => {
  assert.deepEqual(
    getPasswordResetDeliveryConfig({
      NODE_ENV: "production",
      PASSWORD_RESET_WEBHOOK_URL: "https://example.com/reset",
    }),
    { mode: "webhook", webhookUrl: "https://example.com/reset" },
  );
  assert.deepEqual(
    getPasswordResetDeliveryConfig({ NODE_ENV: "development" }),
    { mode: "local" },
  );
});

test("AgentMail recebe endpoint, autenticacao e mensagem texto e HTML", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;

  await deliverPasswordResetLink({
    email: "leitor@example.com",
    resetUrl: "https://audionovelbr.qzz.io/redefinir-senha?token=a&b=<segredo>",
    config: {
      mode: "agentmail",
      apiKey: "am_secret",
      inboxId: "audio-novel@agentmail.to",
    },
    fetchImpl: async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(null, { status: 200 });
    },
  });

  assert.equal(
    capturedUrl,
    "https://api.agentmail.to/v0/inboxes/audio-novel%40agentmail.to/messages/send",
  );
  assert.equal(
    (capturedInit?.headers as Record<string, string>).authorization,
    "Bearer am_secret",
  );

  const payload = JSON.parse(String(capturedInit?.body)) as {
    to: string;
    subject: string;
    text: string;
    html: string;
  };
  assert.equal(payload.to, "leitor@example.com");
  assert.match(payload.subject, /Recuperacao de senha/);
  assert.match(payload.text, /token=a&b=<segredo>/);
  assert.match(payload.html, /token=a&amp;b=&lt;segredo&gt;/);
});

test("resposta nao 2xx do AgentMail falha sem expor o corpo", async () => {
  await assert.rejects(
    deliverPasswordResetLink({
      email: "leitor@example.com",
      resetUrl: "https://audionovelbr.qzz.io/redefinir-senha?token=abc",
      config: {
        mode: "agentmail",
        apiKey: "am_secret",
        inboxId: "audio-novel@agentmail.to",
      },
      fetchImpl: async () =>
        new Response("detalhe secreto do provedor", { status: 403 }),
    }),
    /PASSWORD_RESET_DELIVERY_FAILED:403/,
  );
});

test("entrega segura registra falha e preserva resposta generica", async () => {
  const loggedMessages: string[] = [];

  const delivered = await deliverPasswordResetLinkSafely({
    email: "leitor@example.com",
    resetUrl: "https://audionovelbr.qzz.io/redefinir-senha?token=abc",
    config: {
      mode: "agentmail",
      apiKey: "am_secret",
      inboxId: "audio-novel@agentmail.to",
    },
    fetchImpl: async () => new Response(null, { status: 503 }),
    logError: (message) => loggedMessages.push(message),
  });

  assert.equal(delivered, false);
  assert.deepEqual(loggedMessages, [
    "[password-reset] PASSWORD_RESET_DELIVERY_FAILED:503",
  ]);
});
