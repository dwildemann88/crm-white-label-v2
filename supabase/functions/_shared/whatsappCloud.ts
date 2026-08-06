const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface WhatsAppCredentialRecord {
  id: string;
  organization_id: string;
  waba_id: string;
  phone_number_id: string;
  display_phone_number: string;
  verified_name: string;
  graph_api_version: string;
  access_token_ciphertext: string;
  status: string;
  active: boolean;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  if (secret.trim().length < 24) {
    throw new Error(
      "WHATSAPP_CREDENTIALS_KEY deve possuir ao menos 24 caracteres.",
    );
  }

  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptCredential(
  plaintext: string,
  secret: string,
): Promise<string> {
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext),
  );

  return `v1.${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`;
}

export async function decryptCredential(
  ciphertext: string,
  secret: string,
): Promise<string> {
  const [version, ivValue, encryptedValue] = ciphertext.split(".");
  if (version !== "v1" || !ivValue || !encryptedValue) {
    throw new Error("A credencial armazenada possui formato inválido.");
  }

  const key = await deriveKey(secret);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivValue) },
    key,
    base64ToBytes(encryptedValue),
  );

  return decoder.decode(decrypted);
}

export function normalizeGraphVersion(value: unknown): string {
  const version = typeof value === "string" ? value.trim() : "";
  if (!/^v\d+\.\d+$/.test(version)) {
    return Deno.env.get("META_GRAPH_VERSION")?.trim() || "v25.0";
  }
  return version;
}

export function graphUrl(
  version: string,
  path: string,
  query?: URLSearchParams,
): string {
  const suffix = query && [...query.keys()].length > 0 ? `?${query}` : "";
  return `https://graph.facebook.com/${version}/${path.replace(/^\//, "")}${suffix}`;
}

export async function fetchPhoneNumberDetails(
  phoneNumberId: string,
  accessToken: string,
  version: string,
): Promise<Record<string, unknown>> {
  const query = new URLSearchParams({
    fields: "id,display_phone_number,verified_name,quality_rating",
  });
  const response = await fetch(graphUrl(version, phoneNumberId, query), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = payload && typeof payload === "object"
      ? (payload as Record<string, unknown>).error
      : null;
    const message = error && typeof error === "object"
      ? String((error as Record<string, unknown>).message ?? "")
      : "";
    throw new Error(message || `A Meta retornou HTTP ${response.status}.`);
  }
  return payload && typeof payload === "object"
    ? payload as Record<string, unknown>
    : {};
}


export async function fetchWabaPhoneNumbers(
  wabaId: string,
  accessToken: string,
  version: string,
): Promise<Record<string, unknown>[]> {
  const query = new URLSearchParams({
    fields: "id,display_phone_number,verified_name,quality_rating",
    limit: "100",
  });
  const response = await fetch(graphUrl(version, `${wabaId}/phone_numbers`, query), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = payload && typeof payload === "object"
      ? (payload as Record<string, unknown>).error
      : null;
    const message = error && typeof error === "object"
      ? String((error as Record<string, unknown>).message ?? "")
      : "";
    throw new Error(message || `A Meta retornou HTTP ${response.status} ao consultar a WABA.`);
  }

  const data = payload && typeof payload === "object"
    ? (payload as Record<string, unknown>).data
    : null;
  return Array.isArray(data)
    ? data.map(asObject)
    : [];
}

export async function subscribeWaba(
  wabaId: string,
  accessToken: string,
  version: string,
): Promise<void> {
  const response = await fetch(graphUrl(version, `${wabaId}/subscribed_apps`), {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = payload && typeof payload === "object"
      ? (payload as Record<string, unknown>).error
      : null;
    const message = error && typeof error === "object"
      ? String((error as Record<string, unknown>).message ?? "")
      : "";
    throw new Error(message || `A Meta retornou HTTP ${response.status} ao inscrever a WABA.`);
  }
}

export function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function unixTimestampToIso(value: unknown): string {
  const numeric = typeof value === "string" ? Number(value) : value;
  if (typeof numeric === "number" && Number.isFinite(numeric)) {
    const milliseconds = numeric < 10_000_000_000 ? numeric * 1000 : numeric;
    const parsed = new Date(milliseconds);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}
