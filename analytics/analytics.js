// Analytics Dashboard JavaScript
import { getKnowledgeStorage } from '../utils/knowledge-storage.js';
import { getKnowledgeGraph } from '../utils/knowledge-graph.js';
import { NetworkVisualizer } from '../utils/network-visualizer.js';

// DOM Elements
const elements = {
  totalTime: document.getElementById('totalTime'),
  focusScore: document.getElementById('focusScore'),
  topSites: document.getElementById('topSites'),
  recentSessions: document.getElementById('recentSessions'),
  insights: document.getElementById('insights'),
  exportBtn: document.getElementById('exportBtn'),
  clearBtn: document.getElementById('clearBtn'),
  // Knowledge tab elements
  nodeCount: document.getElementById('nodeCount'),
  conceptCount: document.getElementById('conceptCount'),
  connectionCount: document.getElementById('connectionCount'),
  learningStreak: document.getElementById('learningStreak'),
  knowledgeSearch: document.getElementById('knowledgeSearch'),
  searchBtn: document.getElementById('searchBtn'),
  searchResults: document.getElementById('searchResults'),
  topConcepts: document.getElementById('topConcepts'),
  recentNodes: document.getElementById('recentNodes'),
  learningInsights: document.getElementById('learningInsights')
};

// Initialize Knowledge modules - use singletons
const knowledgeStorage = getKnowledgeStorage();
const knowledgeGraph = getKnowledgeGraph();
let networkVisualizer = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize knowledge modules first
  await initializeKnowledgeModules();
  
  await loadAnalytics();
  await loadKnowledgeGraph();
  setupEventListeners();
  setupTabNavigation();
  setupGraphControls();
  drawCharts();
});

// Initialize knowledge modules
async function initializeKnowledgeModules() {
  try {
    console.log('Initializing knowledge modules...');
    
    // Initialize storage first
    const storageInitialized = await knowledgeStorage.initialize();
    if (!storageInitialized) {
      console.error('Failed to initialize knowledge storage');
      return false;
    }
    console.log('Knowledge storage initialized');
    
    // Initialize knowledge graph
    const graphInitialized = await knowledgeGraph.initialize();
    if (!graphInitialized) {
      console.error('Failed to initialize knowledge graph');
      return false;
    }
    console.log('Knowledge graph initialized');
    
    return true;
  } catch (error) {
    console.error('Error initializing knowledge modules:', error);
    return false;
  }
}

// Load analytics data
async function loadAnalytics() {
  try {
    // Get today's data
    const response = await chrome.runtime.sendMessage({ action: 'getTodayData' });
    if (response && response.success) {
      const data = response.data;
      updateSummaryCards(data);
      updateTopSites(data);
      updateRecentSessions(data);
      updateInsights(data);
      updateFocusDistribution(data);
    }
    
    // Get week data for charts
    const weekResponse = await chrome.runtime.sendMessage({ action: 'getWeekData' });
    if (weekResponse && weekResponse.success) {
      drawWeeklyChart(weekResponse.data);
    }
  } catch (error) {
    console.error('Error loading analytics:', error);
    showEmptyState();
  }
}

// Update summary cards
function updateSummaryCards(data) {
  // Total time
  const hours = Math.floor(data.totalTime / 3600000);
  const minutes = Math.floor((data.totalTime % 3600000) / 60000);
  elements.totalTime.textContent = `${hours}h ${minutes}m`;
  
  // Focus score
  const score = calculateFocusScore(data);
  elements.focusScore.textContent = score > 0 ? score : '--';
}

// Calculate focus score
function calculateFocusScore(data) {
  if (!data.totalTime || data.totalTime === 0) return 0;
  
  const deepFocusWeight = 1.0;
  const activeReadingWeight = 0.7;
  const scanningWeight = 0.3;
  
  const weightedTime = 
    ((data.deepFocusTime || 0) * deepFocusWeight) +
    ((data.activeReadingTime || 0) * activeReadingWeight) +
    ((data.scanningTime || 0) * scanningWeight);
  
  return Math.round((weightedTime / data.totalTime) * 100);
}

