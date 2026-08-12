# MCP Server

The MCP server lives at `app/api/mcp/route.ts` (streamable-HTTP transport, bearer auth).
Tool implementations are in `libs/mcp/`.

## Tools

| Tool | Purpose |
| --- | --- |
| `lookup_writing` | Semantic search across Brian's articles, LinkedIn posts, and transcripts. An LLM router picks which collections to search. |
| `get_lead_magnets` | Current business lead magnets. |
| `get_offer_stack` | AI Engineering objection → solution map (`data/context/offer-stack.md`). |
| `get_youtube_channel` | YouTube analytics for a channel (defaults to Brian's). |
| `get_competitors` | Analytics for tracked competitors. |

## Testing with the MCP Inspector

The [official MCP Inspector](https://github.com/modelcontextprotocol/inspector)
is wired up as a dev dependency.

1. **Start the app** (serves the MCP endpoint at `http://localhost:3000/api/mcp`):

   ```bash
   npm run dev:next
   ```

2. **Launch the Inspector** in a second terminal:

   ```bash
   npm run mcp:inspect
   ```

   This opens the Inspector UI in your browser.

3. **Connect** in the Inspector UI:
   - **Transport Type:** `Streamable HTTP`
   - **URL:** `http://localhost:3000/api/mcp`
   - **Authentication → Header Name:** `Authorization`
   - **Bearer Token:** the value of `MCP_AUTH_TOKEN` from your `.env`

   Click **Connect**, then use the **Tools** tab to list and call each tool.

### Testing against production

Point the Inspector URL at `https://brian-clone.vercel.app/api/mcp` instead
(the `/api/mcp` prefix is exempt from Vercel deployment protection — see
`vercel.json`). Use the production `MCP_AUTH_TOKEN` value.

> Note: `MCP_AUTH_TOKEN` must be set in the environment the Next.js server
> runs in, or every request returns `401 Unauthorized`.

## Connecting from claude.ai / Claude Desktop (OAuth)

Claude Code and the Inspector use the static `MCP_AUTH_TOKEN` bearer above. The
claude.ai web / Desktop **custom connector** UI only speaks OAuth, so the server
also exposes a minimal, stateless OAuth 2.1 authorization server:

- Discovery: `/.well-known/oauth-protected-resource` and
  `/.well-known/oauth-authorization-server` (rewritten to `app/api/oauth/metadata/*`).
- Endpoints: `/api/oauth/register` (dynamic client registration),
  `/api/oauth/authorize` (password gate), `/api/oauth/token`.
- Codes, access/refresh tokens, and `client_id`s are all HMAC-signed tokens —
  no database. Signed with `AUTH_SECRET`; the authorize page is gated by
  `AUTH_PASSWORD` (both already used by the site login). PKCE S256 required.

To connect: add `https://brian-clone.vercel.app/api/mcp` as a custom connector.
Claude runs the OAuth flow, opens the authorize page, you enter `AUTH_PASSWORD`,
and it's connected. Rotate `AUTH_SECRET` to invalidate every issued token/client.
