import { baseUrl } from "@/libs/mcp/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// RFC 9728 — served at /.well-known/oauth-protected-resource (see next.config.ts).
export async function GET(req: Request) {
  const base = baseUrl(req);
  return Response.json(
    {
      resource: `${base}/api/mcp`,
      authorization_servers: [base],
      bearer_methods_supported: ["header"],
      scopes_supported: ["mcp"],
    },
    { headers: { "Access-Control-Allow-Origin": "*" } },
  );
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
