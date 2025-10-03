// Attention Analytics - Background Service Worker

// Import AI and character modules
import { getAIService } from '../utils/ai-service.js';
import { getAISummarizer } from '../utils/ai-summarizer.js';

// Current tab tracking
let activeTab = null;
let sessionStartTime = null;
let sessionTimer = null;

// Initialize AI and summarizer services
let aiService = null;
let aiSummarizer = null;
let todoMapper = null;

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Attention Analytics installed');
  
  // Initialize storage with default data
  await initializeStorage();
  
  // Initialize AI services
  await initializeAIServices();
  
  // Set up alarms for periodic data processing
  chrome.alarms.create('processData', { periodInMinutes: 5 });
  chrome.alarms.create('dailyReset', { when: getNextMidnight() });
});

// Initialize AI services
async function initializeAIServices() {
  try {
    aiService = getAIService();
    aiSummarizer = getAISummarizer();
    
    // Initialize AI service
    const aiAvailable = await aiService.initialize();
    console.log('AI Service available:', aiAvailable);
    
    // Initialize summarizer
    await aiSummarizer.initialize();
    console.log('AI Summarizer initialized');
    
    // Initialize todo mapper for smart tracking
    try {
      // Dynamic import to avoid module issues
      const TodoAIMapper = (await import('../utils/todo-ai-mapper.js')).default;
      todoMapper = new TodoAIMapper();
      console.log('Todo AI Mapper initialized');
    } catch (err) {
      console.log('Todo mapper not available:', err);
    }
    
  } catch (error) {
    console.error('Error initializing AI services:', error);
  }
}

// Initialize storage
async function initializeStorage() {
  const existing = await getFromStorage('initialized');
  if (!existing) {
    await setInStorage('initialized', true);
    await setInStorage('version', '2.0.0');
    await setInStorage('settings', {
      trackingEnabled: true,
      notificationsEnabled: true,
      darkMode: false,
      focusThreshold: 10,
      breakReminder: 60,
      dailyGoal: 240
    });
    
    // Initialize today's data
    const today = new Date().toDateString();
    await setInStorage(`analytics_${today}`, {
      date: today,
      totalTime: 0,
      deepFocusTime: 0,
      activeReadingTime: 0,
      scanningTime: 0,
      categories: {},
      uniqueSites: [],
      topics: [],
      sessions: []
    });
  }
}

// Storage helpers
async function getFromStorage(key) {
  try {
    const result = await chrome.storage.local.get([key]);
    return result[key];
  } catch (error) {
    console.error('Storage get error:', error);
    return null;
  }
}

async function setInStorage(key, value) {
  try {
    await chrome.storage.local.set({ [key]: value });
    return true;
  } catch (error) {
    console.error('Storage set error:', error);
    return false;
  }
}

// Handle tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  // End previous session
  if (activeTab && sessionStartTime) {
    await endSession();
  }
  
  // Start new session
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab && tab.url) {
      startSession(tab);
    }
  } catch (error) {
    console.error('Error getting tab:', error);
  }
});

// Handle tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab && tab.active) {
    // End previous session and start new one
    if (activeTab && sessionStartTime) {
      await endSession();
    }
    if (tab.url) {
      startSession(tab);
    }
  }
});

// Handle window focus changes
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus - pause tracking
    if (activeTab && sessionStartTime) {
      await endSession();
      activeTab = null;
    }
  } else {
    // Browser gained focus - resume tracking
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs.length > 0 && tabs[0].url) {
        startSession(tabs[0]);
      }
    } catch (error) {
      console.error('Error querying tabs:', error);
    }
  }
});

// Start a browsing session
function startSession(tab) {
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    return;
  }
  
  try {
    activeTab = {
      id: tab.id,
      url: tab.url,
      title: tab.title || 'Untitled',
      domain: new URL(tab.url).hostname
    };
    
    sessionStartTime = Date.now();
    
    // Start session timer to track active time
    clearInterval(sessionTimer);
    sessionTimer = setInterval(async () => {
      // Check if tab is still active
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs.length > 0 && activeTab && tabs[0].id !== activeTab.id) {
          await endSession();
        }
      } catch (error) {
        console.error('Error checking active tab:', error);
      }
    }, 1000);
  } catch (error) {
    console.error('Error starting session:', error);
  }
}

// End a browsing session
async function endSession() {
  if (!activeTab || !sessionStartTime) return;
  
  const sessionDuration = Date.now() - sessionStartTime;
  
  // Only track sessions longer than 3 seconds
  if (sessionDuration > 3000) {
    const session = {
      url: activeTab.url,
      title: activeTab.title,
      domain: activeTab.domain,
      startTime: sessionStartTime,
      endTime: Date.now(),
      duration: sessionDuration,
      category: categorizeUrl(activeTab.url),
      focusType: determineFocusType(sessionDuration)
    };
    
    // Save session data
    await addSession(session);
    
    // Update today's analytics
    await updateAnalytics(session);
    
    // Try to generate a summary for this session
    await tryGenerateSummary(session);
  }
  
  // Clear session data
  clearInterval(sessionTimer);
  activeTab = null;
  sessionStartTime = null;
}

