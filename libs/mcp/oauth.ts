// Minimal, stateless OAuth 2.1 building blocks for the MCP server.
// Codes, tokens, and client_ids are all HMAC-signed tokens — no database.
// Signing key + authorize-gate password are reused from the existing site auth.
import { createHash, createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.AUTH_SECRET || "default-secret-change-me";

export type Payload = { typ: string; exp: number; [k: string]: unknown };

const enc = (s: string) => Buffer.from(s).toString("base64url");
const dec = (s: string) => Buffer.from(s, "base64url").toString();
const hmac = (body: string) =>
  createHmac("sha256", SECRET).update(body).digest("base64url");

/** Issue a signed token of the given `typ`, expiring in `ttlSeconds`. */
export function sign(
  data: Record<string, unknown>,
  typ: string,
  ttlSeconds: number,
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = enc(JSON.stringify({ ...data, typ, exp }));
  return `${body}.${hmac(body)}`;
}

/** Verify a signed token; returns the payload only if sig + typ + exp all pass. */
export function verify(token: string, typ: string): Payload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = hmac(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let payload: Payload;
  try {
    payload = JSON.parse(dec(body));
  } catch {
    return null;
  }
  if (payload.typ !== typ) return null;
  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now())
    return null;
  return payload;
}

/** PKCE S256 challenge for a given verifier. */
export function pkceS256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** Constant-time check against the shared authorize-gate password. */
export function checkPassword(input: string): boolean {
  const expected = process.env.AUTH_PASSWORD || "";
  if (!expected) return false;
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** External origin of the request (works behind Vercel's proxy). */
export function baseUrl(req: Request): string {
  const h = req.headers;
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}
