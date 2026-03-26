/**
 * Computer Use Module
 * Uses Claude with custom tools for AI-controlled computer automation
 * Executes actions via native macOS automation (AppleScript/Python)
 */

const Anthropic = require('@anthropic-ai/sdk');
const { desktopCapturer, screen } = require('electron');
const { EventEmitter } = require('events');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class ComputerUseEngine extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.isRunning = false;
    this.shouldStop = false;
    this.displaySize = { width: 1920, height: 1080 };
  }

  /**
   * Initialize the Anthropic client
   */
  init(apiKey) {
    if (!apiKey) {
      throw new Error('Anthropic API key required');
    }
    this.client = new Anthropic({ apiKey });

    const primaryDisplay = screen.getPrimaryDisplay();
    this.displaySize = primaryDisplay.size;
  }

  /**
   * Define custom tools for computer control
   */
  getTools() {
    return [
      {
        name: 'click',
        description: 'Click at a specific screen position. Use this to click buttons, links, or any UI element.',
        input_schema: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'X coordinate on screen' },
            y: { type: 'number', description: 'Y coordinate on screen' },
            button: { type: 'string', enum: ['left', 'right'], description: 'Mouse button to click' }
          },
          required: ['x', 'y']
        }
      },
      {
        name: 'double_click',
        description: 'Double-click at a specific screen position.',
        input_schema: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'X coordinate' },
            y: { type: 'number', description: 'Y coordinate' }
          },
          required: ['x', 'y']
        }
      },
      {
        name: 'type_text',
        description: 'Type text at the current cursor position. Use this to enter text in input fields.',
        input_schema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Text to type' }
          },
          required: ['text']
        }
      },
      {
        name: 'press_key',
        description: 'Press a keyboard key or key combination. Examples: "Return", "Tab", "cmd+c", "cmd+v"',
        input_schema: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Key or key combination to press' }
          },
          required: ['key']
        }
      },
      {
        name: 'scroll',
        description: 'Scroll up or down at a position',
        input_schema: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'X coordinate' },
            y: { type: 'number', description: 'Y coordinate' },
            direction: { type: 'string', enum: ['up', 'down'], description: 'Scroll direction' },
            amount: { type: 'number', description: 'Scroll amount (1-10)' }
          },
          required: ['direction']
        }
      },
      {
        name: 'screenshot',
        description: 'Take a screenshot of the current screen to see what is displayed',
        input_schema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'wait',
        description: 'Wait for a specified duration before continuing',
        input_schema: {
          type: 'object',
          properties: {
            seconds: { type: 'number', description: 'Number of seconds to wait (1-10)' }
          },
          required: ['seconds']
        }
      },
      {
        name: 'task_complete',
        description: 'Signal that the task has been completed successfully',
        input_schema: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Completion message' }
          },
          required: ['message']
        }
      }
    ];
  }

  /**
   * Capture current screenshot as base64
   */
  async captureScreenshot() {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: this.displaySize
      });

      if (sources.length === 0) {
        throw new Error('No screen sources available');
      }

      const screenshot = sources[0].thumbnail;
      if (screenshot.isEmpty()) {
        throw new Error('Screenshot is empty');
      }

      return screenshot.toDataURL().replace(/^data:image\/png;base64,/, '');
    } catch (error) {
      console.error('Screenshot capture error:', error);
      throw error;
    }
  }

  /**
   * Run AppleScript command
   */
  async runAppleScript(script) {
    try {
      const escaped = script.replace(/'/g, "'\"'\"'");
      const { stdout } = await execAsync(`osascript -e '${escaped}'`);
      return stdout.trim();
    } catch (error) {
      console.error('AppleScript error:', error);
      throw error;
    }
  }

  /**
   * Validate coordinates
   */
  validateCoords(x, y) {
    const validX = typeof x === 'number' && !isNaN(x) ? Math.round(x) : null;
    const validY = typeof y === 'number' && !isNaN(y) ? Math.round(y) : null;

    if (validX === null || validY === null) {
      throw new Error(`Invalid coordinates: x=${x}, y=${y}`);
    }

    // Clamp to screen bounds
    const clampedX = Math.max(0, Math.min(validX, this.displaySize.width));
    const clampedY = Math.max(0, Math.min(validY, this.displaySize.height));

    return { x: clampedX, y: clampedY };
  }

  /**
   * Click at position
   */
  async click(x, y, button = 'left') {
    const coords = this.validateCoords(x, y);
    const clickType = button === 'right' ? 'rc' : 'c';

    try {
      await execAsync(`cliclick ${clickType}:${coords.x},${coords.y}`);
    } catch (error) {
      console.error('cliclick error:', error.message);
      throw new Error(`Click failed at (${coords.x}, ${coords.y}): ${error.message}`);
    }
  }

  /**
   * Double click
   */
  async doubleClick(x, y) {
    const coords = this.validateCoords(x, y);

    try {
      await execAsync(`cliclick dc:${coords.x},${coords.y}`);
    } catch (error) {
      console.error('cliclick double-click error:', error.message);
      throw new Error(`Double-click failed at (${coords.x}, ${coords.y}): ${error.message}`);
    }
  }

  /**
   * Type text
   */
  async typeText(text) {
    const escapedText = text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n');

    try {
      await execAsync(`cliclick t:"${escapedText}"`);
    } catch {
      await this.runAppleScript(`
        tell application "System Events"
          keystroke "${escapedText}"
        end tell
      `);
    }
  }

  /**
   * Press key or key combination
   */
  async pressKey(keyStr) {
    const keyCodes = {
      'return': 36, 'enter': 36, 'tab': 48, 'escape': 53, 'esc': 53,
      'backspace': 51, 'delete': 117, 'space': 49,
      'up': 126, 'down': 125, 'left': 123, 'right': 124
    };

    const keyLower = keyStr.toLowerCase();

    // Handle key combinations (e.g., cmd+c)
    if (keyStr.includes('+')) {
      const parts = keyStr.split('+').map(k => k.trim().toLowerCase());
      const modifiers = [];
      let mainKey = '';

      for (const k of parts) {
        if (k === 'cmd' || k === 'command') modifiers.push('command down');
        else if (k === 'ctrl' || k === 'control') modifiers.push('control down');
        else if (k === 'alt' || k === 'option') modifiers.push('option down');
        else if (k === 'shift') modifiers.push('shift down');
        else mainKey = k;
      }

      const modStr = modifiers.length > 0 ? `using {${modifiers.join(', ')}}` : '';

      if (keyCodes[mainKey]) {
        await this.runAppleScript(`
          tell application "System Events"
            key code ${keyCodes[mainKey]} ${modStr}
          end tell
        `);
      } else {
        await this.runAppleScript(`
          tell application "System Events"
            keystroke "${mainKey}" ${modStr}
          end tell
        `);
      }
    } else if (keyCodes[keyLower]) {
      await this.runAppleScript(`
        tell application "System Events"
          key code ${keyCodes[keyLower]}
        end tell
      `);
    } else {
      await this.runAppleScript(`
        tell application "System Events"
          keystroke "${keyStr}"
        end tell
      `);
    }
  }

  /**
   * Scroll
   */
  async scroll(x, y, direction, amount = 3) {
    const scrollDir = direction === 'up' ? 'su' : 'sd';

    try {
      // Move to position first if valid coordinates provided
      if (typeof x === 'number' && typeof y === 'number' && !isNaN(x) && !isNaN(y)) {
        const coords = this.validateCoords(x, y);
        await execAsync(`cliclick m:${coords.x},${coords.y}`);
        await this.sleep(100);
      }
      await execAsync(`cliclick ${scrollDir}:${Math.max(1, Math.min(10, amount))}`);
    } catch (error) {
      console.error('Scroll error:', error.message);
      // Don't throw, scrolling is non-critical
    }
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute a tool call
   */
  async executeTool(name, input) {
    console.log(`Executing tool: ${name}`, JSON.stringify(input));

    try {
      switch (name) {
        case 'click':
          if (input.x === undefined || input.y === undefined) {
            return 'Error: click requires x and y coordinates';
          }
          await this.click(input.x, input.y, input.button || 'left');
          return `Clicked at (${Math.round(input.x)}, ${Math.round(input.y)})`;

        case 'double_click':
          if (input.x === undefined || input.y === undefined) {
            return 'Error: double_click requires x and y coordinates';
          }
          await this.doubleClick(input.x, input.y);
          return `Double-clicked at (${Math.round(input.x)}, ${Math.round(input.y)})`;

        case 'type_text':
          if (!input.text) {
            return 'Error: type_text requires text';
          }
          await this.typeText(input.text);
          return `Typed: "${input.text.substring(0, 50)}${input.text.length > 50 ? '...' : ''}"`;

        case 'press_key':
          if (!input.key) {
            return 'Error: press_key requires key';
          }
          await this.pressKey(input.key);
          return `Pressed key: ${input.key}`;

        case 'scroll':
          if (!input.direction) {
            return 'Error: scroll requires direction (up or down)';
          }
          await this.scroll(input.x, input.y, input.direction, input.amount || 3);
          return `Scrolled ${input.direction}`;

        case 'screenshot':
          return 'Screenshot taken - analyze the new image';

        case 'wait':
          const seconds = Math.max(1, Math.min(10, input.seconds || 1));
          await this.sleep(seconds * 1000);
          return `Waited ${seconds} seconds`;

        case 'task_complete':
          return `TASK_COMPLETE: ${input.message || 'Done'}`;

        default:
          return `Unknown tool: ${name}`;
      }
    } catch (error) {
      console.error(`Tool ${name} error:`, error.message);
      return `Error executing ${name}: ${error.message}`;
    }
  }

  /**
   * Run Computer Use session
   */
  async run(taskDescription, options = {}) {
    if (this.isRunning) {
      return { success: false, error: 'Already running' };
    }

    if (!this.client) {
      return { success: false, error: 'Client not initialized' };
    }

    const maxIterations = options.maxIterations || 30;
    const sessionContext = options.sessionContext;
    this.isRunning = true;
    this.shouldStop = false;

    try {
      const systemPrompt = `You are an AI assistant that can control a computer to complete tasks.
You can see screenshots and perform actions like clicking, typing, and scrolling.

Screen size: ${this.displaySize.width}x${this.displaySize.height}

IMPORTANT GUIDELINES:
1. Always take a screenshot first to see the current state
2. Analyze the screenshot carefully to identify UI elements
3. Click on elements by estimating their x,y coordinates from the screenshot
4. After each action, take another screenshot to verify it worked
5. If something doesn't work, try a different approach
6. Use task_complete when the task is done

Your task: ${taskDescription}`;

      // Build initial context from session if available
      let contextText = `Here's the current screen. Please complete this task: ${taskDescription}\n\n`;

      if (sessionContext && sessionContext.events && sessionContext.events.length > 0) {
        contextText += 'RECORDED SESSION CONTEXT:\n';
        contextText += `This task was previously recorded with ${sessionContext.events.length} events. `;
        contextText += 'Here are the key actions that were performed:\n\n';

        // Summarize recorded events
        const clicks = sessionContext.events.filter(e => e.type === 'mouse_click');
        const keyPresses = sessionContext.events.filter(e => e.type === 'key_press');
        const scrolls = sessionContext.events.filter(e => e.type === 'scroll');

        if (clicks.length > 0) {
          contextText += `- ${clicks.length} mouse click(s) at positions: `;
          const clickPositions = clicks.slice(0, 5).map(c => `(${c.data.x}, ${c.data.y})`).join(', ');
          contextText += clickPositions;
          if (clicks.length > 5) contextText += `, and ${clicks.length - 5} more...`;
          contextText += '\n';
        }

        if (keyPresses.length > 0) {
          contextText += `- ${keyPresses.length} key press(es)\n`;
        }

        if (scrolls.length > 0) {
          contextText += `- ${scrolls.length} scroll action(s)\n`;
        }

        contextText += '\nUse this context to understand what the task involves, then complete it on the current screen.\n\n';
      }

      contextText += 'Start by analyzing what you see, then take actions to complete the task.';

      // Take initial screenshot
      const initialScreenshot = await this.captureScreenshot();

      // Build initial messages - include session screenshots if available
      const initialContent = [];

      // If session has initial screenshots, include them
      if (sessionContext && sessionContext.events) {
        const screenshotEvents = sessionContext.events.filter(e => e.type === 'screenshot' && e.data.screenshot);
        if (screenshotEvents.length > 0) {
          // Include the first screenshot from the session
          const firstScreenshot = screenshotEvents[0];
          initialContent.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: firstScreenshot.data.screenshot
            }
          });
          initialContent.push({
            type: 'text',
            text: 'This was the initial screen when the task was recorded.'
          });
        }
      }

      // Always include current screenshot
      initialContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: initialScreenshot
        }
      });

      initialContent.push({
        type: 'text',
        text: contextText
      });

      let messages = [
        {
          role: 'user',
          content: initialContent
        }
      ];

      this.emit('started', { task: taskDescription });

      let iteration = 0;

      while (iteration < maxIterations && !this.shouldStop) {
        iteration++;
        this.emit('iteration', { current: iteration, max: maxIterations });

        // Call Claude with custom tools
        const response = await this.client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemPrompt,
          tools: this.getTools(),
          messages
        });

        // Add assistant response to messages
        messages.push({ role: 'assistant', content: response.content });

        // Check if done
        if (response.stop_reason === 'end_turn') {
          const textContent = response.content.find(c => c.type === 'text');
          this.emit('completed', {
            message: textContent?.text || 'Task completed',
            iterations: iteration
          });
          break;
        }

        // Process tool uses
        const toolUses = response.content.filter(c => c.type === 'tool_use');

        if (toolUses.length === 0) {
          const textContent = response.content.find(c => c.type === 'text');
          this.emit('completed', {
            message: textContent?.text || 'No actions to take',
            iterations: iteration
          });
          break;
        }

        const toolResults = [];

        for (const toolUse of toolUses) {
          this.emit('action', {
            action: toolUse.name,
            input: toolUse.input,
            iteration
          });

          try {
            const result = await this.executeTool(toolUse.name, toolUse.input);

            // Check if task is complete
            if (result.startsWith('TASK_COMPLETE:')) {
              this.emit('completed', {
                message: result.replace('TASK_COMPLETE: ', ''),
                iterations: iteration
              });
              this.isRunning = false;
              return { success: true, iterations: iteration };
            }

            await this.sleep(300);

            // Take screenshot after action (except for screenshot tool)
            let screenshotData = null;
            if (toolUse.name !== 'wait') {
              screenshotData = await this.captureScreenshot();
            }

            const content = screenshotData
              ? [
                  { type: 'text', text: result },
                  {
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: 'image/png',
                      data: screenshotData
                    }
                  }
                ]
              : result;

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content
            });
          } catch (error) {
            console.error('Tool execution error:', error);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: `Error: ${error.message}`,
              is_error: true
            });
          }
        }

        messages.push({ role: 'user', content: toolResults });
      }

      if (this.shouldStop) {
        this.emit('stopped', { reason: 'User stopped', iterations: iteration });
      } else if (iteration >= maxIterations) {
        this.emit('completed', { message: 'Max iterations reached', iterations: iteration });
      }

      return { success: true, iterations: iteration };

    } catch (error) {
      console.error('Computer Use error:', error);
      this.emit('error', error);
      return { success: false, error: error.message };

    } finally {
      this.isRunning = false;
    }
  }

  stop() {
    this.shouldStop = true;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      displaySize: this.displaySize
    };
  }
}

const computerUseEngine = new ComputerUseEngine();

module.exports = {
  ComputerUseEngine,
  computerUseEngine
};
