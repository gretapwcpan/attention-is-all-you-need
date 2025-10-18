// AI MIND READER - Terminal Interface

let todayData = null;
let sessions = [];
let conversationContext = [];
let aiService = null;

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
  initializeMatrixRain();
  await loadTodayData();
  await loadSessions();
  await initializeAI();
  initializeChat();
  setupEventListeners();
});

// Initialize Matrix rain effect
function initializeMatrixRain() {
  const matrixContainer = document.getElementById('matrixRain');
  const characters = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
  const columns = 20;
  
  for (let i = 0; i < columns; i++) {
    const column = document.createElement('div');
    column.className = 'matrix-column';
    column.style.left = `${(i / columns) * 100}%`;
    column.style.animationDuration = `${Math.random() * 10 + 10}s`;
    column.style.animationDelay = `${Math.random() * 5}s`;
    
    // Generate random characters for the column
    let text = '';
    for (let j = 0; j < 100; j++) {
      text += characters[Math.floor(Math.random() * characters.length)] + '\n';
    }
    column.textContent = text;
    
    matrixContainer.appendChild(column);
  }
}

// Initialize AI service
async function initializeAI() {
  try {
    const { getAIService } = await import('../utils/ai-service.js');
    aiService = getAIService();
    const available = await aiService.initialize();
    console.log('AI Service available:', available);
  } catch (error) {
    console.error('Error initializing AI:', error);
  }
}

// Load today's data
async function loadTodayData() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getTodayData' });
    if (response && response.success) {
      todayData = response.data;
    }
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

// Load detailed session data with actual page titles
async function loadSessions() {
  try {
    const today = new Date().toDateString();
    const result = await chrome.storage.local.get(`sessions_${today}`);
    sessions = result[`sessions_${today}`] || [];
  } catch (error) {
    console.error('Error loading sessions:', error);
  }
}

// Initialize chat with greeting
function initializeChat() {
  const greeting = getGreeting();
  addMessage(greeting, 'coach');
  conversationContext.push({ role: 'assistant', content: greeting });
  updateStatus('Neural link established');
}

// Get personalized greeting based on reading data
function getGreeting() {
  const hour = new Date().getHours();
  let timePrefix = hour < 12 ? '[MORNING_PROTOCOL]' : hour < 18 ? '[DAY_PROTOCOL]' : '[NIGHT_PROTOCOL]';
  
  if (!sessions || sessions.length === 0) {
    return `${timePrefix} Neural terminal online. No data streams detected. Execute browsing sequence to begin analysis.`;
  }
  
  const recentPages = sessions.slice(-3).map(s => s.title);
  const totalMinutes = Math.floor(todayData.totalTime / 60000);
  
  if (recentPages.length > 0) {
    return `${timePrefix} Data stream active: "${truncateTitle(recentPages[0])}" [+${recentPages.length-1} nodes]. Duration: ${totalMinutes}min. Ready for synthesis.`;
  }
  
  return `${timePrefix} Session: ${totalMinutes}min. Neural patterns recorded. Awaiting command input.`;
}

// Setup event listeners
function setupEventListeners() {
  // Send button
  document.getElementById('sendButton').addEventListener('click', handleUserMessage);
  
  // Enter key in input
  document.getElementById('userInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleUserMessage();
    }
  });
  
  // Action buttons
  document.getElementById('getSummaryBtn').addEventListener('click', generateDailySummary);
  document.getElementById('getInsightsBtn').addEventListener('click', generateInsights);
  document.getElementById('closeBtn').addEventListener('click', () => window.close());
}