// Try to generate a summary for the session
async function tryGenerateSummary(session) {
  try {
    if (!aiSummarizer) return;
    
    // Get page content if available
    const pageData = {
      url: session.url,
      title: session.title,
      domain: session.domain,
      category: session.category,
      timeSpent: session.duration,
      content: '' // Will be filled by content script
    };
    
    // Send page data to todo mapper for smart tracking
    if (todoMapper && activeTab) {
      chrome.runtime.sendMessage({
        action: 'pageContent',
        data: pageData
      }).catch(() => {
        // Ignore if todo mapper is not ready
      });
    }
    
    // Try to get content from the active tab
    if (activeTab && activeTab.id) {
      try {
        const response = await chrome.tabs.sendMessage(activeTab.id, { 
          action: 'getPageContent' 
        });
        if (response && response.content) {
          pageData.content = response.content;
        }
      } catch (error) {
        console.log('Could not get page content:', error);
      }
    }
    
    // Check if we should summarize this page
    if (!aiSummarizer.shouldSummarize(pageData)) {
      return;
    }
    
    // Generate summary
    const summary = await aiSummarizer.summarizePage(pageData);
    
    // Save summary to storage
    const summaries = await getFromStorage('readingSummaries') || [];
    summaries.unshift(summary);
    
    // Keep only last 20 summaries
    if (summaries.length > 20) {
      summaries.pop();
    }
    
    await setInStorage('readingSummaries', summaries);
    
    // Notify popup if open
    chrome.runtime.sendMessage({
      action: 'summaryGenerated',
      summary: summary
    }).catch(() => {
      // Popup might not be open, ignore error
    });
    
    console.log('Summary generated for:', session.title);
    
  } catch (error) {
    console.error('Error generating summary:', error);
  }
}

// Categorize URL
function categorizeUrl(url) {
  try {
    const domain = new URL(url).hostname.toLowerCase();
    
    const categories = {
      'Learning': ['coursera', 'udemy', 'edx', 'khanacademy', 'skillshare', 'pluralsight'],
      'Development': ['github', 'stackoverflow', 'dev.to', 'codepen', 'gitlab', 'bitbucket'],
      'Research': ['scholar.google', 'arxiv', 'pubmed', 'jstor', 'researchgate'],
      'Documentation': ['docs', 'developer', 'api', 'reference', 'wiki', 'mdn'],
      'News': ['news', 'techcrunch', 'hackernews', 'reuters', 'bloomberg', 'wsj'],
      'Social': ['twitter', 'linkedin', 'facebook', 'reddit', 'instagram', 'youtube'],
      'Reading': ['medium', 'substack', 'blog', 'article', 'post'],
      'Reference': ['wikipedia', 'dictionary', 'thesaurus', 'translate']
    };
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => domain.includes(keyword))) {
        return category;
      }
    }
    
    return 'Exploring';
  } catch (error) {
    console.error('Error categorizing URL:', error);
    return 'Exploring';
  }
}

// Determine focus type based on session duration
function determineFocusType(duration) {
  const minutes = duration / 60000;
  if (minutes >= 10) return 'deep';
  if (minutes >= 5) return 'active';
  return 'scanning';
}

// Add session to storage
async function addSession(session) {
  const today = new Date().toDateString();
  const sessionsKey = `sessions_${today}`;
  
  const sessions = await getFromStorage(sessionsKey) || [];
  sessions.push(session);
  
  // Keep only last 100 sessions per day
  if (sessions.length > 100) {
    sessions.shift();
  }
  
  await setInStorage(sessionsKey, sessions);
}

// Update analytics data
async function updateAnalytics(session) {
  const today = new Date().toDateString();
  const analytics = await getFromStorage(`analytics_${today}`) || {
    date: today,
    totalTime: 0,
    deepFocusTime: 0,
    activeReadingTime: 0,
    scanningTime: 0,
    categories: {},
    uniqueSites: [],
    topics: [],
    sessions: []
  };
  
  // Update total time
  analytics.totalTime += session.duration;
  
  // Update focus type times
  switch (session.focusType) {
    case 'deep':
      analytics.deepFocusTime += session.duration;
      break;
    case 'active':
      analytics.activeReadingTime += session.duration;
      break;
    case 'scanning':
      analytics.scanningTime += session.duration;
      break;
  }
  
  // Update categories
  if (!analytics.categories[session.category]) {
    analytics.categories[session.category] = 0;
  }
  analytics.categories[session.category] += session.duration;
  
  // Update unique sites
  if (!analytics.uniqueSites.includes(session.domain)) {
    analytics.uniqueSites.push(session.domain);
  }
  
  // Extract and update topics
  const topics = extractTopics(session.title);
  topics.forEach(topic => {
    if (!analytics.topics.includes(topic)) {
      analytics.topics.push(topic);
    }
  });
  
  // Add session to list
  analytics.sessions.push({
    title: session.title,
    domain: session.domain,
    category: session.category,
    duration: session.duration,
    focusType: session.focusType,
    timestamp: session.startTime
  });
  
  // Save updated analytics
  await setInStorage(`analytics_${today}`, analytics);
}

