#!/usr/bin/env node
/**
 * MCP HTTP Client Bridge
 * Proxies stdio JSON-RPC messages to HTTP-based MCP server
 */

const MCP_URL = 'https://brian-clone.vercel.app/api/mcp';
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN || '9eTQNY9Wu2jBk7L10G7IwlYx+k7MUFuagBrFUIYqzog=';

process.stderr.write('MCP bridge started, connecting to: ' + MCP_URL + '\n');

let buffer = '';
let inputEnded = false;
const messageQueue = [];
let processing = false;

function checkExit() {
  if (inputEnded && messageQueue.length === 0 && !processing) {
    process.exit(0);
  }
}

function writeOutput(data) {
  return new Promise((resolve) => {
    const canContinue = process.stdout.write(data + '\n');
    if (canContinue) {
      resolve();
    } else {
      process.stdout.once('drain', resolve);
    }
  });
}

async function processQueue() {
  if (processing || messageQueue.length === 0) return;

  processing = true;

  while (messageQueue.length > 0) {
    const message = messageQueue.shift();

    try {
      const response = await fetch(MCP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'Authorization': `Bearer ${AUTH_TOKEN}`,
        },
        body: JSON.stringify(message),
      });

      // For notifications (no id), server may return 202/204 with no body
      if (message.id === undefined) {
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();

      // Skip empty responses
      if (!text.trim()) {
        continue;
      }

      if (contentType.includes('text/event-stream')) {
        for (const eventLine of text.split('\n')) {
          if (eventLine.startsWith('data: ')) {
            const data = eventLine.slice(6).trim();
            if (data && data !== '[DONE]') {
              JSON.parse(data); // Validate
              await writeOutput(data);
            }
          }
        }
      } else {
        JSON.parse(text); // Validate
        await writeOutput(text);
      }
    } catch (error) {
      process.stderr.write('Bridge error: ' + error.message + '\n');
      if (message.id !== undefined) {
        const errorResponse = JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32603, message: String(error.message) },
          id: message.id,
        });
        await writeOutput(errorResponse);
      }
    }
  }

  processing = false;
  checkExit();
}

process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  buffer += chunk;

  const lines = buffer.split('\n');
  buffer = lines.pop();

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const message = JSON.parse(line);
      messageQueue.push(message);
    } catch (e) {
      process.stderr.write('Parse error: ' + e.message + '\n');
    }
  }

  processQueue();
});

process.stdin.on('end', () => {
  inputEnded = true;
  checkExit();
});

// Keep process alive
process.stdin.resume();
