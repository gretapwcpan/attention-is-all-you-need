// Attention Analytics - Popup JavaScript

// DOM Elements
const elements = {
  // Current Focus
  currentCategory: document.getElementById('currentCategory'),
  currentTitle: document.getElementById('currentTitle'),
  focusTime: document.getElementById('focusTime'),
  focusQuality: document.getElementById('focusQuality'),
  focusProgress: document.getElementById('focusProgress'),
  
  // Today's Pattern
  totalTime: document.getElementById('totalTime'),
  patternChart: document.getElementById('patternChart'),
  chartLegend: document.getElementById('chartLegend'),
  
  // Attention Breakdown
  deepFocusBar: document.getElementById('deepFocusBar'),
  deepFocusTime: document.getElementById('deepFocusTime'),
  activeReadingBar: document.getElementById('activeReadingBar'),
  activeReadingTime: document.getElementById('activeReadingTime'),
  scanningBar: document.getElementById('scanningBar'),
  scanningTime: document.getElementById('scanningTime'),
  
  // Insight
  insightText: document.getElementById('insightText'),
  
  // Stats
  sitesCount: document.getElementById('sitesCount'),
  topicsCount: document.getElementById('topicsCount'),
  focusScore: document.getElementById('focusScore'),
  
  // Buttons
  settingsBtn: document.getElementById('settingsBtn'),
  viewAnalytics: document.getElementById('viewAnalytics'),
  setIntention: document.getElementById('setIntention')
};

// State
let currentSession = null;
let todayData = {
  sessions: [],
  categories: {},
  totalTime: 0,
  deepFocusTime: 0,
  activeReadingTime: 0,
  scanningTime: 0,
  uniqueSites: new Set(),
  topics: new Set()
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentSession();
  await loadTodayData();
  updateUI();
  startTimer();
  setupEventListeners();
});

// Load current browsing session
async function loadCurrentSession() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      currentSession = {
        title: tab.title || 'New Tab',
        url: tab.url,
        domain: new URL(tab.url).hostname,
        startTime: Date.now(),
        category: categorizeUrl(tab.url)
      };
    }
  } catch (error) {
    console.error('Error loading current session:', error);
  }
}

// Load today's browsing data
async function loadTodayData() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getTodayData' });
    if (response && response.success) {
      todayData = response.data;
    }
  } catch (error) {
    console.error('Error loading today data:', error);
    // Use mock data for testing
    todayData = generateMockData();
  }
}

// Categorize URL based on domain and content
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
  } catch {
    return 'Exploring';
  }
}

// Update UI with current data
function updateUI() {
  // Update current focus
  if (currentSession) {
    elements.currentCategory.textContent = currentSession.category;
    elements.currentTitle.textContent = truncateText(currentSession.title, 50);
  }
  
  // Update today's total time
  const hours = Math.floor(todayData.totalTime / 3600000);
  const minutes = Math.floor((todayData.totalTime % 3600000) / 60000);
  elements.totalTime.textContent = `${hours}h ${minutes}m`;
  
  // Update attention breakdown
  updateAttentionBreakdown();
  
  // Update pattern chart
  updatePatternChart();
  
  // Update stats
  elements.sitesCount.textContent = todayData.uniqueSites.size || '0';
  elements.topicsCount.textContent = todayData.topics.size || '0';
  elements.focusScore.textContent = calculateFocusScore();
  
  // Update insight
  updateInsight();
}

// Update attention breakdown bars
function updateAttentionBreakdown() {
  const total = todayData.totalTime || 1;
  
  // Deep Focus
  const deepFocusPercent = (todayData.deepFocusTime / total) * 100;
  elements.deepFocusBar.style.width = `${deepFocusPercent}%`;
  elements.deepFocusTime.textContent = formatTime(todayData.deepFocusTime);
  
  // Active Reading
  const activeReadingPercent = (todayData.activeReadingTime / total) * 100;
  elements.activeReadingBar.style.width = `${activeReadingPercent}%`;
  elements.activeReadingTime.textContent = formatTime(todayData.activeReadingTime);
  
  // Scanning
  const scanningPercent = (todayData.scanningTime / total) * 100;
  elements.scanningBar.style.width = `${scanningPercent}%`;
  elements.scanningTime.textContent = formatTime(todayData.scanningTime);
}

// Update pattern chart
function updatePatternChart() {
  const chartBars = elements.patternChart.querySelector('.chart-bars');
  const categories = Object.entries(todayData.categories || {});
  
  if (categories.length === 0) {
    chartBars.innerHTML = '<div style="color: #999; font-size: 12px;">No data yet</div>';
    return;
  }
  
  // Clear existing bars
  chartBars.innerHTML = '';
  
  // Find max value for scaling
  const maxTime = Math.max(...categories.map(([_, time]) => time));
  
  // Create bars
  categories.forEach(([category, time]) => {
    const bar = document.createElement('div');
    bar.className = `chart-bar ${category.toLowerCase()}`;
    bar.style.height = `${(time / maxTime) * 100}%`;
    bar.title = `${category}: ${formatTime(time)}`;
    chartBars.appendChild(bar);
  });
  
  // Update legend
  updateChartLegend(categories);
}

