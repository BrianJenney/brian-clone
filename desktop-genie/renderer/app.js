// State
let isExpanded = false;
let currentScreenshot = null;
let isProcessing = false;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

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
const tabTasks = document.getElementById('tab-tasks');
const uploadPanel = document.getElementById('upload-panel');
const tasksPanel = document.getElementById('tasks-panel');
const inputArea = document.getElementById('input-area');
const quickActions = document.getElementById('quick-actions');
const uploadCollection = document.getElementById('upload-collection');
const uploadTitle = document.getElementById('upload-title');
const uploadTags = document.getElementById('upload-tags');
const uploadContent = document.getElementById('upload-content');
const uploadBtn = document.getElementById('upload-btn');
const uploadStatus = document.getElementById('upload-status');

// Tasks Elements
const startRecordingBtn = document.getElementById('start-recording-btn');
const stopRecordingBtn = document.getElementById('stop-recording-btn');
const recordingIndicator = document.getElementById('recording-indicator');
const recordingTimer = document.getElementById('recording-timer');
const saveSessionForm = document.getElementById('save-session-form');
const sessionNameInput = document.getElementById('session-name-input');
const saveSessionBtn = document.getElementById('save-session-btn');
const discardSessionBtn = document.getElementById('discard-session-btn');
const refreshSessionsBtn = document.getElementById('refresh-sessions-btn');
const sessionsList = document.getElementById('sessions-list');
const sessionDetail = document.getElementById('session-detail');
const sessionsContainer = document.getElementById('sessions-container');
const backToListBtn = document.getElementById('back-to-list-btn');
const sessionDetailName = document.getElementById('session-detail-name');
const detailDuration = document.getElementById('detail-duration');
const detailEvents = document.getElementById('detail-events');
const detailScreenshots = document.getElementById('detail-screenshots');
const replayBtn = document.getElementById('replay-btn');
const replayAiBtn = document.getElementById('replay-ai-btn');
const aiConfig = document.getElementById('ai-config');
const personalizationPrompt = document.getElementById('personalization-prompt');
const startAiReplayBtn = document.getElementById('start-ai-replay-btn');
const deleteSessionBtn = document.getElementById('delete-session-btn');
const replayProgress = document.getElementById('replay-progress');
const replayProgressBar = document.getElementById('replay-progress-bar');
const replayStatusText = document.getElementById('replay-status-text');
const stopReplayBtn = document.getElementById('stop-replay-btn');

let currentTab = 'chat';
let recordingStartTime = null;
let recordingTimerInterval = null;
let pendingSession = null;
let selectedSession = null;
let sessions = [];

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
	const ragKeywords = [
		'write',
		'draft',
		'rewrite',
		'reply',
		'post',
		'article',
		'email',
		'respond',
		'compose',
		'create content',
	];
	return ragKeywords.some((keyword) => lowerPrompt.includes(keyword));
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
	// Make collapsed view draggable
	collapsedEl.addEventListener('mousedown', handleDragStart);
	document.addEventListener('mousemove', handleDragMove);
	document.addEventListener('mouseup', handleDragEnd);

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
	quickActionBtns.forEach((btn) => {
		btn.addEventListener('click', () => {
			const action = btn.dataset.action;
			handleQuickAction(action);
		});
	});

	// Tab switching
	tabChat.addEventListener('click', () => switchTab('chat'));
	tabUpload.addEventListener('click', () => switchTab('upload'));
	tabTasks.addEventListener('click', () => switchTab('tasks'));

	// Upload handler
	uploadBtn.addEventListener('click', handleUpload);

	// Tasks: Recording handlers
	startRecordingBtn.addEventListener('click', startRecording);
	stopRecordingBtn.addEventListener('click', stopRecording);

	// Tasks: Session management handlers
	saveSessionBtn.addEventListener('click', saveCurrentSession);
	discardSessionBtn.addEventListener('click', discardCurrentSession);
	refreshSessionsBtn.addEventListener('click', loadSessions);
	backToListBtn.addEventListener('click', showSessionsList);
	deleteSessionBtn.addEventListener('click', deleteCurrentSession);

	// Tasks: Replay handlers
	replayBtn.addEventListener('click', startReplay);
	replayAiBtn.addEventListener('click', toggleAiConfig);
	startAiReplayBtn.addEventListener('click', startAiReplay);
	stopReplayBtn.addEventListener('click', stopReplay);

	// Global mouse/keyboard event capturing during recording
	// Note: These are limited to the Electron window. For true global capture,
	// nut.js handles it in the main process
	document.addEventListener('click', handleGlobalClick);
	document.addEventListener('keydown', handleGlobalKeydown);
}

