const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "10minutemail.net",
  "20minutemail.com",
  "33mail.com",
  "anonaddy.com",
  "dispostable.com",
  "fakeinbox.com",
  "getnada.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "maildrop.cc",
  "mailinator.com",
  "mailnesia.com",
  "mintemail.com",
  "mohmal.com",
  "sharklasers.com",
  "tempmail.com",
  "tempmail.net",
  "temp-mail.org",
  "throwawaymail.com",
  "trashmail.com",
  "yopmail.com",
]);

export function isDisposableEmailDomain(domain: string) {
  const normalizedDomain = domain.trim().toLowerCase();
  if (!normalizedDomain) return false;

  return Array.from(DISPOSABLE_EMAIL_DOMAINS).some(
    (blockedDomain) => normalizedDomain === blockedDomain || normalizedDomain.endsWith(`.${blockedDomain}`),
  );
}

export function isDisposableEmail(email: string) {
  const domain = email.split("@").pop();
  return domain ? isDisposableEmailDomain(domain) : false;
}
