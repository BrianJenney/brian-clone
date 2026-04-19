#!/usr/bin/env node
/**
 * MCP Vercel Bridge - Raw stdio to HTTP bridge
 * No external dependencies - uses only Node.js built-ins
 */

const MCP_URL = 'https://brian-clone.vercel.app/api/mcp';
const MCP_AUTH = '9eTQNY9Wu2jBk7L10G7IwlYx+k7MUFuagBrFUIYqzog=';

let buffer = '';
let pendingRequests = 0;
let stdinEnded = false;

function checkExit() {
  if (stdinEnded && pendingRequests === 0) {
    process.exit(0);
  }
}

async function handleMessage(message) {
  pendingRequests++;
  try {
    const response = await fetch(MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': `Bearer ${MCP_AUTH}`,
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
    } else {
      const data = await response.json();
      process.stdout.write(JSON.stringify(data) + '\n');
    }
  } catch (error) {
    console.error('Bridge error:', error.message);
    const errorResponse = {
      jsonrpc: '2.0',
      error: { code: -32000, message: error.message },
      id: message.id || null,
    };
    process.stdout.write(JSON.stringify(errorResponse) + '\n');
  } finally {
    pendingRequests--;
    checkExit();
  }
}

process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  buffer += chunk;

  // Try to parse complete JSON messages (newline-delimited)
  const lines = buffer.split('\n');
  buffer = lines.pop(); // Keep incomplete line in buffer

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const message = JSON.parse(line);
      handleMessage(message);
    } catch (error) {
      console.error('Parse error:', error.message);
    }
  }
});

process.stdin.on('end', () => {
  stdinEnded = true;
  // Process any remaining buffer
  if (buffer.trim()) {
    try {
      const message = JSON.parse(buffer);
      handleMessage(message);
    } catch (error) {
      console.error('Final parse error:', error.message);
    }
  }
  checkExit();
});

process.on('SIGINT', () => {
  process.exit(0);
});

console.error('MCP Vercel Bridge started');