/**
 * Switch between Chat, Upload, and Tasks tabs
 */
function switchTab(tab) {
	currentTab = tab;

	// Update tab buttons
	tabChat.classList.toggle('active', tab === 'chat');
	tabUpload.classList.toggle('active', tab === 'upload');
	tabTasks.classList.toggle('active', tab === 'tasks');

	// Hide all panels first
	messagesEl.classList.add('hidden');
	quickActions.classList.add('hidden');
	inputArea.classList.add('hidden');
	screenPreview.classList.add('hidden');
	uploadPanel.classList.add('hidden');
	tasksPanel.classList.add('hidden');

	// Show relevant panel
	if (tab === 'chat') {
		messagesEl.classList.remove('hidden');
		quickActions.classList.remove('hidden');
		inputArea.classList.remove('hidden');
		screenPreview.classList.toggle('hidden', !currentScreenshot);
	} else if (tab === 'upload') {
		uploadPanel.classList.remove('hidden');
	} else if (tab === 'tasks') {
		tasksPanel.classList.remove('hidden');
		loadSessions(); // Refresh sessions when switching to tasks tab
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
		if (tags)
			metadata.tags = tags
				.split(',')
				.map((t) => t.trim())
				.filter(Boolean);

		const result = await window.genie.uploadContent(
			content,
			collection,
			metadata,
		);

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

function handleDragStart(e) {
	// Only drag with left mouse button
	if (e.button !== 0) return;

	isDragging = true;
	dragStartX = e.clientX;
	dragStartY = e.clientY;
	collapsedEl.style.cursor = 'grabbing';
}

function handleDragMove(e) {
	if (!isDragging) return;

	e.preventDefault();
	const deltaX = e.clientX - dragStartX;
	const deltaY = e.clientY - dragStartY;

	// If moved more than 5px, consider it a drag (not a click)
	if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
		// Send message to main process to move window
		// We'll need to add an IPC handler for this
		window.genie.moveWindow && window.genie.moveWindow(deltaX, deltaY);
		dragStartX = e.clientX;
		dragStartY = e.clientY;
	}
}

function handleDragEnd(e) {
	if (!isDragging) {
		return;
	}

	const deltaX = e.clientX - dragStartX;
	const deltaY = e.clientY - dragStartY;
	const hasMoved = Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5;

	isDragging = false;
	collapsedEl.style.cursor = '';

	// If didn't move much, treat it as a click to expand
	if (!hasMoved) {
		expand();
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
					'assistant',
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
		explain: "What am I looking at? Explain what's on my screen.",
		summarize: 'Summarize the main content visible on my screen.',
		'draft-reply':
			'Draft a reply in my voice to the email or message visible on my screen. Keep it casual but professional.',
		rewrite:
			'Rewrite this text in my voice. Make it more engaging and direct while keeping the core message.',
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
	quickActionBtns.forEach((btn) => (btn.disabled = disabled));
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
				detail: 'high',
			},
		});
	}

	// Build the prompt with writing samples if available
	let fullPrompt = prompt;
	if (writingSamples) {
		fullPrompt = `Here are examples of Brian's writing style to reference:\n\n${writingSamples}\n\n---\n\nNow, ${prompt}`;
	}

	content.push({
		type: 'text',
		text: fullPrompt,
	});

	const response = await fetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model: 'gpt-4o',
			max_tokens: 2048,
			messages: [
				{ role: 'system', content: SYSTEM_PROMPT },
				{ role: 'user', content: content },
			],
		}),
	});

	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error?.message || 'API request failed');
	}

	const data = await response.json();
	return data.choices[0].message.content;
}

// ============================================
// TASKS TAB FUNCTIONS
// ============================================

/**
 * Start recording user actions
 */