// Handle user message
async function handleUserMessage() {
  const input = document.getElementById('userInput');
  const message = input.value.trim();
  
  if (!message) return;
  
  // Add user message to UI and context
  addMessage(message, 'user');
  conversationContext.push({ role: 'user', content: message });
  input.value = '';
  
  // Show typing indicator
  showTyping();
  updateStatus('Processing neural pathways...');
  
  // Generate response
  try {
    let response;
    if (aiService && aiService.available) {
      // Use AI if available
      response = await generateAIResponse(message);
    } else {
      // Show detailed error information for troubleshooting
      const status = await aiService.checkAvailability();
      console.log('AI Service Status:', status);
      
      response = `AI Service Debug Information:\n\n`;
      response += `Status: ${status.status || 'unknown'}\n`;
      response += `Available: ${status.available ? 'Yes' : 'No'}\n`;
      response += `Message: ${status.message}\n\n`;
      
      // Check for specific API availability
      if (typeof self !== 'undefined') {
        if (self.ai?.languageModel) {
          response += `✓ New API (self.LanguageModel) detected\n`;
        } else {
          response += `✗ New API (self.LanguageModel) NOT found\n`;
        }
        
        if (self.LanguageModel) {
          response += `✓ Legacy API (self.LanguageModel) detected\n`;
        } else {
          response += `✗ Legacy API (self.LanguageModel) NOT found\n`;
        }
      }
      
      response += `\nChrome Version: ${navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 'Unknown'}\n`;
      response += `\nIf APIs are not detected:\n`;
      response += `1. Go to chrome://flags/#optimization-guide-on-device-model → Enable\n`;
      response += `2. Go to chrome://flags/#prompt-api-for-gemini-nano → Enable\n`;
      response += `3. Restart Chrome completely\n`;
      response += `\nFor detailed diagnostics, open test-chrome-ai.html in your browser.`;
    }
    hideTyping();
    addMessage(response, 'coach');
    conversationContext.push({ role: 'assistant', content: response });
  } catch (error) {
    console.error('Error generating response:', error);
    hideTyping();
    
    // Capture the actual error details with full stack trace
    let errorDetails = '';
    if (error.message) {
      errorDetails = error.message;
    } else if (typeof error === 'string') {
      errorDetails = error;
    } else {
      errorDetails = JSON.stringify(error);
    }
    
    // Create a detailed error message for debugging
    let errorMessage = "Error Details for Troubleshooting:\n\n";
    
    // Add full error information
    errorMessage += `Error Type: ${error.name || 'Unknown'}\n`;
    errorMessage += `Error Message: ${errorDetails}\n`;
    
    // Add stack trace if available
    if (error.stack) {
      errorMessage += `\nStack Trace:\n${error.stack.split('\n').slice(0, 5).join('\n')}\n`;
    }
    
    // Check AI service state
    if (aiService) {
      errorMessage += `\nAI Service State:\n`;
      errorMessage += `- Available: ${aiService.available}\n`;
      errorMessage += `- Availability: ${aiService.availability}\n`;
      errorMessage += `- Session exists: ${aiService.session ? 'Yes' : 'No'}\n`;
      errorMessage += `- Failure count: ${aiService.failureCount}/${aiService.maxFailures}\n`;
      errorMessage += `- Is healthy: ${aiService.isHealthy ? aiService.isHealthy() : 'N/A'}\n`;
    }
    
    // Add helpful instructions based on the error
    errorMessage += `\nTroubleshooting:\n`;
    if (errorDetails.includes('not available') || errorDetails.includes('AI service')) {
      errorMessage += "- Chrome AI may not be enabled or available\n";
      errorMessage += "- Check chrome://flags/#optimization-guide-on-device-model\n";
      errorMessage += "- Check chrome://flags/#prompt-api-for-gemini-nano\n";
    } else if (errorDetails.includes('session') || errorDetails.includes('abort')) {
      errorMessage += "- AI session was interrupted, try again\n";
    } else if (errorDetails.includes('crashed')) {
      errorMessage += "- Chrome AI model crashed, it will recover in ~1 minute\n";
    } else {
      errorMessage += "- Check browser console (F12) for more details\n";
      errorMessage += "- Open test-chrome-ai.html for full diagnostics\n";
    }
    
    addMessage(errorMessage, 'coach');
    conversationContext.push({ role: 'assistant', content: errorMessage });
  }
}

