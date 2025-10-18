// FocusFlow - Background Service Worker
// Roam Less. Gather More.

// Import AI and character modules
import { getAIService } from '../utils/ai-service.js';
import { getAISummarizer } from '../utils/ai-summarizer.js';
import { BrowsingTracker } from '../utils/browsing-tracker.js';
import { PDFExtractor } from '../utils/pdf-extractor.js';

// Note: TodoAIMapper cannot be dynamically imported in service workers
// We'll handle it through message passing instead

// Current tab tracking
let activeTab = null;
let sessionStartTime = null;
let sessionTimer = null;
let sessionContent = null; // Store content for current session

// Session deduplication cache to prevent multiple sessions for same URL
const sessionCache = new Map();
const SESSION_CACHE_DURATION = 10000; // 10 seconds to prevent rapid duplicates

// Initialize AI and summarizer services
let aiService = null;
let aiSummarizer = null;
let todoMapperAvailable = false;
let browsingTracker = null;
let pdfExtractor = null;

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('🚀 Attention Is All You Need installed');
  
  // Initialize storage with default data
  await initializeStorage();
  
  // Initialize AI services
  await initializeAIServices();
  
  // Set up alarms for periodic data processing
  chrome.alarms.create('processData', { periodInMinutes: 5 });
  chrome.alarms.create('dailyReset', { when: getNextMidnight() });
  
  console.log('✅ Extension initialization complete');
});

// Also initialize on startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('🔄 Extension starting up');
  await initializeAIServices();
});

// Initialize AI services with retry logic
async function initializeAIServices() {
  try {
    console.log('🔄 Starting AI services initialization...');
    
    aiService = getAIService();
    aiSummarizer = getAISummarizer();
    
    // Initialize AI service
    const aiAvailable = await aiService.initialize();
    console.log('✅ AI Service available:', aiAvailable);
    
    // Initialize summarizer
    await aiSummarizer.initialize();
    console.log('✅ AI Summarizer initialized');
    
    // Initialize BrowsingTracker with better error handling and retry
    if (!browsingTracker) {
      try {
        console.log('🔄 Creating new BrowsingTracker instance...');
        browsingTracker = new BrowsingTracker();
        console.log('✅ BrowsingTracker instance created');
        
        // Try to initialize services with detailed logging
        console.log('🔄 Initializing BrowsingTracker services...');
        const initResult = await browsingTracker.initializeServices();
        
        if (initResult) {
          console.log('✅ BrowsingTracker initialized successfully');
        } else {
          console.log('⚠️ BrowsingTracker initialized with warnings - will retry');
          // Schedule a retry after 2 seconds
          setTimeout(async () => {
            try {
              console.log('🔄 Retrying BrowsingTracker initialization...');
              const retryResult = await browsingTracker.initializeServices();
              console.log('✅ BrowsingTracker retry result:', retryResult);
            } catch (retryError) {
              console.error('❌ BrowsingTracker retry failed:', retryError);
            }
          }, 2000);
        }
      } catch (error) {
        console.error('❌ Failed to initialize BrowsingTracker:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack
        });
        
        // Keep the instance and try again later
        if (!browsingTracker) {
          try {
            console.log('🔄 Creating BrowsingTracker instance despite error...');
            browsingTracker = new BrowsingTracker();
            console.log('✅ BrowsingTracker instance created (will retry initialization)');
            
            // Schedule initialization retry
            setTimeout(async () => {
              try {
                console.log('🔄 Delayed initialization attempt for BrowsingTracker...');
                await browsingTracker.initializeServices();
                console.log('✅ BrowsingTracker delayed initialization successful');
              } catch (delayedError) {
                console.error('⚠️ BrowsingTracker delayed initialization failed:', delayedError);
              }
            }, 3000);
          } catch (instanceError) {
            console.error('❌ Could not create BrowsingTracker instance:', instanceError);
          }
        }
      }
    } else {
      console.log('ℹ️ BrowsingTracker already exists, re-initializing services');
      try {
        await browsingTracker.initializeServices();
        console.log('✅ BrowsingTracker services re-initialized');
      } catch (error) {
        console.error('⚠️ Error re-initializing BrowsingTracker services:', error);
      }
    }
    
    // Initialize PDFExtractor with retry
    if (!pdfExtractor) {
      try {
        pdfExtractor = new PDFExtractor();
        console.log('✅ PDFExtractor initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize PDFExtractor:', error);
        pdfExtractor = null;
      }
    }
    
    // Mark todo mapper as available (we'll handle it through message passing)
    // Service workers cannot use dynamic import(), so we'll skip direct initialization
    todoMapperAvailable = true;
    console.log('✅ Todo mapper marked as available for message passing');
    
    console.log('🎉 AI services initialization complete');
    
  } catch (error) {
    console.error('❌ Error initializing AI services:', error);
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
  console.log('📌 Tab activated:', activeInfo.tabId);
  
  // Get tab info
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    console.log('  ↳ Tab info:', { id: tab.id, url: tab.url, title: tab.title });
    
    // Check if we already have an active session for this exact URL
    if (activeTab && activeTab.url === tab.url && activeTab.id === tab.id) {
      console.log('  ↳ Same tab and URL, continuing existing session');
      return; // Don't restart session for same URL
    }
    
    // End previous session if different URL
    if (activeTab && sessionStartTime && activeTab.url !== tab.url) {
      console.log('  ↳ Ending previous session for tab:', activeTab.id);
      await endSession();
    }
    
    // Start new session only if URL is valid and different
    if (tab && tab.url && (!activeTab || activeTab.url !== tab.url)) {
      startSession(tab);
    } else {
      console.log('  ↳ Tab has no URL or same URL, skipping');
    }
  } catch (error) {
    console.error('❌ Error getting tab:', error);
  }
});