async function startRecording() {
	try {
		const result = await window.genie.startRecording();
		if (!result.success) {
			showToast(result.error || 'Failed to start recording', true);
			return;
		}

		// Update UI
		startRecordingBtn.classList.add('hidden');
		stopRecordingBtn.classList.remove('hidden');
		recordingIndicator.classList.remove('idle');
		recordingIndicator.classList.add('recording');

		// Start timer
		recordingStartTime = Date.now();
		recordingTimerInterval = setInterval(updateRecordingTimer, 1000);
		updateRecordingTimer();

		showToast('Recording started');
	} catch (error) {
		console.error('Start recording error:', error);
		showToast('Failed to start recording', true);
	}
}

/**
 * Stop recording and show save dialog
 */
async function stopRecording() {
	try {
		const result = await window.genie.stopRecording();
		if (!result.success) {
			showToast(result.error || 'Failed to stop recording', true);
			return;
		}

		// Stop timer
		if (recordingTimerInterval) {
			clearInterval(recordingTimerInterval);
			recordingTimerInterval = null;
		}

		// Update UI
		stopRecordingBtn.classList.add('hidden');
		startRecordingBtn.classList.remove('hidden');
		recordingIndicator.classList.remove('recording');
		recordingIndicator.classList.add('idle');

		// Store pending session for save
		pendingSession = result.session;

		// Show save form
		saveSessionForm.classList.remove('hidden');
		sessionNameInput.value = '';
		sessionNameInput.focus();

		showToast(
			`Recording stopped. ${result.session.events.length} events captured.`,
		);
	} catch (error) {
		console.error('Stop recording error:', error);
		showToast('Failed to stop recording', true);
	}
}

/**
 * Update the recording timer display
 */
