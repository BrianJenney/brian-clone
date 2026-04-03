/**
 * Replay Engine
 * Executes recorded mouse clicks, keyboard input, and scrolls
 * Uses native macOS automation (AppleScript/Python)
 */

const { EventEmitter } = require('events');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class ReplayEngine extends EventEmitter {
  constructor() {
    super();
    this.isReplaying = false;
    this.isPaused = false;
    this.currentSession = null;
    this.currentEventIndex = 0;
    this.playbackSpeed = 1.0;
    this.abortController = null;
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
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Click at position
   */
  async click(x, y, button = 'left') {
    try {
      const clickType = button === 'right' ? 'rc' : 'c';
      await execAsync(`cliclick ${clickType}:${x},${y}`);
    } catch {
      // Fallback to Python with Quartz
      const buttonCode = button === 'right' ? 'kCGMouseButtonRight' : 'kCGMouseButtonLeft';
      const downEvent = button === 'right' ? 'kCGEventRightMouseDown' : 'kCGEventLeftMouseDown';
      const upEvent = button === 'right' ? 'kCGEventRightMouseUp' : 'kCGEventLeftMouseUp';

      const pythonScript = `
import Quartz
import time
pos = (${x}, ${y})
down = Quartz.CGEventCreateMouseEvent(None, Quartz.${downEvent}, pos, Quartz.${buttonCode})
up = Quartz.CGEventCreateMouseEvent(None, Quartz.${upEvent}, pos, Quartz.${buttonCode})
Quartz.CGEventPost(Quartz.kCGHIDEventTap, down)
time.sleep(0.05)
Quartz.CGEventPost(Quartz.kCGHIDEventTap, up)
`;
      await execAsync(`python3 -c "${pythonScript}"`);
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
   * Press a key
   */
  async pressKey(key) {
    const keyMap = {
      'Return': 'return', 'Enter': 'return', 'Tab': 'tab',
      'Escape': 'escape', 'Backspace': 'delete', 'Delete': 'forward delete',
      'space': 'space', 'Up': 'up arrow', 'Down': 'down arrow',
      'Left': 'left arrow', 'Right': 'right arrow'
    };

    const keyCodes = {
      'return': 36, 'tab': 48, 'escape': 53, 'delete': 51,
      'forward delete': 117, 'space': 49, 'up arrow': 126,
      'down arrow': 125, 'left arrow': 123, 'right arrow': 124
    };

    const mappedKey = keyMap[key];
    if (mappedKey && keyCodes[mappedKey]) {
      await this.runAppleScript(`
        tell application "System Events"
          key code ${keyCodes[mappedKey]}
        end tell
      `);
    } else if (key.length === 1) {
      await this.runAppleScript(`
        tell application "System Events"
          keystroke "${key}"
        end tell
      `);
    }
  }

  /**
   * Execute a single event
   */
  async executeEvent(event, textReplacements = {}) {
    try {
      switch (event.type) {
        case 'mouse_click':
          await this.click(event.data.x, event.data.y, event.data.button);
          break;

        case 'key_press':
          await this.pressKey(event.data.key);
          break;

        case 'text_input':
          const customText = textReplacements[event.timestamp] || null;
          await this.typeText(customText || event.data.text);
          break;

        case 'scroll':
          // Scroll is complex, skip for basic replay
          console.log('Scroll event skipped');
          break;

        default:
          console.warn('Unknown event type:', event.type);
      }
      return true;
    } catch (error) {
      console.error('Event execution error:', error);
      return false;
    }
  }

  /**
   * Start replaying a session
   */
  async start(session, config = {}) {
    if (this.isReplaying) {
      return { success: false, error: 'Already replaying' };
    }

    this.currentSession = session;
    this.currentEventIndex = 0;
    this.playbackSpeed = config.speed || 1.0;
    this.isReplaying = true;
    this.isPaused = false;
    this.abortController = new AbortController();

    const textReplacements = config.textReplacements || {};

    this.emit('started', { eventCount: session.events.length });
    console.log(`Replay started. ${session.events.length} events`);

    try {
      let lastEventTime = 0;

      for (let i = 0; i < session.events.length; i++) {
        if (this.abortController.signal.aborted) break;

        while (this.isPaused && !this.abortController.signal.aborted) {
          await this.sleep(100);
        }

        if (!this.isReplaying) break;

        const event = session.events[i];
        this.currentEventIndex = i;

        // Wait for appropriate time
        const timeSinceLast = event.timestamp - lastEventTime;
        if (timeSinceLast > 0) {
          await this.sleep(timeSinceLast / this.playbackSpeed);
        }
        lastEventTime = event.timestamp;

        const success = await this.executeEvent(event, textReplacements);

        this.emit('event', {
          index: i,
          total: session.events.length,
          event,
          success
        });
      }

      this.isReplaying = false;
      this.emit('completed', {
        eventsExecuted: this.currentEventIndex + 1,
        totalEvents: session.events.length
      });

      return { success: true };
    } catch (error) {
      this.isReplaying = false;
      console.error('Replay error:', error);
      this.emit('error', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop replay
   */
  async stop() {
    if (!this.isReplaying) {
      return { success: false, error: 'Not replaying' };
    }

    this.isReplaying = false;
    if (this.abortController) {
      this.abortController.abort();
    }

    this.emit('stopped', { eventIndex: this.currentEventIndex });
    return { success: true };
  }

  /**
   * Pause replay
   */
  pause() {
    if (!this.isReplaying) return { success: false };
    this.isPaused = true;
    this.emit('paused');
    return { success: true };
  }

  /**
   * Resume replay
   */
  resume() {
    if (!this.isReplaying || !this.isPaused) return { success: false };
    this.isPaused = false;
    this.emit('resumed');
    return { success: true };
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      isReplaying: this.isReplaying,
      isPaused: this.isPaused,
      currentEventIndex: this.currentEventIndex,
      totalEvents: this.currentSession?.events?.length || 0,
      playbackSpeed: this.playbackSpeed
    };
  }
}

const replayEngine = new ReplayEngine();

module.exports = {
  ReplayEngine,
  replayEngine
};
