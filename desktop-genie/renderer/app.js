// State
let isExpanded = false;
let currentScreenshot = null;
let isProcessing = false;

// DOM Elements
const collapsedEl = document.getElementById('genie-collapsed');
const expandedEl = document.getElementById('genie-expanded');
const collapseBtn = document.getElementById('collapse-btn');
const captureBtn = document.getElementById('capture-btn');
const sendBtn = document.getElementById('send-btn');
const userInput = document.getElementById('user-input');
const messagesEl = document.getElementById('messages');
const screenPreview = document.getElementById('screen-preview');
const screenshotImg = document.getElementById('screenshot-img');
const clearPreviewBtn = document.getElementById('clear-preview');
const quickActionBtns = document.querySelectorAll('.action-btn');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');

// Tab & Upload Elements
const tabChat = document.getElementById('tab-chat');
const tabUpload = document.getElementById('tab-upload');
const uploadPanel = document.getElementById('upload-panel');
const inputArea = document.getElementById('input-area');
const quickActions = document.getElementById('quick-actions');
const uploadCollection = document.getElementById('upload-collection');
const uploadTitle = document.getElementById('upload-title');
const uploadTags = document.getElementById('upload-tags');
const uploadContent = document.getElementById('upload-content');
const uploadBtn = document.getElementById('upload-btn');
const uploadStatus = document.getElementById('upload-status');

let currentTab = 'chat';

// System prompt for the AI - writes in Brian's voice
const SYSTEM_PROMPT = `You are Genie, Brian Jenney's AI writing assistant. You help Brian create content that matches his authentic voice and style.

Brian's Writing Style:
- Direct and conversational, like talking to a friend
- Uses humor and self-deprecating jokes
- Draws from personal experience (bootcamp instructor, software engineer, career changer)
- Practical advice over theory - "here's what actually works"
- Empathetic to struggles of learning to code and career transitions
- Not afraid to have controversial takes or call out BS
- Relatable analogies and real-world examples

Your capabilities:
- Draft content in Brian's voice (social posts, articles, emails, replies)
- Explain what's on screen
- Summarize visible text and data
- Rewrite or improve text to match Brian's style
- Provide insights and suggestions

When writing samples are provided, use them to match:
- Tone and vocabulary
- Sentence structure and rhythm
- Types of examples and analogies Brian uses
- How he opens and closes pieces

Guidelines:
- Reference the writing samples to match Brian's authentic voice
- Be direct and helpful
- When drafting replies, maintain Brian's casual but professional tone
- Keep content practical and actionable`;

// Actions that should trigger RAG (fetch writing samples)
const RAG_ACTIONS = ['draft-reply', 'rewrite', 'write', 'post', 'article'];

/**
 * Check if the prompt should trigger RAG
 */
function shouldUseRAG(prompt) {
  const lowerPrompt = prompt.toLowerCase();
  const ragKeywords = ['write', 'draft', 'rewrite', 'reply', 'post', 'article', 'email', 'respond', 'compose', 'create content'];
  return ragKeywords.some(keyword => lowerPrompt.includes(keyword));
}

/**
 * Fetch writing samples for RAG
 */
async function fetchWritingSamples(query) {
  try {
    const result = await window.genie.searchWritingSamples(query);
    if (result.success && result.formatted) {
      return result.formatted;
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch writing samples:', error);
    return null;
  }
}

// Initialize
async function init() {
  isExpanded = await window.genie.getExpandedState();
  updateUI();

  // Check screen permission on startup
  if (window.platform.isMac) {
    const permission = await window.genie.checkScreenPermission();
    if (permission !== 'granted') {
      console.log('Screen recording permission not granted:', permission);
    }
  }

  // Event listeners
  collapsedEl.addEventListener('click', expand);
  collapseBtn.addEventListener('click', collapse);
  captureBtn.addEventListener('click', captureScreen);
  sendBtn.addEventListener('click', sendMessage);
  clearPreviewBtn.addEventListener('click', clearScreenshot);

  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 100) + 'px';
  });

  // Quick actions
  quickActionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      handleQuickAction(action);
    });
  });

  // Tab switching
  tabChat.addEventListener('click', () => switchTab('chat'));
  tabUpload.addEventListener('click', () => switchTab('upload'));

  // Upload handler
  uploadBtn.addEventListener('click', handleUpload);
}

