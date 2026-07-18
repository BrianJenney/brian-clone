import { pkceS256, sign, verify } from "@/libs/mcp/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

function err(error: string, description: string): Response {
  return Response.json(
    { error, error_description: description },
    { status: 400, headers: cors },
  );
}

function issueTokens(): Response {
  return Response.json(
    {
      access_token: sign({ sub: "brian" }, "access", 3600),
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: sign({ sub: "brian" }, "refresh", 90 * 24 * 3600),
      scope: "mcp",
    },
    { headers: cors },
  );
}

async function readBody(req: Request): Promise<Record<string, string>> {
  // OAuth mandates form-urlencoded; tolerate JSON too.
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      const j = await req.json();
      return Object.fromEntries(
        Object.entries(j).map(([k, v]) => [k, String(v)]),
      );
    } catch {
      return {};
    }
  }
  const form = await req.formData();
  const out: Record<string, string> = {};
  for (const [k, v] of form) out[k] = String(v);
  return out;
}

export async function POST(req: Request) {
  const b = await readBody(req);

  if (b.grant_type === "authorization_code") {
    const code = verify(b.code ?? "", "code");
    if (!code) return err("invalid_grant", "Invalid or expired code.");
    if (code.redirect_uri !== b.redirect_uri)
      return err("invalid_grant", "redirect_uri mismatch.");
    if (code.client_id !== b.client_id)
      return err("invalid_grant", "client_id mismatch.");
    if (!b.code_verifier || pkceS256(b.code_verifier) !== code.code_challenge)
      return err("invalid_grant", "PKCE verification failed.");
    return issueTokens();
  }

  if (b.grant_type === "refresh_token") {
    if (!verify(b.refresh_token ?? "", "refresh"))
      return err("invalid_grant", "Invalid or expired refresh token.");
    return issueTokens();
  }

  return err(
    "unsupported_grant_type",
    `Unsupported grant_type: ${b.grant_type}`,
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
