const LOCAL_HOSTS = new Set(["localhost", "0.0.0.0", "::", "::1"]);
const DEFAULT_MEDIA_HOSTS = [
  "pub-975120676aa7420e9b84ddf23e7919b5.r2.dev",
  "pub-f335f9271beb48ae83c8b04706092d78.r2.dev",
  "pub-71184de2196c4369bcdb615e4c5e985a.r2.dev",
];
const DEFAULT_IMAGE_HOSTS = [
  "images.unsplash.com",
  "i0.wp.com",
  "i1.wp.com",
  "i2.wp.com",
  "i3.wp.com",
];

export function isSafePublicHttpsUrl(value: string, allowedHosts: string[] = []) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;

  const hostname = normalizeHostname(url.hostname);
  if (!hostname) return false;
  if (LOCAL_HOSTS.has(hostname) || hostname.endsWith(".localhost")) return false;
  if (isPrivateIpAddress(hostname)) return false;

  if (allowedHosts.length > 0) {
    return allowedHosts.some((allowedHost) => hostname === allowedHost || hostname.endsWith(`.${allowedHost}`));
  }

  return process.env.NODE_ENV !== "production";
}

export function isSafeMediaHttpsUrl(value: string) {
  return isSafePublicHttpsUrl(value, getConfiguredHosts("MEDIA_URL_ALLOWED_HOSTS"));
}

export function isSafeImageHttpsUrl(value: string) {
  return isSafePublicHttpsUrl(value, getConfiguredHosts("IMAGE_URL_ALLOWED_HOSTS"));
}

export function getConfiguredHosts(environmentName: "MEDIA_URL_ALLOWED_HOSTS" | "IMAGE_URL_ALLOWED_HOSTS") {
  const defaults = environmentName === "MEDIA_URL_ALLOWED_HOSTS" ? DEFAULT_MEDIA_HOSTS : DEFAULT_IMAGE_HOSTS;
  return Array.from(
    new Set(
      [...defaults, ...(process.env[environmentName] ?? "").split(",")]
        .map((host) => normalizeHostname(host.trim()))
        .filter(Boolean),
    ),
  );
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