/**
 * Switch between Chat and Upload tabs
 */
function switchTab(tab) {
  currentTab = tab;

  // Update tab buttons
  tabChat.classList.toggle('active', tab === 'chat');
  tabUpload.classList.toggle('active', tab === 'upload');

  // Show/hide panels
  if (tab === 'chat') {
    messagesEl.classList.remove('hidden');
    quickActions.classList.remove('hidden');
    inputArea.classList.remove('hidden');
    screenPreview.classList.toggle('hidden', !currentScreenshot);
    uploadPanel.classList.add('hidden');
  } else {
    messagesEl.classList.add('hidden');
    quickActions.classList.add('hidden');
    inputArea.classList.add('hidden');
    screenPreview.classList.add('hidden');
    uploadPanel.classList.remove('hidden');
  }
}

/**
 * Handle content upload to vector DB
 */
async function handleUpload() {
  const content = uploadContent.value.trim();
  const collection = uploadCollection.value;
  const title = uploadTitle.value.trim();
  const tags = uploadTags.value.trim();

  if (!content) {
    uploadStatus.textContent = 'Please enter some content to upload.';
    uploadStatus.className = 'error';
    return;
  }

  uploadBtn.disabled = true;
  uploadBtn.textContent = 'Uploading...';
  uploadStatus.textContent = '';
  uploadStatus.className = '';

  try {
    const metadata = {};
    if (title) metadata.title = title;
    if (tags) metadata.tags = tags.split(',').map(t => t.trim()).filter(Boolean);

    const result = await window.genie.uploadContent(content, collection, metadata);

    if (result.success) {
      uploadStatus.textContent = `Uploaded ${result.chunksCreated} chunk(s) to ${collection}s collection.`;
      uploadStatus.className = 'success';

      // Clear form
      uploadContent.value = '';
      uploadTitle.value = '';
      uploadTags.value = '';
    } else {
      throw new Error(result.error || 'Upload failed');
    }
  } catch (error) {
    uploadStatus.textContent = `Error: ${error.message}`;
    uploadStatus.className = 'error';
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Upload to Vector DB';
  }
}

function updateUI() {
  if (isExpanded) {
    collapsedEl.classList.add('hidden');
    expandedEl.classList.remove('hidden');
  } else {
    collapsedEl.classList.remove('hidden');
    expandedEl.classList.add('hidden');
  }
}

async function expand() {
  isExpanded = true;
  await window.genie.toggleExpand(true);
  updateUI();
}

async function collapse() {
  isExpanded = false;
  await window.genie.toggleExpand(false);
  updateUI();
}

async function captureScreen() {
  captureBtn.classList.add('capturing');

  try {
    const result = await window.genie.captureScreen();

    if (result.error) {
      if (result.permissionDenied) {
        // Show a more helpful message with option to open settings
        const msgEl = addMessage(
          `**Screen Recording Permission Required**\n\n` +
          `Genie needs permission to capture your screen.\n\n` +
          `1. Click "Open Settings" below\n` +
          `2. Enable "Genie" in Screen Recording\n` +
          `3. Restart Genie`,
          'assistant'
        );

        // Add settings button
        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'copy-btn';
        settingsBtn.textContent = 'Open Settings';
        settingsBtn.style.marginTop = '10px';
        settingsBtn.style.display = 'block';
        settingsBtn.addEventListener('click', () => {
          window.genie.openScreenRecordingSettings();
        });
        msgEl.querySelector('p').appendChild(settingsBtn);
      } else {
        showToast(result.error, true);
      }
      return;
    }

    currentScreenshot = result.image;
    screenshotImg.src = `data:image/png;base64,${result.image}`;
    screenPreview.classList.remove('hidden');
    captureBtn.classList.add('has-capture');

    showToast('Screen captured!');
  } catch (error) {
    showToast('Failed to capture screen', true);
    console.error(error);
  } finally {
    captureBtn.classList.remove('capturing');
  }
}

