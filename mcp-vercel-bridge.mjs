#!/usr/bin/env node
/**
 * MCP Vercel Bridge - Raw stdio to HTTP bridge
 * No external dependencies - uses only Node.js built-ins
 */

const MCP_URL = 'https://brian-clone-git-main-js-pros.vercel.app/api/mcp';
const VERCEL_BYPASS = 'a5q0MeLu6xnXnTZtaEQVKDKxRLkarm5l';
const MCP_AUTH = '9eTQNY9Wu2jBk7L10G7IwlYx+k7MUFuagBrFUIYqzog=';

let buffer = '';

process.stdin.setEncoding('utf8');

process.stdin.on('data', async (chunk) => {
  buffer += chunk;

  // Try to parse complete JSON messages (newline-delimited)
  const lines = buffer.split('\n');
  buffer = lines.pop(); // Keep incomplete line in buffer

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const message = JSON.parse(line);

      const response = await fetch(MCP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'Authorization': `Bearer ${MCP_AUTH}`,
          'x-vercel-protection-bypass': VERCEL_BYPASS,
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('Server error:', response.status, text.substring(0, 200));
        const errorResponse = {
          jsonrpc: '2.0',
          error: { code: -32000, message: `HTTP ${response.status}` },
          id: message.id || null,
        };
        process.stdout.write(JSON.stringify(errorResponse) + '\n');
        continue;
      }

      const data = await response.json();
      process.stdout.write(JSON.stringify(data) + '\n');

    } catch (error) {
      console.error('Bridge error:', error.message);
    }
  }
});

process.stdin.on('end', () => {
  process.exit(0);
});

process.on('SIGINT', () => {
  process.exit(0);
});

// Keep alive
console.error('MCP Vercel Bridge started');
