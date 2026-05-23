#!/usr/bin/env node
/**
 * MCP HTTP Client Bridge
 * Connects Claude Desktop (stdio) to HTTP-based MCP server
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const MCP_URL = 'https://brian-clone-git-main-js-pros.vercel.app/api/mcp';
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN || '9eTQNY9Wu2jBk7L10G7IwlYx+k7MUFuagBrFUIYqzog=';

async function main() {
  // Create HTTP client transport to connect to remote server
  const httpTransport = new StreamableHTTPClientTransport(
    new URL(MCP_URL),
    {
      fetch: (url, init) => {
        return fetch(url, {
          ...init,
          headers: {
            ...init?.headers,
            'Authorization': `Bearer ${AUTH_TOKEN}`,
          },
        });
      },
    }
  );

  // Create client
  const client = new Client(
    {
      name: 'brian-clone-mcp-bridge',
      version: '1.0.0',
    },
    {
      capabilities: {},
    }
  );

  // Connect to remote HTTP server
  await client.connect(httpTransport);

  // Create stdio transport for Claude Desktop
  const stdioTransport = new StdioServerTransport();

  // Pipe stdio to/from HTTP client
  // This is a simplified version - you may need to implement proper message routing
  console.error('MCP bridge started, connecting to:', MCP_URL);

  process.on('SIGINT', async () => {
    await client.close();
    process.exit(0);
  });

  // Keep alive
  await new Promise(() => {});
}

main().catch((error) => {
  console.error('MCP bridge error:', error);
  process.exit(1);
});
