const LOCAL_HOSTS = new Set(["localhost", "0.0.0.0", "::", "::1"]);

export function isSafePublicHttpsUrl(value: string, allowedHosts = getAllowedMediaHosts()) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;

  const hostname = normalizeHostname(url.hostname);
  if (!hostname) return false;
  if (LOCAL_HOSTS.has(hostname) || hostname.endsWith(".localhost")) return false;
  if (isPrivateIpAddress(hostname)) return false;

  if (allowedHosts.length > 0) {
    return allowedHosts.some((allowedHost) => hostname === allowedHost || hostname.endsWith(`.${allowedHost}`));
  }

  return true;
}

export function assertSafePublicHttpsUrl(value: string, fieldName: string) {
  if (!isSafePublicHttpsUrl(value)) {
    throw new Error(`${fieldName} deve ser uma URL HTTPS publica permitida.`);
  }
}

function getAllowedMediaHosts() {
  return (process.env.MEDIA_URL_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => normalizeHostname(host.trim()))
    .filter(Boolean);
}

function normalizeHostname(hostname: string) {
  return hostname.toLowerCase().replace(/^\[|\]$/g, "");
}

function isPrivateIpAddress(hostname: string) {
  if (isPrivateIpv4(hostname)) return true;
  if (isPrivateIpv6(hostname)) return true;
  return false;
}

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".");
  if (parts.length !== 4) return false;

  const octets = parts.map((part) => Number(part));
  if (octets.some((octet, index) => !Number.isInteger(octet) || octet < 0 || octet > 255 || String(octet) !== parts[index])) {
    return false;
  }

  const [first, second] = octets;
  return (
    first === 10 ||
    first === 127 ||
    first === 0 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isPrivateIpv6(hostname: string) {
  if (!hostname.includes(":")) return false;
  return hostname === "::1" || hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe80:");
}
