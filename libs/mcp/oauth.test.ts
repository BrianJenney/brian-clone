// Run: npx tsx libs/mcp/oauth.test.ts
import assert from "node:assert";
import { createHash } from "node:crypto";

process.env.AUTH_SECRET = "test-secret";
process.env.AUTH_PASSWORD = "hunter2";

const { sign, verify, pkceS256, checkPassword } = await import("./oauth.ts");

// round-trip
const tok = sign({ sub: "brian" }, "access", 60);
assert.equal(verify(tok, "access")?.sub, "brian", "valid token round-trips");

// wrong typ rejected
assert.equal(verify(tok, "refresh"), null, "type mismatch rejected");

// tampered body rejected
const [, sig] = tok.split(".");
const forged = `${Buffer.from(JSON.stringify({ typ: "access", exp: 9e12, sub: "evil" })).toString("base64url")}.${sig}`;
assert.equal(verify(forged, "access"), null, "tampered payload rejected");

// expired rejected
const dead = sign({}, "access", -1);
assert.equal(verify(dead, "access"), null, "expired token rejected");

// PKCE matches RFC 7636 S256 definition
const verifier = "abc123";
const expected = createHash("sha256").update(verifier).digest("base64url");
assert.equal(pkceS256(verifier), expected, "PKCE S256 correct");

// password gate
assert.equal(checkPassword("hunter2"), true, "correct password accepted");
assert.equal(checkPassword("nope"), false, "wrong password rejected");

// Vercel rewrites 127.0.0.1 to localhost in OAuth query parameters.
const { GET } = await import("../../app/api/oauth/authorize/route.ts");
const callback = "http://127.0.0.1:54321/callback/test";
const clientId = sign({ redirect_uris: [callback] }, "client", 60);
const authorizeUrl = new URL("https://example.com/api/oauth/authorize");
for (const [key, value] of Object.entries({
  response_type: "code",
  client_id: clientId,
  redirect_uri: callback.replace("127.0.0.1", "localhost"),
  code_challenge: "test",
  code_challenge_method: "S256",
})) authorizeUrl.searchParams.set(key, value);
assert.equal((await GET(new Request(authorizeUrl))).status, 200, "loopback callback accepted");
authorizeUrl.searchParams.set("redirect_uri", "http://localhost:54321/callback/other");
assert.equal((await GET(new Request(authorizeUrl))).status, 400, "unregistered callback rejected");

console.log("oauth self-check: all passed");
