/**
 * Mints short-lived OAuth2 access tokens for a GCP service account, entirely
 * with Deno's built-in WebCrypto — no google-auth-library, no npm specifier
 * (Deno edge runtimes are frequently stricter about npm: deps than the Deno
 * standard lib + fetch + crypto).
 *
 * Flow (RFC 7523 JWT bearer grant, the same one every Google client library
 * performs under the hood for a service account):
 *   1. Build a claim set (iss/scope/aud/exp/iat) and sign it RS256 with the
 *      service account's private key -> a self-signed JWT.
 *   2. POST that JWT to Google's token endpoint, grant_type=jwt-bearer.
 *   3. Get back a bearer access_token good for ~1 hour; cache it and re-mint
 *      a bit before it actually expires so a long-lived warm isolate never
 *      hands out a token that dies mid-request.
 */

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

interface CachedToken {
  token: string;
  expiresAt: number; // ms epoch
}

let cached: CachedToken | null = null;

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/cloud-platform";
// Re-mint 5 minutes before actual expiry so a request that starts right at
// the edge never carries a token that goes stale mid-flight.
const REFRESH_SKEW_MS = 5 * 60 * 1000;

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function signJwt(sa: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const encHeader = base64url(new TextEncoder().encode(JSON.stringify(header)));
  const encClaims = base64url(new TextEncoder().encode(JSON.stringify(claims)));
  const signingInput = `${encHeader}.${encClaims}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64url(sig)}`;
}

async function mintToken(sa: ServiceAccountKey): Promise<CachedToken> {
  const assertion = await signJwt(sa);
  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`GCP token exchange failed (${resp.status}): ${detail.slice(0, 300)}`);
  }
  const json = await resp.json();
  const expiresInMs = (typeof json.expires_in === "number" ? json.expires_in : 3600) * 1000;
  return { token: json.access_token as string, expiresAt: Date.now() + expiresInMs };
}

/**
 * Returns a valid bearer token for the service account in GCP_SERVICE_ACCOUNT_JSON.
 * Cached in module scope (same pattern as aiConfig's own cache) and re-minted
 * automatically once within REFRESH_SKEW_MS of expiry. Set `force` to bypass
 * the cache once after a 401, in case the token was revoked out-of-band.
 */
export async function getGCPAccessToken(force = false): Promise<string> {
  if (!force && cached && cached.expiresAt - Date.now() > REFRESH_SKEW_MS) {
    return cached.token;
  }
  const raw = Deno.env.get("GCP_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("GCP_SERVICE_ACCOUNT_JSON is not set");
  let sa: ServiceAccountKey;
  try {
    sa = JSON.parse(raw);
  } catch {
    throw new Error("GCP_SERVICE_ACCOUNT_JSON is not valid JSON");
  }
  if (!sa.client_email || !sa.private_key) {
    throw new Error("GCP_SERVICE_ACCOUNT_JSON is missing client_email or private_key");
  }
  cached = await mintToken(sa);
  return cached.token;
}
