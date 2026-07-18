import { sign } from "@/libs/mcp/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

// RFC 7591 Dynamic Client Registration. Stateless: the returned client_id IS a
// signed token carrying the redirect_uris, so /authorize can validate them
// later without any storage. Registration is open (public PKCE clients) —
// security is enforced by the /authorize password + PKCE, not client secrets.
export async function POST(req: Request) {
  let body: { redirect_uris?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // tolerate empty/garbage body -> handled by the check below
  }

  const redirectUris = Array.isArray(body.redirect_uris)
    ? body.redirect_uris.filter((u): u is string => typeof u === "string")
    : [];

  if (redirectUris.length === 0) {
    return Response.json(
      {
        error: "invalid_redirect_uri",
        error_description: "redirect_uris is required",
      },
      { status: 400, headers: cors },
    );
  }

  // ponytail: client_id never expires-checked in practice (10y ttl); acceptable
  // for a single-user connector. Rotate AUTH_SECRET to invalidate all clients.
  const clientId = sign(
    { redirect_uris: redirectUris },
    "client",
    10 * 365 * 24 * 3600,
  );

  return Response.json(
    {
      client_id: clientId,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      client_id_issued_at: Math.floor(Date.now() / 1000),
    },
    { status: 201, headers: cors },
  );
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
