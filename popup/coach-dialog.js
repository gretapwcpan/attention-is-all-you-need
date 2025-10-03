// browser content analyst Dialog JavaScript

let todayData = null;
let sessions = [];
let conversationContext = [];
let aiService = null;

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
  await loadTodayData();
  await loadSessions();
  await initializeAI();
  initializeChat();
  setupEventListeners();
});

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
  updateStatus('Ready to help');
}

// Get personalized greeting based on reading data
function getGreeting() {
  const hour = new Date().getHours();
  let timeGreeting = hour < 12 ? 'Good morning!' : hour < 18 ? 'Good afternoon!' : 'Good evening!';
  
  if (!sessions || sessions.length === 0) {
    return `${timeGreeting} I'm your browser content analyst. I'll help you understand and remember what you read. Start browsing to begin!`;
  }
  
  const recentPages = sessions.slice(-3).map(s => s.title);
  const totalMinutes = Math.floor(todayData.totalTime / 60000);
  
  if (recentPages.length > 0) {
    return `${timeGreeting} I see you've been reading about "${truncateTitle(recentPages[0])}" and more. You've spent ${totalMinutes} minutes reading today. How can I help you understand what you've learned?`;
  }
  
  return `${timeGreeting} You've spent ${totalMinutes} minutes reading today. Let me help you review what you've learned!`;
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
  
  // Generate response
  try {
    let response;
    if (aiService && aiService.available) {
      // Use AI if available
      response = await generateAIResponse(message);
    } else {
      // Show error when AI is not available
      response = "AI service is not available. Please enable Chrome AI by following the instructions in the README: Go to chrome://flags/#optimization-guide-on-device-model and chrome://flags/#prompt-api-for-gemini-nano, enable both flags, and restart Chrome.";
    }
    hideTyping();
    addMessage(response, 'coach');
    conversationContext.push({ role: 'assistant', content: response });
  } catch (error) {
    console.error('Error generating response:', error);
    hideTyping();
    const errorMessage = "I'm having trouble processing that right now. Please make sure Chrome AI is enabled.";
    addMessage(errorMessage, 'coach');
    conversationContext.push({ role: 'assistant', content: errorMessage });
  }
}

// Generate response using Gemini Nano with full context
async function generateAIResponse(userMessage) {
  if (!aiService || !aiService.available) {
    throw new Error('AI service not available');
  }
  
  // Build context about current reading
  const readingContext = buildReadingContext();
  
  // Create a comprehensive prompt with full conversation history
  const prompt = `You are an AI Reading Coach helping users understand and remember what they read. Be helpful, specific, and action-oriented.

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

  const response = await aiService.generateText(prompt);
  return response;
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
  
  setTimeout(() => {
    hideTyping();
    
    if (!sessions || sessions.length === 0) {
      const message = "No reading sessions yet today. Start exploring and I'll help you track your learning!";
      addMessage(message, 'coach');
      conversationContext.push({ role: 'assistant', content: message });
      return;
    }
    
    const totalMinutes = Math.floor(todayData.totalTime / 60000);
    const uniqueTitles = [...new Set(sessions.map(s => s.title))];
    const topPages = uniqueTitles.slice(0, 5).map(t => `• "${truncateTitle(t)}"`).join('\n');
    
    const summary = `📊 Today's Reading Summary:\n\n` +
      `Time spent: ${totalMinutes} minutes\n` +
      `Pages visited: ${sessions.length}\n` +
      `Unique articles: ${uniqueTitles.length}\n\n` +
      `Top pages you read:\n${topPages}\n\n` +
      `Keep up the great learning!`;
    
    addMessage(summary, 'coach');
    conversationContext.push({ role: 'assistant', content: summary });
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
      
      const response = await aiService.generateText(prompt);
      insights = response;
    } else {
      // Fallback insights
      insights = generateFallbackInsights();
    }
    
    hideTyping();
    const message = `🔍 Your Reading Insights:\n\n${insights}`;
    addMessage(message, 'coach');
    conversationContext.push({ role: 'assistant', content: message });
    
  } catch (error) {
    console.error('Error generating insights:', error);
    hideTyping();
    const fallbackInsights = generateFallbackInsights();
    const message = `🔍 Your Reading Insights:\n\n${fallbackInsights}`;
    addMessage(message, 'coach');
    conversationContext.push({ role: 'assistant', content: message });
  }
}

// Generate fallback insights when AI is not available
function generateFallbackInsights() {
  if (!todayData || todayData.totalTime === 0) {
    return "No reading data yet. Start browsing to get personalized insights!";
  }
  
  const insights = [];
  
  // Focus quality insight
  const deepPercent = Math.round((todayData.deepFocusTime / todayData.totalTime) * 100);
  if (deepPercent > 50) {
    insights.push("🎯 Excellent focus! Over half your time was in deep concentration.");
  } else if (deepPercent > 25) {
    insights.push("📖 Good reading habits. Try longer sessions for deeper understanding.");
  } else {
    insights.push("⚡ Quick scanning mode. Consider slowing down on important articles.");
  }
  
  // Category insight
  const topCategory = Object.entries(todayData.categories || {})
    .sort((a, b) => b[1] - a[1])[0];
  if (topCategory) {
    insights.push(`📚 Main focus area: ${topCategory[0]}`);
  }
  
  // Specific page insights
  if (sessions.length > 0) {
    const longSessions = sessions.filter(s => s.duration > 300000); // 5+ minutes
    if (longSessions.length > 0) {
      insights.push(`💡 Deep dive: You spent quality time on "${truncateTitle(longSessions[0].title)}"`);
    }
  }
  
  return insights.join('\n\n');
}

// Add message to chat
function addMessage(text, sender) {
  const messagesDiv = document.getElementById('coachMessages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}`;
  
  // Convert line breaks to <br> for proper display
  messageDiv.innerHTML = text.replace(/\n/g, '<br>');
  
  // Add timestamp
  const timeDiv = document.createElement('div');
  timeDiv.className = 'message-time';
  timeDiv.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  messageDiv.appendChild(timeDiv);
  
  messagesDiv.appendChild(messageDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
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
  document.getElementById('coachStatus').textContent = status;
}

// Truncate long titles
function truncateTitle(title, maxLength = 60) {
  if (!title) return 'Untitled';
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength) + '...';
}
