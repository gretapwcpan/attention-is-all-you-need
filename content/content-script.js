// Attention Is All You Need - Content Script
// Extracts additional information from web pages

(function() {
  'use strict';
  
  // Only run on actual web pages
  if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') {
    return;
  }
  
  // Extract page information
  function extractPageInfo() {
    const info = {
      title: document.title || '',
      url: window.location.href,
      domain: window.location.hostname,
      description: '',
      keywords: [],
      textContent: '',
      timestamp: Date.now()
    };
    
    // Get meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      info.description = metaDescription.content;
    }
    
    // Get meta keywords
    const metaKeywords = document.querySelector('meta[name="keywords"]');
    if (metaKeywords) {
      info.keywords = metaKeywords.content.split(',').map(k => k.trim());
    }
    
    // Get first 1000 characters of text content
    const textElements = document.querySelectorAll('p, h1, h2, h3, article');
    let textContent = '';
    for (let element of textElements) {
      textContent += element.textContent + ' ';
      if (textContent.length > 1000) break;
    }
    info.textContent = textContent.substring(0, 1000);
    
    return info;
  }
  
  // Extract detailed page content for character generation
  function extractPageContent() {
    // Get main content area
    const article = document.querySelector('article, main, [role="main"], .content, #content');
    const body = article || document.body;
    
    // Get all text content
    let fullText = '';
    const textElements = body.querySelectorAll('p, h1, h2, h3, h4, li, td, blockquote');
    for (let element of textElements) {
      const text = element.textContent.trim();
      if (text) {
        fullText += text + ' ';
      }
      // Limit to 5000 characters for AI processing
      if (fullText.length > 5000) break;
    }
    
    // Get headings for better context
    const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
      .slice(0, 10)
      .map(h => h.textContent.trim())
      .filter(h => h.length > 0);
    
    return {
      content: fullText.substring(0, 5000),
      headings: headings,
      title: document.title,
      url: window.location.href,
      domain: window.location.hostname,
      description: document.querySelector('meta[name="description"]')?.content || '',
      keywords: document.querySelector('meta[name="keywords"]')?.content || '',
      author: document.querySelector('meta[name="author"]')?.content || ''
    };
  }
  
  // Send page info to background script when requested
  // Check if chrome.runtime is available before adding listener
  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      // Verify extension context is still valid
      if (!chrome.runtime.id) {
        console.log('Extension context invalidated');
        return false;
      }
      
      try {
        if (request.action === 'getPageInfo') {
          const pageInfo = extractPageInfo();
          sendResponse(pageInfo);
        } else if (request.action === 'getPageContent') {
          const pageContent = extractPageContent();
          sendResponse(pageContent);
        }
      } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ error: error.message });
      }
      
      return true; // Keep message channel open
    });
  }
  
  // Track user engagement
  let engagementData = {
    scrollDepth: 0,
    timeOnPage: 0,
    clicks: 0,
    keystrokes: 0
  };
  
  // Track scroll depth
  let maxScrollDepth = 0;
  window.addEventListener('scroll', () => {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = scrollHeight > 0 ? (window.scrollY / scrollHeight) * 100 : 0;
    maxScrollDepth = Math.max(maxScrollDepth, scrollPercent);
    engagementData.scrollDepth = Math.round(maxScrollDepth);
  });
  
  // Track clicks
  document.addEventListener('click', () => {
    engagementData.clicks++;
  });
  
  // Track keystrokes (for forms, search, etc.)
  document.addEventListener('keypress', () => {
    engagementData.keystrokes++;
  });
  
  // Send engagement data periodically
  let engagementInterval = setInterval(() => {
    if (engagementData.clicks > 0 || engagementData.keystrokes > 0 || engagementData.scrollDepth > 10) {
      try {
        // Check if extension context is still valid
        if (chrome.runtime && chrome.runtime.id) {
          chrome.runtime.sendMessage({
            action: 'updateEngagement',
            data: engagementData
          }, (response) => {
            // Check for errors silently
            if (chrome.runtime.lastError) {
              // Expected when extension reloads - stop trying
              clearInterval(engagementInterval);
            }
          });
        } else {
          // Extension context lost
          clearInterval(engagementInterval);
        }
      } catch (error) {
        // Extension context invalidated, stop trying silently
        clearInterval(engagementInterval);
      }
    }
  }, 30000); // Every 30 seconds
  
  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    clearInterval(engagementInterval);
  });
  
  // Handle extension disconnect gracefully
  if (chrome.runtime) {
    chrome.runtime.onDisconnect?.addListener(() => {
      clearInterval(engagementInterval);
    });
  }
  
})();