// Handle tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    console.log('🔄 Tab updated:', tabId, 'Status:', changeInfo.status, 'URL:', tab.url);
    
    // Check if this is actually a new URL or just a reload
    if (activeTab && activeTab.id === tabId && activeTab.url === tab.url) {
      console.log('  ↳ Same URL, just a reload/update - keeping session');
      // Update title if changed
      if (tab.title && activeTab.title !== tab.title) {
        activeTab.title = tab.title;
      }
      return; // Don't restart session for same URL
    }
    
    // Only process if URL actually changed
    if (tab && tab.active && tab.url) {
      // Check if URL is different from active session
      if (!activeTab || activeTab.url !== tab.url) {
        // End previous session if exists
        if (activeTab && sessionStartTime) {
          console.log('  ↳ URL changed, ending previous session');
          await endSession();
        }
        console.log('  ↳ Starting new session for:', tab.url);
        startSession(tab);
      }
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
async function startSession(tab) {
  console.log('🎬 Starting session for:', tab.url);
  
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    console.log('  ↳ Skipping - internal URL');
    return;
  }
  
  // Check session cache to prevent rapid duplicate sessions
  const cacheKey = tab.url;
  const cachedTime = sessionCache.get(cacheKey);
  const now = Date.now();
  
  if (cachedTime && (now - cachedTime) < SESSION_CACHE_DURATION) {
    console.log(`  ↳ Session recently started for this URL (${Math.round((now - cachedTime) / 1000)}s ago), skipping duplicate`);
    return;
  }
  
  // Add to session cache
  sessionCache.set(cacheKey, now);
  
  // Clean old cache entries
  for (const [url, time] of sessionCache.entries()) {
    if (now - time > SESSION_CACHE_DURATION * 2) {
      sessionCache.delete(url);
    }
  }
  
  try {
    activeTab = {
      id: tab.id,
      url: tab.url,
      title: tab.title || 'Untitled',
      domain: new URL(tab.url).hostname
    };
    
    sessionStartTime = Date.now();
    sessionContent = null; // Reset content for new session
    
    console.log('  ↳ Session started:', {
      tabId: activeTab.id,
      domain: activeTab.domain,
      startTime: new Date(sessionStartTime).toLocaleTimeString()
    });
    
    // Try to get page content immediately with retries
    await getPageContent(tab.id);
    
    // Start session timer to track active time
    clearInterval(sessionTimer);
    sessionTimer = setInterval(async () => {
      // Check if tab is still active
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs.length > 0 && activeTab) {
          // Check if active tab changed
          if (tabs[0].id !== activeTab.id) {
            console.log('  ↳ Tab no longer active, ending session');
            await endSession();
          } else if (tabs[0].url !== activeTab.url) {
            // URL changed in the same tab
            console.log('  ↳ URL changed in active tab, ending session');
            await endSession();
          }
        }
        
        // Periodically try to get content if we don't have it yet
        if (!sessionContent && activeTab) {
          await getPageContent(activeTab.id, 1); // Single retry in timer
        }
      } catch (error) {
        console.error('❌ Error in session timer:', error);
      }
    }, 5000); // Check every 5 seconds
  } catch (error) {
    console.error('❌ Error starting session:', error);
  }
}