// Update top sites list
function updateTopSites(data) {
  if (!data.sessions || data.sessions.length === 0) {
    elements.topSites.innerHTML = '<div class="empty-state">No sites visited today.</div>';
    return;
  }
  
  // Aggregate time by domain
  const siteTime = {};
  data.sessions.forEach(session => {
    if (!siteTime[session.domain]) {
      siteTime[session.domain] = {
        domain: session.domain,
        time: 0,
        category: session.category
      };
    }
    siteTime[session.domain].time += session.duration;
  });
  
  // Sort by time and get top 10
  const topSites = Object.values(siteTime)
    .sort((a, b) => b.time - a.time)
    .slice(0, 10);
  
  // Render list
  elements.topSites.innerHTML = topSites.map(site => {
    // Determine dominant focus type for this site
    const siteSessions = data.sessions.filter(s => s.domain === site.domain);
    const focusTypes = { deep: 0, active: 0, scanning: 0 };
    siteSessions.forEach(s => {
      if (s.focusType) focusTypes[s.focusType] = (focusTypes[s.focusType] || 0) + 1;
    });
    const dominantFocus = Object.entries(focusTypes).sort((a, b) => b[1] - a[1])[0][0];
    
    return `
      <div class="list-item">
        <span class="list-item-title">${site.domain}</span>
        <span class="focus-badge focus-${dominantFocus}">[${dominantFocus.toUpperCase()}]</span>
        <span class="list-item-category category-${site.category.toLowerCase()}">${site.category}</span>
        <span class="list-item-value">${formatTime(site.time)}</span>
      </div>
    `;
  }).join('');
}

// Update recent sessions
function updateRecentSessions(data) {
  if (!data.sessions || data.sessions.length === 0) {
    elements.recentSessions.innerHTML = '<div class="empty-state">No sessions recorded today.</div>';
    return;
  }
  
  // Get last 20 sessions
  const recentSessions = data.sessions.slice(-20).reverse();
  
  // Render list
  elements.recentSessions.innerHTML = recentSessions.map(session => {
    const focusType = session.focusType || 'scanning';
    const focusLabel = focusType === 'scanning' ? 'SCAN' : focusType.toUpperCase();
    
    return `
      <div class="list-item">
        <span class="list-item-title">${truncateText(session.title, 50)}</span>
        <span class="focus-badge focus-${focusType}">[${focusLabel}]</span>
        <span class="list-item-category category-${session.category.toLowerCase()}">${session.category}</span>
        <span class="list-item-value">${formatTime(session.duration)}</span>
      </div>
    `;
  }).join('');
}

// Update insights
function updateInsights(data) {
  const insights = generateInsights(data);
  
  if (insights.length === 0) {
    elements.insights.innerHTML = '<div class="empty-state">Insights will appear as you browse.</div>';
    return;
  }
  
  elements.insights.innerHTML = insights.map(insight => `
    <div class="insight-item insight-${insight.type}">
      <div class="insight-text">${insight.message}</div>
    </div>
  `).join('');
}

// Generate insights
function generateInsights(data) {
  const insights = [];
  
  if (!data || data.totalTime === 0) {
    return insights;
  }
  
  // Deep focus insight
  const deepFocusPercent = (data.deepFocusTime / data.totalTime) * 100;
  if (deepFocusPercent > 60) {
    insights.push({
      type: 'positive',
      message: `Excellent focus! ${Math.round(deepFocusPercent)}% of your time was in deep concentration.`
    });
  } else if (deepFocusPercent < 20) {
    insights.push({
      type: 'suggestion',
      message: 'Try longer uninterrupted sessions for deeper focus and better retention.'
    });
  }
  
  // Category insight
  if (data.categories) {
    const topCategory = Object.entries(data.categories)
      .sort((a, b) => b[1] - a[1])[0];
    if (topCategory) {
      const percent = (topCategory[1] / data.totalTime) * 100;
      insights.push({
        type: 'info',
        message: `You spent ${Math.round(percent)}% of your time on ${topCategory[0]} today.`
      });
    }
  }
  
  // Time insight
  const hours = data.totalTime / 3600000;
  if (hours > 6) {
    insights.push({
      type: 'warning',
      message: `You've been online for ${Math.round(hours)} hours today. Remember to take breaks!`
    });
  }
  
  return insights;
}