// Extract topics from title
function extractTopics(title) {
  const topics = [];
  
  if (!title) return topics;
  
  const topicPatterns = {
    'JavaScript': /javascript|js|node|react|vue|angular/i,
    'Python': /python|django|flask|pandas|numpy/i,
    'AI/ML': /artificial intelligence|machine learning|ai|ml|deep learning|neural/i,
    'Data Science': /data science|analytics|visualization|statistics/i,
    'Web Development': /web dev|frontend|backend|fullstack|css|html/i,
    'Cloud': /aws|azure|gcp|cloud|kubernetes|docker/i,
    'Security': /security|cybersecurity|encryption|vulnerability/i,
    'Design': /design|ux|ui|figma|sketch|adobe/i,
    'Business': /business|marketing|sales|strategy|management/i,
    'Finance': /finance|investment|trading|crypto|stock/i
  };
  
  for (const [topic, pattern] of Object.entries(topicPatterns)) {
    if (pattern.test(title)) {
      topics.push(topic);
    }
  }
  
  return topics.slice(0, 5);
}

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender, sendResponse);
  return true; // Keep message channel open for async response
});

async function handleMessage(request, sender, sendResponse) {
  try {
    switch (request.action) {
      case 'getTodayData':
        const today = new Date().toDateString();
        const data = await getFromStorage(`analytics_${today}`) || generateEmptyData();
        
        // Convert arrays to Sets for the popup
        if (data.uniqueSites) {
          data.uniqueSites = new Set(data.uniqueSites);
        }
        if (data.topics) {
          data.topics = new Set(data.topics);
        }
        
        sendResponse({ success: true, data });
        break;
        
      case 'getWeekData':
        const weekData = await getWeekAnalytics();
        sendResponse({ success: true, data: weekData });
        break;
        
      case 'setIntention':
        await setInStorage('todayIntention', request.intention);
        sendResponse({ success: true });
        break;
        
      case 'getIntention':
        const intention = await getFromStorage('todayIntention');
        sendResponse({ success: true, data: intention });
        break;
        
      case 'getTodoProgress':
        // Get todo progress summary
        if (todoMapper) {
          const progress = await todoMapper.getProgressSummary();
          sendResponse({ success: true, data: progress });
        } else {
          sendResponse({ success: false, error: 'Todo mapper not initialized' });
        }
        break;
        
      case 'suggestTodos':
        // Suggest relevant todos based on current page
        if (todoMapper && request.url && request.title) {
          const suggestions = await todoMapper.suggestRelevantTodos(request.url, request.title);
          sendResponse({ success: true, data: suggestions });
        } else {
          sendResponse({ success: false, error: 'Missing data or mapper not initialized' });
        }
        break;
        
      case 'exportData':
        const allData = await chrome.storage.local.get(null);
        sendResponse({ success: true, data: allData });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Get analytics for the past week
async function getWeekAnalytics() {
  const weekData = [];
  const today = new Date();
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateString = date.toDateString();
    
    const dayData = await getFromStorage(`analytics_${dateString}`);
    if (dayData) {
      weekData.push(dayData);
    }
  }
  
  return weekData;
}

// Handle alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'processData') {
    // Process and aggregate data periodically
    await processData();
  } else if (alarm.name === 'dailyReset') {
    // Reset daily data at midnight
    await dailyReset();
    // Set next midnight alarm
    chrome.alarms.create('dailyReset', { when: getNextMidnight() });
  }
});

// Process data periodically
async function processData() {
  // End current session if idle too long
  if (sessionStartTime && Date.now() - sessionStartTime > 600000) { // 10 minutes
    await endSession();
  }
}

// Daily reset
async function dailyReset() {
  // Archive yesterday's data
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayString = yesterday.toDateString();
  
  const yesterdayData = await getFromStorage(`analytics_${yesterdayString}`);
  if (yesterdayData) {
    await setInStorage(`archive_${yesterdayString}`, yesterdayData);
  }
  
  // Clear intention
  await chrome.storage.local.remove('todayIntention');
}

// Get next midnight timestamp
function getNextMidnight() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.getTime();
}

// Generate empty data structure
function generateEmptyData() {
  return {
    date: new Date().toDateString(),
    totalTime: 0,
    deepFocusTime: 0,
    activeReadingTime: 0,
    scanningTime: 0,
    categories: {},
    uniqueSites: new Set(),
    topics: new Set(),
    sessions: []
  };
}

// Listen for browser idle state - only if API is available
if (chrome.idle && chrome.idle.setDetectionInterval) {
  chrome.idle.setDetectionInterval(60); // Check every minute
  chrome.idle.onStateChanged.addListener(async (newState) => {
    if (newState === 'idle' || newState === 'locked') {
      // End session when user is idle
      if (activeTab && sessionStartTime) {
        await endSession();
      }
    }
  });
}