// Get page content from content script with retries
async function getPageContent(tabId, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // First check if tab still exists
      const tab = await chrome.tabs.get(tabId).catch(() => null);
      if (!tab) {
        console.log('Tab no longer exists');
        return null;
      }
      
      // Skip chrome:// and extension pages
      if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://'))) {
        console.log('Skipping internal URL');
        return null;
      }
      
      // Try to inject content script if not already present
      if (attempt === 0) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content/content-script.js']
          });
          // Wait a bit for script to initialize
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (e) {
          // Script might already be injected or page doesn't allow injection
          console.log('Content script injection attempt:', e.message);
        }
      }
      
      // Try to get content
      const response = await chrome.tabs.sendMessage(tabId, { 
        action: 'getPageContent' 
      }).catch(() => null);
      
      if (response && response.content) {
        sessionContent = response;  // Store the entire response object
        console.log('✅ Page content captured for knowledge extraction:', {
          hasContent: !!response.content,
          contentLength: response.content.length,
          hasHeadings: !!response.headings,
          title: response.title,
          attempt: attempt + 1
        });
        return response;
      } else {
        console.log(`⚠️ No content received from content script (attempt ${attempt + 1}/${maxRetries})`);
        if (attempt < maxRetries - 1) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
      console.log(`⏳ Content script error (attempt ${attempt + 1}/${maxRetries}):`, error.message);
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
  
  // If all retries failed, try to extract basic content from tab info
  try {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (tab && tab.title && tab.url) {
      const fallbackContent = {
        content: tab.title,  // Use title as minimal content
        headings: [tab.title],
        title: tab.title,
        url: tab.url,
        domain: new URL(tab.url).hostname,
        description: '',
        keywords: '',
        author: ''
      };
      sessionContent = fallbackContent;
      console.log('⚠️ Using fallback content from tab info');
      return fallbackContent;
    }
  } catch (e) {
    console.error('Failed to get fallback content:', e);
  }
  
  return null;
}