// Update chart legend
function updateChartLegend(categories) {
  elements.chartLegend.innerHTML = '';
  
  categories.forEach(([category, time]) => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    
    const dot = document.createElement('div');
    dot.className = 'legend-dot';
    dot.style.background = getCategoryColor(category);
    
    const label = document.createElement('span');
    label.textContent = category;
    
    item.appendChild(dot);
    item.appendChild(label);
    elements.chartLegend.appendChild(item);
  });
}

// Get category color
function getCategoryColor(category) {
  const colors = {
    'Learning': '#4CAF50',
    'Development': '#2196F3',
    'Research': '#9C27B0',
    'Documentation': '#00BCD4',
    'News': '#FF5722',
    'Social': '#E91E63',
    'Reading': '#673AB7',
    'Reference': '#607D8B',
    'Exploring': '#FF9800'
  };
  return colors[category] || '#999999';
}

// Calculate focus score
function calculateFocusScore() {
  if (todayData.totalTime === 0) return '--';
  
  const deepFocusWeight = 1.0;
  const activeReadingWeight = 0.7;
  const scanningWeight = 0.3;
  
  const weightedTime = 
    (todayData.deepFocusTime * deepFocusWeight) +
    (todayData.activeReadingTime * activeReadingWeight) +
    (todayData.scanningTime * scanningWeight);
  
  const score = Math.round((weightedTime / todayData.totalTime) * 100);
  return score;
}

// Update insight text
function updateInsight() {
  const insights = generateInsights();
  if (insights.length > 0) {
    elements.insightText.textContent = insights[0];
  }
}

// Generate insights based on data
function generateInsights() {
  const insights = [];
  
  if (todayData.totalTime === 0) {
    return ['Start browsing to see your attention patterns'];
  }
  
  // Deep focus insight
  const deepFocusPercent = (todayData.deepFocusTime / todayData.totalTime) * 100;
  if (deepFocusPercent > 50) {
    insights.push('Excellent focus today! You spent most time in deep concentration.');
  } else if (deepFocusPercent < 20) {
    insights.push('Consider longer uninterrupted sessions for deeper focus.');
  }
  
  // Category insight
  const topCategory = Object.entries(todayData.categories || {})
    .sort((a, b) => b[1] - a[1])[0];
  if (topCategory) {
    insights.push(`You focused mostly on ${topCategory[0]} today.`);
  }
  
  // Site diversity insight
  if (todayData.uniqueSites.size > 20) {
    insights.push('High exploration today - visited many different sites.');
  } else if (todayData.uniqueSites.size < 5) {
    insights.push('Focused browsing - stayed on just a few sites.');
  }
  
  return insights.length > 0 ? insights : ['Keep browsing to generate insights'];
}

// Start timer for current session
function startTimer() {
  setInterval(() => {
    if (currentSession) {
      const elapsed = Date.now() - currentSession.startTime;
      const minutes = Math.floor(elapsed / 60000);
      elements.focusTime.textContent = minutes;
      
      // Update focus quality
      if (minutes >= 10) {
        elements.focusQuality.textContent = '• Deep Focus';
        elements.focusQuality.style.color = 'var(--success)';
      } else if (minutes >= 5) {
        elements.focusQuality.textContent = '• Active Reading';
        elements.focusQuality.style.color = 'var(--accent)';
      } else {
        elements.focusQuality.textContent = '• Scanning';
        elements.focusQuality.style.color = 'var(--warning)';
      }
      
      // Update progress bar
      const progress = Math.min((minutes / 10) * 100, 100);
      elements.focusProgress.style.width = `${progress}%`;
    }
  }, 1000);
}

// Setup event listeners
function setupEventListeners() {
  elements.viewAnalytics.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('analytics/analytics.html') });
  });
  
  elements.setIntention.addEventListener('click', () => {
    // TODO: Implement intention setting
    alert('Intention setting coming soon!');
  });
  
  elements.settingsBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('settings/settings.html') });
  });
}

// Utility functions
function formatTime(milliseconds) {
  const minutes = Math.floor(milliseconds / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Generate mock data for testing
function generateMockData() {
  return {
    sessions: [],
    categories: {
      'Learning': 2400000,
      'Development': 1800000,
      'Research': 1200000,
      'News': 600000,
      'Social': 300000
    },
    totalTime: 6300000,
    deepFocusTime: 3000000,
    activeReadingTime: 2000000,
    scanningTime: 1300000,
    uniqueSites: new Set(['github.com', 'stackoverflow.com', 'medium.com', 'news.ycombinator.com']),
    topics: new Set(['JavaScript', 'React', 'System Design', 'AI'])
  };
}
