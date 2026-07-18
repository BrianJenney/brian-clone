import { checkPassword, sign, verify } from "@/libs/mcp/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUIRED = [
  "response_type",
  "client_id",
  "redirect_uri",
  "code_challenge",
];

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] as string,
  );
}

function errorPage(message: string, status = 400): Response {
  return new Response(
    `<!doctype html><meta charset=utf-8><title>Authorization error</title><body style="font-family:system-ui;max-width:28rem;margin:4rem auto;padding:0 1rem"><h1>Authorization error</h1><p>${escapeHtml(message)}</p>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

/** Returns an error Response if params are invalid, else null. Never redirects
 *  to an unvalidated redirect_uri. */
function validateParams(p: Record<string, string>): Response | null {
  for (const k of REQUIRED)
    if (!p[k]) return errorPage(`Missing required parameter: ${k}`);
  if (p.response_type !== "code")
    return errorPage("Only response_type=code is supported.");
  if ((p.code_challenge_method ?? "plain") !== "S256")
    return errorPage("Only PKCE code_challenge_method=S256 is supported.");

  const client = verify(p.client_id, "client");
  if (!client) return errorPage("Unknown or invalid client_id.");
  const uris = client.redirect_uris as string[] | undefined;
  if (!Array.isArray(uris) || !uris.includes(p.redirect_uri))
    return errorPage("redirect_uri is not registered for this client.");
  return null;
}

function formPage(p: Record<string, string>, error?: string): Response {
  const hidden = Object.entries(p)
    .filter(([k]) => k !== "password")
    .map(
      ([k, v]) =>
        `<input type=hidden name="${escapeHtml(k)}" value="${escapeHtml(v)}">`,
    )
    .join("");
  const html = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Authorize MCP</title><body style="font-family:system-ui;max-width:24rem;margin:4rem auto;padding:0 1rem"><h1>Connect to brian-clone</h1><p>Enter the password to authorize this MCP connection.</p>${
    error ? `<p style="color:#b00020">${escapeHtml(error)}</p>` : ""
  }<form method=post>${hidden}<input type=password name=password autofocus required placeholder=Password style="width:100%;padding:.6rem;font-size:1rem;box-sizing:border-box"><button type=submit style="margin-top:1rem;padding:.6rem 1.2rem;font-size:1rem;cursor:pointer">Authorize</button></form>`;
  return new Response(html, {
    status: error ? 401 : 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(req: Request) {
  const p = Object.fromEntries(new URL(req.url).searchParams);
  return validateParams(p) ?? formPage(p);
}

export async function POST(req: Request) {
  const form = await req.formData();
  const p: Record<string, string> = {};
  for (const [k, v] of form) p[k] = String(v);
  const password = p.password ?? "";
  delete p.password;

  const invalid = validateParams(p);
  if (invalid) return invalid;
  if (!checkPassword(password))
    return formPage(p, "Incorrect password. Try again.");

  // One-time-ish authorization code — 60s TTL (stateless, so replay within the
  // window is possible; PKCE + short expiry keep this acceptable single-user).
  const code = sign(
    {
      redirect_uri: p.redirect_uri,
      client_id: p.client_id,
      code_challenge: p.code_challenge,
    },
    "code",
    60,
  );

  const redirect = new URL(p.redirect_uri);
  redirect.searchParams.set("code", code);
  if (p.state) redirect.searchParams.set("state", p.state);
  return Response.redirect(redirect.toString(), 302);
}
