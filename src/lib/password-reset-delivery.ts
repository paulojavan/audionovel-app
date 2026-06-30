type PasswordResetDeliveryEnv = {
  NODE_ENV?: string;
  AGENTMAIL_API_KEY?: string;
  AGENTMAIL_INBOX_ID?: string;
  PASSWORD_RESET_WEBHOOK_URL?: string;
};

export type PasswordResetDeliveryConfig =
  | { mode: "agentmail"; apiKey: string; inboxId: string }
  | { mode: "webhook"; webhookUrl: string }
  | { mode: "local" }
  | { mode: "unconfigured" };

type DeliverPasswordResetLinkOptions = {
  email: string;
  resetUrl: string;
  config?: PasswordResetDeliveryConfig;
  fetchImpl?: typeof fetch;
};

type DeliverPasswordResetLinkSafelyOptions =
  DeliverPasswordResetLinkOptions & {
    logError?: (message: string) => void;
  };

const PASSWORD_RESET_SUBJECT = "Recuperacao de senha - Audio Novel BR";

export function getPasswordResetDeliveryConfig(
  env: PasswordResetDeliveryEnv = process.env,
): PasswordResetDeliveryConfig {
  if (env.AGENTMAIL_API_KEY && env.AGENTMAIL_INBOX_ID) {
    return {
      mode: "agentmail",
      apiKey: env.AGENTMAIL_API_KEY,
      inboxId: env.AGENTMAIL_INBOX_ID,
    };
  }

  if (env.PASSWORD_RESET_WEBHOOK_URL) {
    return {
      mode: "webhook",
      webhookUrl: env.PASSWORD_RESET_WEBHOOK_URL,
    };
  }

  if (env.NODE_ENV !== "production") {
    return { mode: "local" };
  }

  return { mode: "unconfigured" };
}

export async function deliverPasswordResetLink({
  email,
  resetUrl,
  config = getPasswordResetDeliveryConfig(),
  fetchImpl = fetch,
}: DeliverPasswordResetLinkOptions) {
  if (config.mode === "unconfigured") {
    throw new Error("PASSWORD_RESET_DELIVERY_NOT_CONFIGURED");
  }

  if (config.mode === "local") {
    console.info(`[password-reset] Link para ${email}: ${resetUrl}`);
    return;
  }

  if (config.mode === "webhook") {
    const response = await fetchImpl(config.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        to: email,
        subject: PASSWORD_RESET_SUBJECT,
        resetUrl,
      }),
    });

    assertDeliveryResponse(response);
    return;
  }

  const escapedResetUrl = escapeHtml(resetUrl);
  const response = await fetchImpl(
    `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(config.inboxId)}/messages/send`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        to: email,
        subject: PASSWORD_RESET_SUBJECT,
        text: [
          "Recebemos uma solicitacao para redefinir sua senha no Audio Novel BR.",
          "",
          `Abra este link para escolher uma nova senha: ${resetUrl}`,
          "",
          "Se voce nao solicitou esta alteracao, ignore este e-mail.",
        ].join("\n"),
        html: [
          "<p>Recebemos uma solicitacao para redefinir sua senha no Audio Novel BR.</p>",
          `<p><a href="${escapedResetUrl}">Escolher uma nova senha</a></p>`,
          `<p>${escapedResetUrl}</p>`,
          "<p>Se voce nao solicitou esta alteracao, ignore este e-mail.</p>",
        ].join(""),
      }),
    },
  );

  assertDeliveryResponse(response);
}

export async function deliverPasswordResetLinkSafely({
  logError = console.error,
  ...deliveryOptions
}: DeliverPasswordResetLinkSafelyOptions) {
  try {
    await deliverPasswordResetLink(deliveryOptions);
    return true;
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "PASSWORD_RESET_DELIVERY_FAILED:UNKNOWN";
    logError(`[password-reset] ${message}`);
    return false;
  }
}

function assertDeliveryResponse(response: Response) {
  if (!response.ok) {
    throw new Error(`PASSWORD_RESET_DELIVERY_FAILED:${response.status}`);
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
