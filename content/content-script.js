// Attention Analytics - Content Script
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
  
  // Send page info to background script when requested
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPageInfo') {
      const pageInfo = extractPageInfo();
      sendResponse(pageInfo);
    }
    return true; // Keep message channel open
  });
  
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
  setInterval(() => {
    if (engagementData.clicks > 0 || engagementData.keystrokes > 0 || engagementData.scrollDepth > 10) {
      try {
        chrome.runtime.sendMessage({
          action: 'updateEngagement',
          data: engagementData
        });
      } catch (error) {
        // Extension context invalidated, ignore
      }
    }
  }, 30000); // Every 30 seconds
  
})();