function updateRecordingTimer() {
	if (!recordingStartTime) return;

	const elapsed = Date.now() - recordingStartTime;
	const minutes = Math.floor(elapsed / 60000);
	const seconds = Math.floor((elapsed % 60000) / 1000);
	recordingTimer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Save the current pending session
 */
async function saveCurrentSession() {
	if (!pendingSession) return;

	const name =
		sessionNameInput.value.trim() ||
		`Task ${new Date().toLocaleDateString()}`;

	try {
		const session = {
			...pendingSession,
			name,
		};

		const result = await window.genie.saveSession(session);
		if (!result.success) {
			showToast(result.error || 'Failed to save session', true);
			return;
		}

		// Clear pending session
		pendingSession = null;
		saveSessionForm.classList.add('hidden');
		recordingTimer.textContent = '00:00';

		// Refresh sessions list
		await loadSessions();

		showToast('Task saved successfully');
	} catch (error) {
		console.error('Save session error:', error);
		showToast('Failed to save session', true);
	}
}

/**
 * Discard the current pending session
 */
function discardCurrentSession() {
	pendingSession = null;
	saveSessionForm.classList.add('hidden');
	recordingTimer.textContent = '00:00';
	showToast('Recording discarded');
}

/**
 * Load and display all sessions
 */
async function loadSessions() {
	try {
		const result = await window.genie.listSessions();
		if (!result.success) {
			console.error('Failed to load sessions:', result.error);
			return;
		}

		sessions = result.sessions;
		renderSessionsList();
	} catch (error) {
		console.error('Load sessions error:', error);
	}
}

/**
 * Render the sessions list
 */
function renderSessionsList() {
	if (sessions.length === 0) {
		sessionsList.innerHTML = `
      <div class="empty-state">
        <span>No saved tasks yet</span>
        <span class="hint">Record your first task above</span>
      </div>
    `;
		return;
	}

	sessionsList.innerHTML = sessions
		.map(
			(session) => `
    <div class="session-item" data-id="${session.id}">
      <span class="session-icon">📋</span>
      <div class="session-info">
        <div class="session-name">${escapeHtml(session.name)}</div>
        <div class="session-meta">${formatDuration(session.duration)} • ${session.eventCount} events</div>
      </div>
      <span class="session-arrow">→</span>
    </div>
  `,
		)
		.join('');

	// Add click handlers
	sessionsList.querySelectorAll('.session-item').forEach((item) => {
		item.addEventListener('click', () => {
			const id = item.dataset.id;
			showSessionDetail(id);
		});
	});
}

/**
 * Show session detail view
 */
async function showSessionDetail(sessionId) {
	try {
		const result = await window.genie.loadSession(sessionId);
		if (!result.success) {
			showToast(result.error || 'Failed to load session', true);
			return;
		}

		selectedSession = result.session;

		// Update detail view
		sessionDetailName.textContent = selectedSession.name;
		detailDuration.textContent = formatDuration(selectedSession.duration);
		detailEvents.textContent = selectedSession.events?.length || 0;
		detailScreenshots.textContent =
			selectedSession.screenshots?.length || 0;

		// Hide AI config by default
		aiConfig.classList.add('hidden');

		// Show detail view, hide list
		sessionsContainer.classList.add('hidden');
		sessionDetail.classList.remove('hidden');
		replayProgress.classList.add('hidden');
	} catch (error) {
		console.error('Show session detail error:', error);
		showToast('Failed to load session', true);
	}
}

/**
 * Show sessions list view
 */
function showSessionsList() {
	selectedSession = null;
	sessionDetail.classList.add('hidden');
	sessionsContainer.classList.remove('hidden');
	replayProgress.classList.add('hidden');
}

/**
 * Delete the currently selected session
 */
async function deleteCurrentSession() {
	if (!selectedSession) return;

	const confirmed = confirm(
		`Delete "${selectedSession.name}"? This cannot be undone.`,
	);
	if (!confirmed) return;

	try {
		const result = await window.genie.deleteSession(selectedSession.id);
		if (!result.success) {
			showToast(result.error || 'Failed to delete session', true);
			return;
		}

		showToast('Task deleted');
		showSessionsList();
		await loadSessions();
	} catch (error) {
		console.error('Delete session error:', error);
		showToast('Failed to delete session', true);
	}
}

/**
 * Start basic replay
 */
async function startReplay() {
	if (!selectedSession) return;

	try {
		// Show replay progress
		sessionDetail.classList.add('hidden');
		replayProgress.classList.remove('hidden');
		replayProgressBar.style.width = '0%';
		replayStatusText.textContent = 'Starting replay...';

		const result = await window.genie.replaySession(selectedSession.id, {
			speed: 1.0,
		});

		if (!result.success) {
			showToast(result.error || 'Replay failed', true);
			replayProgress.classList.add('hidden');
			sessionDetail.classList.remove('hidden');
			return;
		}

		// Poll for status
		pollReplayStatus();
	} catch (error) {
		console.error('Start replay error:', error);
		showToast('Replay failed', true);
		replayProgress.classList.add('hidden');
		sessionDetail.classList.remove('hidden');
	}
}

/**
 * Toggle AI config panel
 */
function toggleAiConfig() {
	aiConfig.classList.toggle('hidden');
	if (!aiConfig.classList.contains('hidden')) {
		personalizationPrompt.focus();
	}
}

/**
 * Start AI-powered replay using Anthropic Computer Use
 */
async function startAiReplay() {
	if (!selectedSession) return;

	const prompt = personalizationPrompt.value.trim();
	if (!prompt) {
		showToast('Please enter task instructions for the AI', true);
		return;
	}

	try {
		// Show replay progress
		sessionDetail.classList.add('hidden');
		aiConfig.classList.add('hidden');
		replayProgress.classList.remove('hidden');
		replayProgressBar.style.width = '0%';
		replayStatusText.textContent = 'Starting AI Computer Use...';

		// Set up Computer Use event listeners
		setupComputerUseListeners();

		const result = await window.genie.replayWithAI(selectedSession.id, {
			personalizationPrompt: prompt,
			maxIterations: 30,
		});

		if (!result.success) {
			showToast(result.error || 'AI Computer Use failed', true);
			replayProgress.classList.add('hidden');
			sessionDetail.classList.remove('hidden');
			return;
		}

		// Success handled by event listeners
	} catch (error) {
		console.error('AI replay error:', error);
		showToast('AI Computer Use failed', true);
		replayProgress.classList.add('hidden');
		sessionDetail.classList.remove('hidden');
	}
}

/**
 * Set up event listeners for Computer Use progress
 */
function setupComputerUseListeners() {
	// Action events (click, type, etc.)
	window.genie.onComputerUseAction((data) => {
		const actionText = formatActionText(
			data.action,
			data.coordinate,
			data.text,
		);
		replayStatusText.textContent = actionText;
	});

	// Iteration progress
	window.genie.onComputerUseIteration((data) => {
		const progress = (data.current / data.max) * 100;
		replayProgressBar.style.width = `${progress}%`;
	});

	// Completion
	window.genie.onComputerUseCompleted((data) => {
		replayProgressBar.style.width = '100%';
		replayStatusText.textContent = data.message || 'Task completed!';
		showToast('AI task completed');

		setTimeout(() => {
			replayProgress.classList.add('hidden');
			sessionDetail.classList.remove('hidden');
		}, 2000);
	});

	// Error
	window.genie.onComputerUseError((data) => {
		showToast(data.message || 'AI error occurred', true);
		replayProgress.classList.add('hidden');
		sessionDetail.classList.remove('hidden');
	});
}

/**
 * Format action text for display
 */
function formatActionText(action, coordinate, text) {
	switch (action) {
		case 'left_click':
		case 'right_click':
		case 'double_click':
			return `🖱️ ${action.replace('_', ' ')} at (${coordinate?.[0] || 0}, ${coordinate?.[1] || 0})`;
		case 'type':
			const preview =
				text?.length > 30 ? text.substring(0, 30) + '...' : text;
			return `⌨️ Typing: "${preview}"`;
		case 'key':
			return `⌨️ Key: ${text}`;
		case 'scroll':
			return `🖱️ Scrolling...`;
		case 'screenshot':
			return `📸 Taking screenshot...`;
		case 'mouse_move':
			return `🖱️ Moving mouse...`;
		default:
			return `🤖 ${action}`;
	}
}

/**
 * Stop current replay (basic or AI Computer Use)
 */
async function stopReplay() {
	try {
		// Try to stop both types
		await window.genie.stopReplay();
		await window.genie.stopComputerUse();

		replayProgress.classList.add('hidden');
		sessionDetail.classList.remove('hidden');
		showToast('Stopped');
	} catch (error) {
		console.error('Stop replay error:', error);
	}
}

/**
 * Poll replay status
 */
async function pollReplayStatus() {
	const checkStatus = async () => {
		try {
			const status = await window.genie.getReplayStatus();

			if (!status.isReplaying) {
				// Replay finished
				replayProgressBar.style.width = '100%';
				replayStatusText.textContent = 'Replay complete!';

				setTimeout(() => {
					replayProgress.classList.add('hidden');
					sessionDetail.classList.remove('hidden');
				}, 1500);
				return;
			}

			// Update progress
			const progress =
				status.totalEvents > 0
					? (status.currentEventIndex / status.totalEvents) * 100
					: 0;
			replayProgressBar.style.width = `${progress}%`;
			replayStatusText.textContent = `Event ${status.currentEventIndex + 1} of ${status.totalEvents}`;

			// Continue polling
			setTimeout(checkStatus, 200);
		} catch (error) {
			console.error('Poll status error:', error);
		}
	};

	checkStatus();
}

/**
 * Handle global click events during recording
 */
async function handleGlobalClick(event) {
	try {
		const status = await window.genie.getRecordingStatus();
		if (status.isRecording) {
			// Record click with screen coordinates
			await window.genie.recordEvent('mouse_click', {
				button: event.button === 2 ? 'right' : 'left',
			});
		}
	} catch (error) {
		// Silently ignore - recording might not be active
	}
}

/**
 * Handle global keydown events during recording
 */
async function handleGlobalKeydown(event) {
	// Don't capture when typing in inputs
	if (
		event.target.tagName === 'INPUT' ||
		event.target.tagName === 'TEXTAREA'
	) {
		return;
	}

	try {
		const status = await window.genie.getRecordingStatus();
		if (status.isRecording) {
			await window.genie.recordEvent('key_press', {
				key: event.key,
			});
		}
	} catch (error) {
		// Silently ignore
	}
}

/**
 * Format duration in milliseconds to MM:SS
 */
function formatDuration(ms) {
	if (!ms) return '0:00';
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}

// Initialize app
init();