// Generate response using Gemini Nano with full context
async function generateAIResponse(userMessage) {
  try {
    // Check AI service availability with detailed status
    if (!aiService) {
      throw new Error('AI service not initialized. Please refresh the page.');
    }
    
    if (!aiService.available) {
      const status = await aiService.checkAvailability();
      throw new Error(`AI service not available. Status: ${status.message}`);
    }
    
    // Build context about current reading
    const readingContext = buildReadingContext();
    
    // Create a comprehensive prompt with full conversation history
    const prompt = `You are a user mind reader (browsing behavior) helping users understand and remember what they read. Be helpful, specific, and action-oriented.

Current Reading Context:
${readingContext}

Full Conversation History:
${conversationContext.slice(-8).map(msg => `${msg.role === 'user' ? 'User' : 'Coach'}: ${msg.content}`).join('\n')}

User's Current Message: ${userMessage}

Instructions:
- Provide helpful, specific responses about their reading habits and content
- If asked for suggestions, provide 2-3 actionable recommendations
- Reference specific articles from their reading history when relevant
- Keep responses concise but informative
- If they ask off-topic questions, gently redirect to reading-related help
- If they haven't read anything yet, encourage them to start browsing

Response:`;

    // Add options for language specification
    const options = {
      systemPrompt: "You are an user mind (browsing behavior) reader helping users understand and remember what they read. Always respond in English only.",
      temperature: 0.8,
      topK: 40
    };

    const response = await aiService.generateText(prompt, options);
    return response;
    
  } catch (error) {
    // Log detailed error information
    const errorInfo = {
      error: error,
      message: error.message,
      name: error.name,
      stack: error.stack,
      aiServiceAvailable: aiService?.available,
      aiServiceStatus: aiService?.availability,
      originalError: error.originalError
    };
    
    console.error('generateAIResponse error details:', errorInfo);
    
    // Create a more informative error for display
    const displayError = new Error(
      error.message || 'Failed to generate AI response'
    );
    displayError.details = errorInfo;
    
    // Re-throw with more context
    throw displayError;
  }
}

// Build context about current reading sessions
function buildReadingContext() {
  if (!sessions || sessions.length === 0) {
    return 'No reading sessions today yet.';
  }
  
  const recentSessions = sessions.slice(-5);
  const context = [];
  
  context.push(`Total reading time today: ${Math.floor(todayData.totalTime / 60000)} minutes`);
  context.push(`Recent articles read:`);
  
  recentSessions.forEach(session => {
    const minutes = Math.floor(session.duration / 60000);
    context.push(`- "${session.title}" (${minutes} min, ${session.category})`);
  });
  
  if (todayData.categories) {
    const topCategory = Object.entries(todayData.categories)
      .sort((a, b) => b[1] - a[1])[0];
    if (topCategory) {
      context.push(`Main focus area: ${topCategory[0]}`);
    }
  }
  
  return context.join('\n');
}


// Generate daily summary
async function generateDailySummary() {
  showTyping();
  updateStatus('Processing data streams...');
  
  setTimeout(() => {
    hideTyping();
    
    if (!sessions || sessions.length === 0) {
      const message = "[NO DATA] Neural pathways empty. Initialize browsing protocol to begin data collection.";
      addMessage(message, 'coach');
      conversationContext.push({ role: 'assistant', content: message });
      updateStatus('Awaiting input');
      return;
    }
    
    const totalMinutes = Math.floor(todayData.totalTime / 60000);
    const uniqueTitles = [...new Set(sessions.map(s => s.title))];
    const topPages = uniqueTitles.slice(0, 5).map(t => `> ${truncateTitle(t)}`).join('\n');
    
    const summary = `[DATA SYNTHESIS COMPLETE]\n\n` +
      `SESSION_DURATION: ${totalMinutes} minutes\n` +
      `NODES_ACCESSED: ${sessions.length}\n` +
      `UNIQUE_STREAMS: ${uniqueTitles.length}\n\n` +
      `[TOP NEURAL PATHWAYS]\n${topPages}\n\n` +
      `[END TRANSMISSION]`;
    
    addMessage(summary, 'coach');
    conversationContext.push({ role: 'assistant', content: summary });
    updateStatus('Analysis complete');
  }, 1500);
}