// Update focus distribution bars
function updateFocusDistribution(data) {
  const deepTime = data.deepFocusTime || 0;
  const activeTime = data.activeReadingTime || 0;
  const scanTime = data.scanningTime || 0;
  const totalFocusTime = deepTime + activeTime + scanTime;
  
  // Update bar widths
  const deepBar = document.getElementById('deepBar');
  const activeBar = document.getElementById('activeBar');
  const scanBar = document.getElementById('scanBar');
  
  if (totalFocusTime > 0) {
    deepBar.style.width = `${(deepTime / totalFocusTime) * 100}%`;
    activeBar.style.width = `${(activeTime / totalFocusTime) * 100}%`;
    scanBar.style.width = `${(scanTime / totalFocusTime) * 100}%`;
  } else {
    deepBar.style.width = '0%';
    activeBar.style.width = '0%';
    scanBar.style.width = '0%';
  }
  
  // Update values
  document.getElementById('deepValue').textContent = formatTime(deepTime);
  document.getElementById('activeValue').textContent = formatTime(activeTime);
  document.getElementById('scanValue').textContent = formatTime(scanTime);
}

// Draw charts
function drawCharts() {
  // Simple bar chart implementation without external library
  drawCategoryChart();
}

// Draw weekly chart
function drawWeeklyChart(weekData) {
  const canvas = document.getElementById('weeklyCanvas');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const width = canvas.width = canvas.offsetWidth;
  const height = canvas.height = canvas.offsetHeight;
  
  // Clear canvas
  ctx.clearRect(0, 0, width, height);
  
  if (!weekData || weekData.length === 0) {
    ctx.fillStyle = '#999';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data for the past week', width / 2, height / 2);
    return;
  }
  
  // Prepare data
  const days = weekData.map(d => {
    const date = new Date(d.date);
    return date.toLocaleDateString('en', { weekday: 'short' });
  }).reverse();
  
  const values = weekData.map(d => d.totalTime / 3600000).reverse(); // Convert to hours
  const maxValue = Math.max(...values, 1);
  
  // Draw bars
  const barWidth = width / (days.length * 2);
  const barSpacing = barWidth;
  const chartHeight = height - 40;
  
  ctx.fillStyle = '#0066FF';
  values.forEach((value, index) => {
    const barHeight = (value / maxValue) * chartHeight;
    const x = index * (barWidth + barSpacing) + barSpacing;
    const y = height - barHeight - 30;
    
    ctx.fillRect(x, y, barWidth, barHeight);
    
    // Draw value label
    ctx.fillStyle = '#666';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${value.toFixed(1)}h`, x + barWidth / 2, y - 5);
    
    // Draw day label
    ctx.fillText(days[index], x + barWidth / 2, height - 10);
    
    ctx.fillStyle = '#0066FF';
  });
}

// Draw category chart
async function drawCategoryChart() {
  const canvas = document.getElementById('categoryCanvas');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const width = canvas.width = canvas.offsetWidth;
  const height = canvas.height = canvas.offsetHeight;
  
  // Clear canvas
  ctx.clearRect(0, 0, width, height);
  
  // Get today's data
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getTodayData' });
    if (!response || !response.success || !response.data.categories) {
      ctx.fillStyle = '#999';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No category data available', width / 2, height / 2);
      return;
    }
    
    const categories = Object.entries(response.data.categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    if (categories.length === 0) {
      ctx.fillStyle = '#999';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No category data available', width / 2, height / 2);
      return;
    }
    
    // Draw pie chart
    const total = categories.reduce((sum, [_, value]) => sum + value, 0);
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 3;
    
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
    
    let currentAngle = -Math.PI / 2;
    
    categories.forEach(([category, value]) => {
      const sliceAngle = (value / total) * 2 * Math.PI;
      
      // Draw slice
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = colors[category] || '#999';
      ctx.fill();
      
      // Draw label
      const labelAngle = currentAngle + sliceAngle / 2;
      const labelX = centerX + Math.cos(labelAngle) * (radius + 20);
      const labelY = centerY + Math.sin(labelAngle) * (radius + 20);
      
      ctx.fillStyle = '#666';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(category, labelX, labelY);
      
      currentAngle += sliceAngle;
    });
  } catch (error) {
    console.error('Error drawing category chart:', error);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Back button
  const backBtn = document.getElementById('backBtn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.close();
    });
  }
  
  elements.exportBtn.addEventListener('click', exportData);
  elements.clearBtn.addEventListener('click', clearData);
  
  
  // Knowledge tab events
  if (elements.searchBtn) {
    elements.searchBtn.addEventListener('click', searchKnowledge);
  }
  if (elements.knowledgeSearch) {
    elements.knowledgeSearch.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') searchKnowledge();
    });
  }
}

// Setup tab navigation
function setupTabNavigation() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const analyticsTab = document.getElementById('analyticsTab');
  const knowledgeTab = document.getElementById('knowledgeTab');
  
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active class from all buttons
      tabButtons.forEach(b => b.classList.remove('active'));
      // Add active class to clicked button
      btn.classList.add('active');
      
      // Show/hide tabs
      if (btn.dataset.tab === 'analytics') {
        analyticsTab.style.display = 'block';
        knowledgeTab.style.display = 'none';
      } else if (btn.dataset.tab === 'knowledge') {
        analyticsTab.style.display = 'none';
        knowledgeTab.style.display = 'block';
        loadKnowledgeGraph(); // Refresh knowledge data when tab is shown
      }
    });
  });
}

// Export data
async function exportData() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'exportData' });
    if (response && response.success) {
      const dataStr = JSON.stringify(response.data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `attention-analytics-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('Error exporting data:', error);
    alert('Failed to export data');
  }
}

// Clear data
async function clearData() {
  if (!confirm('Are you sure you want to clear all data? This cannot be undone.')) {
    return;
  }
  
  try {
    await chrome.storage.local.clear();
    alert('All data has been cleared');
    location.reload();
  } catch (error) {
    console.error('Error clearing data:', error);
    alert('Failed to clear data');
  }
}

// Show empty state
function showEmptyState() {
  elements.totalTime.textContent = '0h 0m';
  elements.focusScore.textContent = '--';
  elements.topSites.innerHTML = '<div class="empty-state">No data yet. Start browsing to see analytics.</div>';
  elements.recentSessions.innerHTML = '<div class="empty-state">No sessions recorded yet.</div>';
  elements.insights.innerHTML = '<div class="empty-state">Insights will appear as you browse.</div>';
}

// Load Knowledge Graph data
async function loadKnowledgeGraph() {
  try {
    // Ensure knowledge storage is initialized
    if (!knowledgeStorage.initialized) {
      const initialized = await knowledgeStorage.initialize();
      if (!initialized) {
        console.error('Failed to initialize knowledge storage in loadKnowledgeGraph');
        showKnowledgeEmptyState();
        return;
      }
    }
    
    // Initialize network visualizer if not already done
    if (!networkVisualizer) {
      try {
        networkVisualizer = new NetworkVisualizer('knowledgeNetwork');
        await networkVisualizer.initialize();
      } catch (vizError) {
        console.error('Error initializing network visualizer:', vizError);
        // Continue without visualizer - other features should still work
      }
    } else {
      // Refresh the graph
      try {
        await networkVisualizer.refresh();
      } catch (refreshError) {
        console.error('Error refreshing network visualizer:', refreshError);
      }
    }
    
    // Get storage stats
    const stats = await knowledgeStorage.getStats();
    console.log('Knowledge stats loaded:', stats);
    
    // Update summary cards
    if (elements.nodeCount) {
      elements.nodeCount.textContent = stats.nodeCount || '0';
    }
    if (elements.conceptCount) {
      elements.conceptCount.textContent = stats.conceptCount || '0';
    }
    if (elements.connectionCount) {
      elements.connectionCount.textContent = stats.totalConnections || '0';
    }
    
    // Calculate learning streak
    const timeline = await knowledgeStorage.getTimeline(30);
    const streak = calculateLearningStreak(timeline);
    if (elements.learningStreak) {
      elements.learningStreak.textContent = `${streak} days`;
    }
    
    // Load top concepts
    await loadTopConcepts();
    
    // Load recent nodes
    await loadRecentNodes();
    
    // Generate insights
    await loadLearningInsights();
    
  } catch (error) {
    console.error('Error loading knowledge graph:', error);
    showKnowledgeEmptyState();
  }
}

// Show knowledge empty state
function showKnowledgeEmptyState() {
  if (elements.nodeCount) elements.nodeCount.textContent = '0';
  if (elements.conceptCount) elements.conceptCount.textContent = '0';
  if (elements.connectionCount) elements.connectionCount.textContent = '0';
  if (elements.learningStreak) elements.learningStreak.textContent = '0 days';
  if (elements.topConcepts) {
    elements.topConcepts.innerHTML = '<div class="empty-state">Topics will appear as you read and learn.</div>';
  }
  if (elements.recentNodes) {
    elements.recentNodes.innerHTML = '<div class="empty-state">Your recent articles and summaries will appear here.</div>';
  }
  if (elements.learningInsights) {
    elements.learningInsights.innerHTML = '<div class="empty-state">Insights about your learning journey will appear here.</div>';
  }
}

// Calculate learning streak
function calculateLearningStreak(timeline) {
  const dates = Object.keys(timeline).sort().reverse();
  if (dates.length === 0) return 0;
  
  let streak = 0;
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  
  // Check if there's activity today or yesterday to start the streak
  if (!dates.includes(today) && !dates.includes(yesterday)) {
    return 0;
  }
  
  // Count consecutive days
  let currentDate = new Date();
  for (let i = 0; i < 30; i++) {
    const dateStr = currentDate.toDateString();
    if (timeline[dateStr] && timeline[dateStr].length > 0) {
      streak++;
    } else if (i > 0) { // Allow today to be empty if yesterday has data
      break;
    }
    currentDate.setDate(currentDate.getDate() - 1);
  }
  
  return streak;
}

// Load top concepts with improved validation
async function loadTopConcepts() {
  if (!elements.topConcepts) return;
  
  try {
    // Ensure storage is initialized
    if (!knowledgeStorage.initialized) {
      const initialized = await knowledgeStorage.initialize();
      if (!initialized) {
        console.error('Failed to initialize storage in loadTopConcepts');
        elements.topConcepts.innerHTML = '<div class="empty-state">Unable to load topics data.</div>';
        return;
      }
    }
    
    const conceptIndex = await knowledgeStorage.getConceptIndex();
    
    // Validate conceptIndex
    if (!conceptIndex || typeof conceptIndex !== 'object') {
      console.error('Invalid concept index received:', conceptIndex);
      elements.topConcepts.innerHTML = '<div class="empty-state">Topics will appear as you read and learn.</div>';
      return;
    }
    
    console.log('Concept index loaded:', Object.keys(conceptIndex).length, 'concepts');
    
    if (Object.keys(conceptIndex).length === 0) {
      elements.topConcepts.innerHTML = '<div class="empty-state">Topics will appear as you read and learn.</div>';
      return;
    }
    
    // Sort concepts by frequency with validation
    const conceptCounts = Object.entries(conceptIndex)
      .filter(([concept, nodeIds]) => {
        // Validate each entry
        return concept && Array.isArray(nodeIds) && nodeIds.length > 0;
      })
      .map(([concept, nodeIds]) => ({ 
        concept: concept.trim(), 
        count: nodeIds.length 
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // Top 20 concepts
    
    if (conceptCounts.length === 0) {
      elements.topConcepts.innerHTML = '<div class="empty-state">Topics will appear as you read and learn.</div>';
      return;
    }
    
    const maxCount = conceptCounts[0].count;
    
    // Render concept cloud
    const conceptsHTML = conceptCounts.map(({ concept, count }) => {
      const size = count === maxCount ? 'large' : count > maxCount / 2 ? 'medium' : '';
      return `
        <span class="concept-tag ${size}" data-concept="${concept}">
          ${concept}
          <span class="concept-count">${count}</span>
        </span>
      `;
    }).join('');
    
    elements.topConcepts.innerHTML = conceptsHTML;
    
    // Add click handlers
    elements.topConcepts.querySelectorAll('.concept-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        const concept = tag.dataset.concept;
        if (elements.knowledgeSearch) {
          elements.knowledgeSearch.value = concept;
          searchKnowledge();
        }
      });
    });
    
  } catch (error) {
    console.error('Error loading concepts:', error);
    elements.topConcepts.innerHTML = '<div class="empty-state">Error loading topics data.</div>';
  }
}

// Load recent nodes with improved deduplication
async function loadRecentNodes() {
  if (!elements.recentNodes) return;
  
  try {
    // Ensure storage is initialized
    if (!knowledgeStorage.initialized) {
      const initialized = await knowledgeStorage.initialize();
      if (!initialized) {
        console.error('Failed to initialize storage in loadRecentNodes');
        elements.recentNodes.innerHTML = '<div class="empty-state">Unable to load recent learning data.</div>';
        return;
      }
    }
    
    const nodes = await knowledgeStorage.getAllNodes();
    
    // Validate nodes data
    if (!nodes || !Array.isArray(nodes)) {
      console.error('Invalid nodes data received:', nodes);
      elements.recentNodes.innerHTML = '<div class="empty-state">Your recent learning will appear here.</div>';
      return;
    }
    
    console.log('All nodes loaded:', nodes.length, 'total nodes');
    
    if (nodes.length === 0) {
      elements.recentNodes.innerHTML = '<div class="empty-state">Your recent learning will appear here.</div>';
      return;
    }
    
    // Get recent nodes and reverse for chronological order (newest first)
    let recentNodes = nodes.slice(-30).reverse(); // Get more nodes for better deduplication
    
    // Improved deduplication: use URL or title+domain as key
    const seenKeys = new Set();
    const dedupedNodes = [];
    
    for (const node of recentNodes) {
      // Validate node structure
      if (!node || !node.title) {
        console.warn('Invalid node structure:', node);
        continue;
      }
      
      // Create a unique key based on URL (if available) or normalized title
      let uniqueKey;
      if (node.url) {
        // Use URL as primary deduplication key
        uniqueKey = node.url.toLowerCase();
      } else {
        // Fallback to normalized title + domain (if available)
        const normalizedTitle = node.title.trim().toLowerCase().replace(/\s+/g, ' ');
        uniqueKey = node.domain ? `${normalizedTitle}::${node.domain}` : normalizedTitle;
      }
      
      // Only add if we haven't seen this key before
      if (!seenKeys.has(uniqueKey)) {
        seenKeys.add(uniqueKey);
        dedupedNodes.push(node);
        
        // Stop once we have 10 unique nodes
        if (dedupedNodes.length >= 10) {
          break;
        }
      }
    }
    
    // Render nodes with proper validation
    const nodesHTML = dedupedNodes.map(node => {
      // Validate required fields with defaults
      const title = node.title || 'Untitled';
      const timestamp = node.timestamp || Date.now();
      const timeSpent = node.timeSpent || 0;
      const category = node.category || 'Unknown';
      const concepts = Array.isArray(node.concepts) ? node.concepts : [];
      const connections = Array.isArray(node.connections) ? node.connections : [];
      
      return `
        <div class="knowledge-node">
          <div class="node-title">${truncateText(title, 80)}</div>
          <div class="node-meta">
            <span>${new Date(timestamp).toLocaleDateString()}</span>
            <span>${formatTime(timeSpent)}</span>
            <span>${category}</span>
          </div>
          ${concepts.length > 0 ? `
            <div class="node-concepts">
              ${concepts.slice(0, 5).map(c => 
                `<span class="timeline-concept">${c}</span>`
              ).join('')}
            </div>
          ` : ''}
          ${connections.length > 0 ? `
            <div class="node-connections">
              ${connections.slice(0, 3).map(conn => `
                <div class="connection-item">
                  <span class="connection-strength ${conn.strength || 'weak'}">${conn.strength || 'weak'}</span>
                  <span>${(conn.type || 'related').replace('_', ' ')}: ${conn.insight || ''}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
    
    elements.recentNodes.innerHTML = nodesHTML || '<div class="empty-state">Your recent learning will appear here.</div>';
  } catch (error) {
    console.error('Error loading recent nodes:', error);
    elements.recentNodes.innerHTML = '<div class="empty-state">Error loading recent learning data.</div>';
  }
}

// Load learning insights
async function loadLearningInsights() {
  if (!elements.learningInsights) return;
  
  try {
    const insights = await knowledgeGraph.generateLearningInsights();
    
    if (!insights || insights.totalNodes === 0) {
      elements.learningInsights.innerHTML = '<div class="empty-state">Insights about your learning will appear here.</div>';
      return;
    }
    
    // Generate insight items
    const insightItems = [];
    
    // Main summary
    insightItems.push({
      type: 'info',
      message: insights.summary
    });
    
    // Top focus area
    if (insights.recentFocus && insights.recentFocus !== 'Various topics') {
      insightItems.push({
        type: 'positive',
        message: `Your recent focus has been on ${insights.recentFocus}. Keep building expertise!`
      });
    }
    
    // Learning path
    if (insights.learningPath && insights.learningPath.length > 1) {
      insightItems.push({
        type: 'suggestion',
        message: `You've explored ${insights.learningPath.length} different learning themes. Consider deepening one area.`
      });
    }
    
    // Render insights
    const insightsHTML = insightItems.map(insight => `
      <div class="insight-item insight-${insight.type}">
        <div class="insight-text">${insight.message}</div>
      </div>
    `).join('');
    
    elements.learningInsights.innerHTML = insightsHTML;
  } catch (error) {
    console.error('Error loading insights:', error);
  }
}

// Search knowledge
async function searchKnowledge() {
  const searchTerm = elements.knowledgeSearch.value.trim();
  if (!searchTerm) return;
  
  try {
    const results = await knowledgeStorage.searchNodes(searchTerm);
    
    if (results.length === 0) {
      elements.searchResults.innerHTML = `<div class="empty-state">No results found for "${searchTerm}"</div>`;
      return;
    }
    
    // Render search results
    const resultsHTML = results.slice(0, 10).map(node => `
      <div class="knowledge-node">
        <div class="node-title">${truncateText(node.title, 80)}</div>
        <div class="node-meta">
          <span>${new Date(node.timestamp).toLocaleDateString()}</span>
          <span>${node.category}</span>
        </div>
        <div class="node-concepts">
          ${node.concepts.map(c => 
            `<span class="timeline-concept">${c}</span>`
          ).join('')}
        </div>
      </div>
    `).join('');
    
    elements.searchResults.innerHTML = resultsHTML;
  } catch (error) {
    console.error('Error searching knowledge:', error);
    elements.searchResults.innerHTML = '<div class="error">Search failed. Please try again.</div>';
  }
}

// Setup graph controls
function setupGraphControls() {
  // Reset view button
  const resetGraphBtn = document.getElementById('resetGraphBtn');
  if (resetGraphBtn) {
    resetGraphBtn.addEventListener('click', () => {
      if (networkVisualizer && networkVisualizer.network) {
        networkVisualizer.resetView();
      } else {
        console.log('Network visualizer not ready');
      }
    });
  }
  
  // Toggle physics button
  const togglePhysicsBtn = document.getElementById('togglePhysicsBtn');
  if (togglePhysicsBtn) {
    togglePhysicsBtn.addEventListener('click', () => {
      if (networkVisualizer && networkVisualizer.network) {
        networkVisualizer.togglePhysics();
        togglePhysicsBtn.textContent = networkVisualizer.physicsEnabled ? 'Disable Physics' : 'Enable Physics';
      } else {
        console.log('Network visualizer not ready');
      }
    });
  }
  
  // Filter dropdown
  const graphFilter = document.getElementById('graphFilter');
  if (graphFilter) {
    graphFilter.addEventListener('change', (e) => {
      if (networkVisualizer && networkVisualizer.network) {
        networkVisualizer.filterByTime(e.target.value);
      } else {
        console.log('Network visualizer not ready');
      }
    });
  }
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