function clearScreenshot() {
  currentScreenshot = null;
  screenPreview.classList.add('hidden');
  captureBtn.classList.remove('has-capture');
}

function handleQuickAction(action) {
  // Some actions don't need a screenshot
  const noScreenshotActions = ['write-post'];

  if (!currentScreenshot && !noScreenshotActions.includes(action)) {
    showToast('Capture your screen first!', true);
    return;
  }

  const prompts = {
    'explain': 'What am I looking at? Explain what\'s on my screen.',
    'summarize': 'Summarize the main content visible on my screen.',
    'draft-reply': 'Draft a reply in my voice to the email or message visible on my screen. Keep it casual but professional.',
    'rewrite': 'Rewrite this text in my voice. Make it more engaging and direct while keeping the core message.'
  };

  const prompt = prompts[action];
  if (prompt) {
    userInput.value = prompt;
    sendMessage();
  }
}

async function sendMessage() {
  const message = userInput.value.trim();
  if (!message || isProcessing) return;

  // Add user message
  addMessage(message, 'user');
  userInput.value = '';
  userInput.style.height = 'auto';

  isProcessing = true;
  setButtonsDisabled(true);

  // Add loading message
  const loadingEl = addMessage('Thinking', 'assistant loading');

  try {
    const response = await callOpenAI(message, currentScreenshot);

    // Remove loading message
    loadingEl.remove();

    // Add response
    const responseEl = addMessage(response, 'assistant');

    // Add copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', () => copyToClipboard(response));
    responseEl.querySelector('p').appendChild(copyBtn);

  } catch (error) {
    loadingEl.remove();
    addMessage(`Error: ${error.message}`, 'assistant error');
  } finally {
    isProcessing = false;
    setButtonsDisabled(false);
  }
}

function addMessage(text, className) {
  const messageEl = document.createElement('div');
  messageEl.className = `message ${className}`;
  messageEl.innerHTML = `<p>${formatMessage(text)}</p>`;
  messagesEl.appendChild(messageEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return messageEl;
}

function formatMessage(text) {
  // Basic markdown-like formatting
  return text
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>');
}

function setButtonsDisabled(disabled) {
  sendBtn.disabled = disabled;
  captureBtn.disabled = disabled;
  quickActionBtns.forEach(btn => btn.disabled = disabled);
}

async function copyToClipboard(text) {
  try {
    await window.genie.copyToClipboard(text);
    showToast('Copied to clipboard!');
  } catch (error) {
    showToast('Failed to copy', true);
  }
}

function showToast(message, isError = false) {
  toastMessage.textContent = message;
  toast.className = isError ? 'error' : '';
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 2500);
}

// OpenAI API Integration with RAG
async function callOpenAI(prompt, screenshot, useRAG = false) {
  const apiKey = await window.genie.getOpenAIKey();

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set in .env file.');
  }

  // Fetch writing samples if this is a writing task
  let writingSamples = null;
  if (useRAG || shouldUseRAG(prompt)) {
    console.log('Fetching writing samples for RAG...');
    writingSamples = await fetchWritingSamples(prompt);
  }

  const content = [];

  // Add screenshot if available (GPT-4 Vision)
  if (screenshot) {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:image/png;base64,${screenshot}`,
        detail: 'high'
      }
    });
  }

  // Build the prompt with writing samples if available
  let fullPrompt = prompt;
  if (writingSamples) {
    fullPrompt = `Here are examples of Brian's writing style to reference:\n\n${writingSamples}\n\n---\n\nNow, ${prompt}`;
  }

  content.push({
    type: 'text',
    text: fullPrompt
  });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 2048,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: content }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'API request failed');
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Initialize app
init();
