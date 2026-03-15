/**
 * Session Storage Module
 * Save/load/list/delete recording sessions as JSON files
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Sessions directory: ~/.genie/sessions/
const SESSIONS_DIR = path.join(os.homedir(), '.genie', 'sessions');

/**
 * Ensure the sessions directory exists
 */
function ensureSessionsDir() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

/**
 * Generate a unique session ID
 */
function generateSessionId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `session_${timestamp}_${random}`;
}

/**
 * Get the file path for a session
 */
function getSessionPath(sessionId) {
  return path.join(SESSIONS_DIR, `${sessionId}.json`);
}

/**
 * Save a session to disk
 * @param {Object} session - The session object to save
 * @returns {Object} Result with success status
 */
async function saveSession(session) {
  try {
    ensureSessionsDir();

    // Ensure session has an ID
    if (!session.id) {
      session.id = generateSessionId();
    }

    // Add timestamps if not present
    if (!session.createdAt) {
      session.createdAt = new Date().toISOString();
    }
    session.updatedAt = new Date().toISOString();

    const filePath = getSessionPath(session.id);
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2));

    return { success: true, id: session.id, path: filePath };
  } catch (error) {
    console.error('Error saving session:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Load a session from disk
 * @param {string} sessionId - The session ID to load
 * @returns {Object} The session object or error
 */
async function loadSession(sessionId) {
  try {
    const filePath = getSessionPath(sessionId);

    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Session not found' };
    }

    const data = fs.readFileSync(filePath, 'utf8');
    const session = JSON.parse(data);

    return { success: true, session };
  } catch (error) {
    console.error('Error loading session:', error);
    return { success: false, error: error.message };
  }
}

/**
 * List all sessions
 * @returns {Object} Array of session summaries
 */
async function listSessions() {
  try {
    ensureSessionsDir();

    const files = fs.readdirSync(SESSIONS_DIR)
      .filter(f => f.endsWith('.json'))
      .sort((a, b) => {
        // Sort by modification time, newest first
        const statA = fs.statSync(path.join(SESSIONS_DIR, a));
        const statB = fs.statSync(path.join(SESSIONS_DIR, b));
        return statB.mtimeMs - statA.mtimeMs;
      });

    const sessions = files.map(file => {
      try {
        const filePath = path.join(SESSIONS_DIR, file);
        const data = fs.readFileSync(filePath, 'utf8');
        const session = JSON.parse(data);

        // Return summary (without full screenshot data)
        return {
          id: session.id,
          name: session.name || 'Untitled Session',
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          duration: session.duration || 0,
          eventCount: session.events?.length || 0,
          screenshotCount: session.screenshots?.length || 0
        };
      } catch (err) {
        console.error('Error reading session file:', file, err);
        return null;
      }
    }).filter(Boolean);

    return { success: true, sessions };
  } catch (error) {
    console.error('Error listing sessions:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a session
 * @param {string} sessionId - The session ID to delete
 * @returns {Object} Result with success status
 */
async function deleteSession(sessionId) {
  try {
    const filePath = getSessionPath(sessionId);

    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Session not found' };
    }

    fs.unlinkSync(filePath);

    return { success: true };
  } catch (error) {
    console.error('Error deleting session:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Rename a session
 * @param {string} sessionId - The session ID
 * @param {string} newName - The new name
 * @returns {Object} Result with success status
 */
async function renameSession(sessionId, newName) {
  try {
    const result = await loadSession(sessionId);
    if (!result.success) {
      return result;
    }

    result.session.name = newName;
    return await saveSession(result.session);
  } catch (error) {
    console.error('Error renaming session:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  saveSession,
  loadSession,
  listSessions,
  deleteSession,
  renameSession,
  generateSessionId,
  SESSIONS_DIR
};
