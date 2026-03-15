/**
 * Recording Engine
 * Captures user actions and screenshots for task recording
 * Note: Full global input monitoring requires Accessibility permissions
 */

const { EventEmitter } = require('events');
const { desktopCapturer, screen } = require('electron');

class RecordingEngine extends EventEmitter {
  constructor() {
    super();
    this.isRecording = false;
    this.events = [];
    this.screenshots = [];
    this.startTime = null;
    this.screenshotInterval = null;
    this.keyBuffer = '';
    this.keyBufferTimeout = null;
    this.lastScreenshotTime = 0;
  }

  /**
   * Capture a screenshot
   */
  async captureScreenshot() {
    try {
      const { width, height } = screen.getPrimaryDisplay().size;

      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width, height }
      });

      if (sources.length === 0) {
        return null;
      }

      const screenshot = sources[0].thumbnail;
      if (screenshot.isEmpty()) {
        return null;
      }

      const base64 = screenshot.toDataURL().replace(/^data:image\/png;base64,/, '');
      const timestamp = Date.now() - this.startTime;

      const screenshotData = {
        id: `ss_${timestamp}`,
        timestamp,
        image: base64,
        width: screenshot.getSize().width,
        height: screenshot.getSize().height
      };

      this.screenshots.push(screenshotData);
      this.lastScreenshotTime = Date.now();

      return screenshotData;
    } catch (error) {
      console.error('Screenshot capture error:', error);
      return null;
    }
  }

  /**
   * Get current mouse position using Electron's screen API
   */
  getMousePosition() {
    const point = screen.getCursorScreenPoint();
    return { x: point.x, y: point.y };
  }

  /**
   * Flush the keyboard buffer as a text_input event
   */
  flushKeyBuffer() {
    if (this.keyBuffer.length > 0 && this.isRecording) {
      const timestamp = Date.now() - this.startTime;
      const event = {
        timestamp,
        type: 'text_input',
        data: {
          text: this.keyBuffer,
          isPersonalizable: true
        }
      };

      this.events.push(event);
      this.emit('event', event);
      this.keyBuffer = '';
    }
  }

  /**
   * Record a mouse click event
   */
  async recordMouseClick(button = 'left') {
    if (!this.isRecording) return;

    this.flushKeyBuffer();

    const timestamp = Date.now() - this.startTime;
    const position = this.getMousePosition();

    // Take screenshot on click
    let screenshotRef = null;
    if (Date.now() - this.lastScreenshotTime > 500) {
      const ss = await this.captureScreenshot();
      if (ss) {
        screenshotRef = ss.id;
      }
    }

    const event = {
      timestamp,
      type: 'mouse_click',
      data: {
        x: position.x,
        y: position.y,
        button
      },
      screenshotRef
    };

    this.events.push(event);
    this.emit('event', event);
  }

  /**
   * Record a key press event
   */
  recordKeyPress(key) {
    if (!this.isRecording) return;

    // Buffer printable characters
    if (key.length === 1) {
      this.keyBuffer += key;

      if (this.keyBufferTimeout) {
        clearTimeout(this.keyBufferTimeout);
      }
      this.keyBufferTimeout = setTimeout(() => {
        this.flushKeyBuffer();
      }, 500);
    } else {
      // Non-printable key
      this.flushKeyBuffer();

      const timestamp = Date.now() - this.startTime;
      const event = {
        timestamp,
        type: 'key_press',
        data: { key }
      };

      this.events.push(event);
      this.emit('event', event);
    }
  }

  /**
   * Record a scroll event
   */
  async recordScroll(deltaX, deltaY) {
    if (!this.isRecording) return;

    const timestamp = Date.now() - this.startTime;
    const position = this.getMousePosition();

    const event = {
      timestamp,
      type: 'scroll',
      data: {
        x: position.x,
        y: position.y,
        deltaX,
        deltaY
      }
    };

    this.events.push(event);
    this.emit('event', event);
  }

  /**
   * Start recording
   */
  async start() {
    if (this.isRecording) {
      return { success: false, error: 'Already recording' };
    }

    this.isRecording = true;
    this.events = [];
    this.screenshots = [];
    this.startTime = Date.now();
    this.keyBuffer = '';

    // Take initial screenshot
    await this.captureScreenshot();

    // Take screenshots periodically
    this.screenshotInterval = setInterval(async () => {
      if (this.isRecording) {
        await this.captureScreenshot();
      }
    }, 2000);

    this.emit('started');
    console.log('Recording started');

    return { success: true };
  }

  /**
   * Stop recording
   */
  async stop() {
    if (!this.isRecording) {
      return { success: false, error: 'Not recording' };
    }

    this.flushKeyBuffer();
    this.isRecording = false;

    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval);
      this.screenshotInterval = null;
    }

    if (this.keyBufferTimeout) {
      clearTimeout(this.keyBufferTimeout);
      this.keyBufferTimeout = null;
    }

    await this.captureScreenshot();

    const duration = Date.now() - this.startTime;

    const session = {
      duration,
      events: this.events,
      screenshots: this.screenshots
    };

    this.emit('stopped', session);
    console.log(`Recording stopped. Duration: ${duration}ms, Events: ${this.events.length}`);

    return { success: true, session };
  }

  /**
   * Get recording status
   */
  getStatus() {
    return {
      isRecording: this.isRecording,
      duration: this.isRecording ? Date.now() - this.startTime : 0,
      eventCount: this.events.length,
      screenshotCount: this.screenshots.length
    };
  }

  /**
   * Manually add an event
   */
  addEvent(eventType, data) {
    if (!this.isRecording) return;

    const timestamp = Date.now() - this.startTime;
    const event = {
      timestamp,
      type: eventType,
      data
    };

    this.events.push(event);
    this.emit('event', event);
  }
}

const recordingEngine = new RecordingEngine();

module.exports = {
  RecordingEngine,
  recordingEngine
};