// Generate insights
async function generateInsights() {
  showTyping();
  
  try {
    let insights;
    
    if (aiService && aiService.available) {
      // Use AI to generate insights
      const prompt = `Based on this reading data, provide 3 specific, actionable insights:
      
${buildReadingContext()}

Provide exactly 3 insights that are:
1. Specific to the actual articles read
2. Actionable and helpful
3. Encouraging but honest

Format as a numbered list.`;
      
      // Add language specification options
      const options = {
        systemPrompt: "You are a helpful analytics assistant providing actionable insights. Always respond in English only.",
        temperature: 0.7
      };
      const response = await aiService.generateText(prompt, options);
      insights = response;
    } else {
      // Fallback insights
      insights = generateFallbackInsights();
    }
    
    hideTyping();
    updateStatus('Analysis complete');
    const message = `[COGNITIVE ANALYSIS]\n\n${insights}`;
    addMessage(message, 'coach');
    conversationContext.push({ role: 'assistant', content: message });
    
  } catch (error) {
    console.error('Error generating insights:', error);
    hideTyping();
    updateStatus('Analysis complete');
    const fallbackInsights = generateFallbackInsights();
    const message = `[COGNITIVE ANALYSIS]\n\n${fallbackInsights}`;
    addMessage(message, 'coach');
    conversationContext.push({ role: 'assistant', content: message });
  }
}

// Generate fallback insights when AI is not available
function generateFallbackInsights() {
  if (!todayData || todayData.totalTime === 0) {
    return "[NO DATA] Neural network requires input. Initialize browsing sequence.";
  }
  
  const insights = [];
  
  // Focus quality insight
  const deepPercent = Math.round((todayData.deepFocusTime / todayData.totalTime) * 100);
  if (deepPercent > 50) {
    insights.push("[FOCUS_OPTIMAL] Neural engagement exceeds 50% threshold. Deep learning patterns detected.");
  } else if (deepPercent > 25) {
    insights.push("[FOCUS_MODERATE] Neural patterns stable. Recommend extended sessions for enhanced synthesis.");
  } else {
    insights.push("[FOCUS_SCATTERED] Rapid context switching detected. Optimize for sustained engagement.");
  }
  
  // Category insight
  const topCategory = Object.entries(todayData.categories || {})
    .sort((a, b) => b[1] - a[1])[0];
  if (topCategory) {
    insights.push(`[PRIMARY_DOMAIN] ${topCategory[0]} - Maximum neural allocation`);
  }
  
  // Specific page insights
  if (sessions.length > 0) {
    const longSessions = sessions.filter(s => s.duration > 300000); // 5+ minutes
    if (longSessions.length > 0) {
      insights.push(`[DEEP_DIVE] Extended neural engagement: "${truncateTitle(longSessions[0].title)}"`);
    }
  }
  
  return insights.join('\n\n');
}

// Add message to chat with typing effect
function addMessage(text, sender) {
  const messagesDiv = document.getElementById('coachMessages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}`;
  
  if (sender === 'coach') {
    // Add typing effect for AI messages
    typeMessage(messageDiv, text, messagesDiv);
  } else {
    // Instant display for user messages
    messageDiv.innerHTML = text.replace(/\n/g, '<br>');
    messagesDiv.appendChild(messageDiv);
  }
  
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Typing effect for messages
function typeMessage(element, text, container) {
  let index = 0;
  const speed = 20; // milliseconds per character
  element.innerHTML = '';
  container.appendChild(element);
  
  function type() {
    if (index < text.length) {
      if (text.charAt(index) === '\n') {
        element.innerHTML += '<br>';
      } else {
        element.innerHTML += text.charAt(index);
      }
      index++;
      container.scrollTop = container.scrollHeight;
      setTimeout(type, speed);
    }
  }
  
  type();
}

// Show typing indicator
function showTyping() {
  const messagesDiv = document.getElementById('coachMessages');
  const typingDiv = document.createElement('div');
  typingDiv.className = 'typing-indicator';
  typingDiv.id = 'typingIndicator';
  
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('div');
    dot.className = 'typing-dot';
    typingDiv.appendChild(dot);
  }
  
  messagesDiv.appendChild(typingDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Hide typing indicator
function hideTyping() {
  const indicator = document.getElementById('typingIndicator');
  if (indicator) {
    indicator.remove();
  }
}

// Update status
function updateStatus(status) {
  const statusElement = document.getElementById('coachStatus');
  statusElement.textContent = status;
  // Add a flicker effect when status changes
  statusElement.style.animation = 'none';
  setTimeout(() => {
    statusElement.style.animation = 'blink 1s step-end 2';
  }, 10);
}

// Truncate long titles
function truncateTitle(title, maxLength = 60) {
  if (!title) return 'Untitled';
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength) + '...';
}