// End a browsing session
async function endSession() {
  if (!activeTab || !sessionStartTime) {
    console.log('🛑 No active session to end');
    return;
  }
  
  const sessionDuration = Date.now() - sessionStartTime;
  const durationSeconds = Math.round(sessionDuration / 1000);
  console.log('🏁 Ending session:', {
    url: activeTab.url,
    duration: durationSeconds + ' seconds',
    durationMs: sessionDuration + 'ms',
    hasContent: !!sessionContent
  });
  
  // Update session cache with end time to prevent immediate restart
  sessionCache.set(activeTab.url, Date.now());
  
  // Try one more time to get content if we don't have it
  if (!sessionContent && activeTab && activeTab.id) {
    console.log('  ↳ Final attempt to get page content...');
    await getPageContent(activeTab.id, 2);
  }
  
  // Track sessions longer than 5 seconds
  if (sessionDuration > 5000) {
    // Check if this is a PDF URL and extract information if it is
    let pdfInfo = null;
    if (pdfExtractor && pdfExtractor.isPDFUrl(activeTab.url)) {
      console.log('  ↳ 📄 Detected PDF URL, extracting information...');
      try {
        pdfInfo = await pdfExtractor.extractPDFInfo(activeTab.url, activeTab.title);
        console.log('  ↳ ✅ PDF info extracted:', {
          type: pdfInfo.type,
          source: pdfInfo.source,
          title: pdfInfo.title,
          hasConcepts: !!pdfInfo.concepts,
          conceptCount: pdfInfo.concepts ? pdfInfo.concepts.length : 0
        });
      } catch (error) {
        console.error('  ↳ ❌ Error extracting PDF info:', error);
      }
    }
    
    // Prepare content for the session
    let finalContent = '';
    let extractedConcepts = [];
    
    if (pdfInfo) {
      // For PDFs, use PDF-extracted content
      finalContent = pdfInfo.abstract || pdfInfo.content || '';
      extractedConcepts = pdfInfo.concepts || [];
    } else if (sessionContent) {
      // For regular websites, use captured content
      finalContent = sessionContent.content || '';
      // Extract basic concepts from headings and keywords
      if (sessionContent.headings && sessionContent.headings.length > 0) {
        extractedConcepts = sessionContent.headings.slice(0, 5);
      }
      if (sessionContent.keywords) {
        const keywords = sessionContent.keywords.split(',').map(k => k.trim()).filter(k => k);
        extractedConcepts = [...new Set([...extractedConcepts, ...keywords])].slice(0, 10);
      }
    } else {
      // Fallback: use title as content if nothing else is available
      finalContent = activeTab.title || '';
      console.log('  ↳ ⚠️ No content captured, using title as fallback');
    }
    
    const session = {
      url: activeTab.url,
      title: pdfInfo ? pdfInfo.title : (sessionContent?.title || activeTab.title),
      domain: activeTab.domain,
      startTime: sessionStartTime,
      endTime: Date.now(),
      duration: sessionDuration,
      category: pdfInfo ? pdfInfo.category : categorizeUrl(activeTab.url),
      focusType: determineFocusType(sessionDuration),
      content: finalContent,
      // Add PDF-specific metadata if available
      pdfMetadata: pdfInfo || null,
      isPDF: !!pdfInfo,
      concepts: extractedConcepts,
      hasContent: !!finalContent
    };
    
    console.log('  ↳ Session qualifies for tracking');
    console.log('  ↳ Duration details:', {
      startTime: new Date(session.startTime).toLocaleTimeString(),
      endTime: new Date(session.endTime).toLocaleTimeString(),
      durationMs: session.duration,
      durationSeconds: Math.round(session.duration / 1000),
      hasContent: session.hasContent,
      contentLength: session.content ? session.content.length : 0,
      conceptCount: session.concepts.length
    });
    
    // Save session data
    const saved = await addSession(session);
    console.log('  ↳ Session saved to storage:', saved);
    
    // Update today's analytics
    await updateAnalytics(session);
    console.log('  ↳ Analytics updated');
    
    // Use BrowsingTracker to process for knowledge graph
    if (browsingTracker) {
      try {
        console.log('  ↳ 🔄 Sending to BrowsingTracker for knowledge extraction...');
        await browsingTracker.addSession(session);
        console.log('  ↳ ✅ BrowsingTracker processing complete');
      } catch (error) {
        console.error('  ↳ ❌ Error processing session with BrowsingTracker:', error);
      }
    } else {
      console.log('  ↳ ⚠️ BrowsingTracker not initialized');
    }
    
    // Try to generate a summary for this session
    await tryGenerateSummary(session);
  } else {
    console.log('  ↳ Session too short, not tracking:', Math.round(sessionDuration / 1000) + ' seconds');
  }
  
  // Clear session data
  clearInterval(sessionTimer);
  activeTab = null;
  sessionStartTime = null;
  sessionContent = null;
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
    
    // Try to get content from the active tab with proper error handling
    if (activeTab && activeTab.id) {
      try {
        // First check if the tab still exists
        const tab = await chrome.tabs.get(activeTab.id).catch(() => null);
        if (!tab) {
          console.log('Tab no longer exists, skipping content retrieval');
          return;
        }
        
        // Check if we can inject into this tab
        if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
          const response = await chrome.tabs.sendMessage(activeTab.id, { 
            action: 'getPageContent' 
          }).catch((error) => {
            // This is expected for tabs without content scripts
            if (error.message && !error.message.includes('Receiving end does not exist')) {
              console.log('Content script not available:', error.message);
            }
            return null;
          });
          
          if (response && response.content) {
            pageData.content = response.content;
          }
        }
      } catch (error) {
        // Silently handle - content script might not be injected
        console.log('Could not get page content:', error.message || 'Unknown error');
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
    
    // Safely notify popup if open (with error handling)
    try {
      await chrome.runtime.sendMessage({
        action: 'summaryGenerated',
        summary: summary
      });
    } catch (error) {
      // Popup might not be open, this is expected
      if (chrome.runtime.lastError) {
        // Clear the error
      }
    }
    
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
  
  console.log('💾 Adding session to storage with key:', sessionsKey);
  
  const sessions = await getFromStorage(sessionsKey) || [];
  sessions.push(session);
  
  // Keep only last 100 sessions per day
  if (sessions.length > 100) {
    sessions.shift();
  }
  
  const success = await setInStorage(sessionsKey, sessions);
  console.log('  ↳ Storage write success:', success, 'Total sessions today:', sessions.length);
  
  return success;
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
        
      case 'missionCompleted':
        // Handle mission completion for Tamagotchi
        await handleMissionCompletion(request.missionData);
        sendResponse({ success: true });
        break;
        
      case 'updateTamagotchi':
        // Forward update to all open popups
        chrome.runtime.sendMessage({
          action: 'missionCompleted'
        }).catch(() => {
          // Popup might not be open, ignore error
        });
        sendResponse({ success: true });
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
        // Todo mapper functionality is not available in service workers
        // This would need to be handled through a content script or popup
        sendResponse({ success: false, error: 'Todo mapper not available in service worker' });
        break;
        
      case 'suggestTodos':
        // Todo mapper functionality is not available in service workers
        // This would need to be handled through a content script or popup
        sendResponse({ success: false, error: 'Todo mapper not available in service worker' });
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

// Handle mission completion for Tamagotchi
async function handleMissionCompletion(missionData) {
  try {
    // Load current pet data
    const petData = await getFromStorage('tamagotchiPet');
    if (!petData) {
      // Create new pet if doesn't exist
      const newPet = {
        name: 'Focus Buddy',
        stage: 'egg',
        born: Date.now(),
        stats: {
          happiness: 50,
          energy: 50,
          knowledge: 0,
          health: 100
        },
        missionsCompleted: 0,
        totalFocusTime: 0,
        mood: 'neutral',
        isAlive: true
      };
      await setInStorage('tamagotchiPet', newPet);
    }
    
    // Update pet stats for mission completion
    const pet = await getFromStorage('tamagotchiPet');
    pet.missionsCompleted++;
    pet.stats.happiness = Math.min(100, pet.stats.happiness + 20);
    pet.stats.energy = Math.min(100, pet.stats.energy + 10);
    pet.stats.knowledge = Math.min(100, pet.stats.knowledge + 5);
    pet.mood = 'excited';
    
    // Check for evolution
    if (pet.missionsCompleted >= 16) {
      pet.stage = 'adult';
    } else if (pet.missionsCompleted >= 6) {
      pet.stage = 'teen';
    } else if (pet.missionsCompleted >= 1) {
      pet.stage = 'baby';
    }
    
    // Save updated pet data
    await setInStorage('tamagotchiPet', pet);
    
    // Log mission completion
    console.log('Mission completed:', missionData);
    console.log('Pet updated:', pet);
    
  } catch (error) {
    console.error('Error handling mission completion:', error);
  }
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
