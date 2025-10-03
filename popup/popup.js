// Attention Is All You Need - Popup JavaScript

// DOM Elements
const elements = {
  // Stats
  totalTimeValue: document.getElementById('totalTimeValue'),
  focusScore: document.getElementById('focusScore'),
  sitesCount: document.getElementById('sitesCount'),
  topicsCount: document.getElementById('topicsCount'),
  
  // Intention
  intentionInput: document.getElementById('intentionInput'),
  intentionDisplay: document.getElementById('intentionDisplay'),
  
  // Character
  characterSection: document.getElementById('characterSection'),
  noCharacter: document.getElementById('noCharacter'),
  characterInfo: document.getElementById('characterInfo'),
  characterAvatar: document.getElementById('characterAvatar'),
  characterName: document.getElementById('characterName'),
  characterType: document.getElementById('characterType'),
  characterAbility: document.getElementById('characterAbility'),
  
  // Buttons
  viewAnalytics: document.getElementById('viewAnalytics'),
  askCoach: document.getElementById('askCoach'),
  viewTodos: document.getElementById('viewTodos')
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
  await loadCharacter();
  updateUI();
  startTimer();
  setupEventListeners();
  setupIntention();
});

// Load AI-generated summaries
async function loadAISummaries() {
  try {
    // Get recent reading sessions from storage
    const summaries = await chrome.storage.local.get('readingSummaries');
    
    if (summaries.readingSummaries && summaries.readingSummaries.length > 0) {
      // Update coach status
      elements.coachStatus.textContent = `${summaries.readingSummaries.length} summaries available`;
      
      // Hide default message and show summaries
      elements.coachSummary.style.display = 'none';
      elements.summaryList.style.display = 'flex';
      
      // Display summaries
      displaySummaries(summaries.readingSummaries.slice(0, 3));
    } else {
      // Show default message
      elements.coachStatus.textContent = 'Ready to help';
      elements.coachSummary.style.display = 'block';
      elements.summaryList.style.display = 'none';
    }
  } catch (error) {
    console.error('Error loading summaries:', error);
    elements.coachStatus.textContent = 'Ready to help';
  }
}

// Display reading summaries
function displaySummaries(summaries) {
  elements.summaryList.innerHTML = '';
  
  summaries.forEach(summary => {
    const item = document.createElement('div');
    item.className = 'summary-item';
    
    const title = document.createElement('div');
    title.className = 'summary-title';
    title.textContent = summary.title || 'Reading Summary';
    
    const text = document.createElement('div');
    text.className = 'summary-text';
    text.textContent = summary.text || 'Summary of your recent reading session...';
    
    const time = document.createElement('div');
    time.className = 'summary-time';
    time.textContent = formatTimeAgo(summary.timestamp);
    
    item.appendChild(title);
    item.appendChild(text);
    item.appendChild(time);
    
    elements.summaryList.appendChild(item);
  });
}

// Format time ago
function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Recently';
  
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

// Ask SYNAPSE ANALYST for help - opens dialog window
async function askAICoach() {
  // Open the SYNAPSE ANALYST dialog in a new window
  chrome.windows.create({
    url: chrome.runtime.getURL('popup/coach-dialog.html'),
    type: 'popup',
    width: 500,
    height: 600,
    left: Math.round((screen.width - 500) / 2),
    top: Math.round((screen.height - 600) / 2)
  });
}

// Todo Manager State
let todos = {
  goals: [],
  lastUpdated: null
};

// Load todos from storage
async function loadTodos() {
  try {
    const stored = await chrome.storage.local.get('todoData');
    if (stored.todoData) {
      todos = stored.todoData;
      renderTodos();
      updateTodoSummary();
    } else {
      // Show empty state
      document.getElementById('emptyState').style.display = 'block';
      document.getElementById('goalsContainer').style.display = 'none';
    }
  } catch (error) {
    console.error('Error loading todos:', error);
  }
}

// Save todos to storage
async function saveTodos() {
  try {
    todos.lastUpdated = new Date().toISOString();
    await chrome.storage.local.set({ todoData: todos });
    await chrome.storage.sync.set({ todoData: todos });
  } catch (error) {
    console.error('Error saving todos:', error);
  }
}

// Setup todo manager event listeners
function setupTodoManager() {
  const addGoalBtn = document.getElementById('addGoalBtn');
  const saveGoalBtn = document.getElementById('saveGoalBtn');
  const cancelGoalBtn = document.getElementById('cancelGoalBtn');
  const goalInput = document.getElementById('goalInput');
  
  // Add goal button
  addGoalBtn.addEventListener('click', () => {
    document.getElementById('quickAddGoal').style.display = 'block';
    goalInput.focus();
  });
  
  // Save goal
  saveGoalBtn.addEventListener('click', () => {
    const goalTitle = goalInput.value.trim();
    if (goalTitle) {
      addGoal(goalTitle);
      goalInput.value = '';
      document.getElementById('quickAddGoal').style.display = 'none';
    }
  });
  
  // Cancel goal
  cancelGoalBtn.addEventListener('click', () => {
    goalInput.value = '';
    document.getElementById('quickAddGoal').style.display = 'none';
  });
  
  // Enter key to save goal
  goalInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveGoalBtn.click();
    }
  });
}

// Add a new goal
function addGoal(title) {
  const goal = {
    id: Date.now().toString(),
    title: title,
    todos: [],
    createdAt: new Date().toISOString(),
    progress: 0
  };
  
  todos.goals.push(goal);
  saveTodos();
  renderTodos();
  updateTodoSummary();
}

// Add a todo to a goal
function addTodo(goalId) {
  const todoTitle = prompt('Enter todo:');
  if (!todoTitle) return;
  
  const estimatedTime = parseInt(prompt('Estimated time (minutes):', '30')) || 30;
  
  const goal = todos.goals.find(g => g.id === goalId);
  if (goal) {
    const todo = {
      id: Date.now().toString(),
      title: todoTitle,
      estimatedTime: estimatedTime,
      actualTime: 0,
      completed: false,
      createdAt: new Date().toISOString()
    };
    
    goal.todos.push(todo);
    saveTodos();
    renderTodos();
    updateTodoSummary();
  }
}

// Toggle todo completion
function toggleTodo(goalId, todoId) {
  const goal = todos.goals.find(g => g.id === goalId);
  if (goal) {
    const todo = goal.todos.find(t => t.id === todoId);
    if (todo) {
      todo.completed = !todo.completed;
      if (todo.completed) {
        todo.completedAt = new Date().toISOString();
      }
      
      // Update goal progress
      const completedCount = goal.todos.filter(t => t.completed).length;
      goal.progress = goal.todos.length > 0 
        ? Math.round((completedCount / goal.todos.length) * 100)
        : 0;
      
      saveTodos();
      renderTodos();
      updateTodoSummary();
    }
  }
}

// Render todos in the UI
function renderTodos() {
  const container = document.getElementById('goalsContainer');
  const emptyState = document.getElementById('emptyState');
  
  if (todos.goals.length === 0) {
    container.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }
  
  container.style.display = 'block';
  emptyState.style.display = 'none';
  container.innerHTML = '';
  
  todos.goals.forEach(goal => {
    const goalEl = document.createElement('div');
    goalEl.className = 'goal-item';
    
    const completedCount = goal.todos.filter(t => t.completed).length;
    const totalCount = goal.todos.length;
    const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    
    goalEl.innerHTML = `
      <div class="goal-header">
        <div class="goal-title">
          <span>${goal.title}</span>
        </div>
        <div class="goal-progress">${progress}%</div>
      </div>
      <div class="goal-todos">
        ${goal.todos.map(todo => `
          <div class="todo-item">
            <div class="todo-checkbox ${todo.completed ? 'checked' : ''}" 
                 data-goal-id="${goal.id}" 
                 data-todo-id="${todo.id}"></div>
            <span class="todo-text ${todo.completed ? 'completed' : ''}">${todo.title}</span>
            <span class="todo-time">${todo.estimatedTime}m</span>
          </div>
        `).join('')}
        <button class="add-todo-btn" data-goal-id="${goal.id}">+ Add todo</button>
      </div>
    `;
    
    container.appendChild(goalEl);
  });
  
  // Add event listeners to checkboxes and buttons
  container.querySelectorAll('.todo-checkbox').forEach(checkbox => {
    checkbox.addEventListener('click', (e) => {
      const goalId = e.target.dataset.goalId;
      const todoId = e.target.dataset.todoId;
      toggleTodo(goalId, todoId);
    });
  });
  
  container.querySelectorAll('.add-todo-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const goalId = e.target.dataset.goalId;
      addTodo(goalId);
    });
  });
}

// Update todo summary
function updateTodoSummary() {
  let totalTodos = 0;
  let completedTodos = 0;
  
  todos.goals.forEach(goal => {
    totalTodos += goal.todos.length;
    completedTodos += goal.todos.filter(t => t.completed).length;
  });
  
  if (totalTodos > 0) {
    document.getElementById('todoSummary').style.display = 'block';
    document.getElementById('totalTodos').textContent = totalTodos;
    document.getElementById('completedTodos').textContent = completedTodos;
    document.getElementById('progressPercent').textContent = 
      Math.round((completedTodos / totalTodos) * 100) + '%';
  } else {
    document.getElementById('todoSummary').style.display = 'none';
  }
}

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
  // Update stats
  const minutes = Math.floor(todayData.totalTime / 60000);
  if (elements.totalTimeValue) {
    elements.totalTimeValue.textContent = minutes;
  }
  
  if (elements.sitesCount) {
    elements.sitesCount.textContent = todayData.uniqueSites.size || '0';
  }
  
  if (elements.topicsCount) {
    elements.topicsCount.textContent = todayData.topics.size || '0';
  }
  
  if (elements.focusScore) {
    elements.focusScore.textContent = calculateFocusScore();
  }
  
  // Update focus state display
  updateFocusDisplay();
}

// Load character data
async function loadCharacter() {
  try {
    const stored = await chrome.storage.local.get('userCharacter');
    if (stored.userCharacter) {
      displayCharacter(stored.userCharacter);
    } else {
      // Show no character state
      if (elements.noCharacter) {
        elements.noCharacter.style.display = 'block';
      }
      if (elements.characterInfo) {
        elements.characterInfo.style.display = 'none';
      }
    }
  } catch (error) {
    console.error('Error loading character:', error);
  }
}

// Display character
function displayCharacter(character) {
  if (elements.noCharacter) {
    elements.noCharacter.style.display = 'none';
  }
  if (elements.characterInfo) {
    elements.characterInfo.style.display = 'block';
  }
  
  if (elements.characterAvatar) {
    elements.characterAvatar.textContent = character.emoji || '🤖';
  }
  if (elements.characterName) {
    elements.characterName.textContent = character.name || 'AGENT';
  }
  if (elements.characterType) {
    elements.characterType.textContent = `TYPE: ${character.type || 'UNKNOWN'}`;
  }
  if (elements.characterAbility) {
    elements.characterAbility.textContent = `[ABILITY]: ${character.ability || 'Processing...'}`;
  }
}

// Setup intention system
function setupIntention() {
  const intentionSection = document.querySelector('.intention-section');
  if (!intentionSection) return;
  
  // Load saved intention
  chrome.storage.local.get('todayIntention', (data) => {
    if (data.todayIntention) {
      showIntention(data.todayIntention);
    } else {
      showIntentionInput();
    }
  });
  
  // Handle intention input
  if (elements.intentionInput) {
    elements.intentionInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const intention = e.target.value.trim();
        if (intention) {
          saveIntention(intention);
        }
      }
    });
  }
}

// Show intention input
function showIntentionInput() {
  if (elements.intentionInput) {
    elements.intentionInput.style.display = 'block';
    elements.intentionInput.focus();
  }
  if (elements.intentionDisplay) {
    elements.intentionDisplay.style.display = 'none';
  }
}

// Show saved intention
function showIntention(intention) {
  if (elements.intentionInput) {
    elements.intentionInput.style.display = 'none';
  }
  if (elements.intentionDisplay) {
    elements.intentionDisplay.style.display = 'block';
    elements.intentionDisplay.textContent = intention;
  }
}

// Save intention
function saveIntention(intention) {
  chrome.storage.local.set({ todayIntention: intention }, () => {
    showIntention(intention);
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

// Update focus state display
function updateFocusDisplay() {
  // Calculate percentages for mini bars
  const totalFocusTime = todayData.deepFocusTime + todayData.activeReadingTime + todayData.scanningTime;
  
  if (totalFocusTime > 0) {
    const deepPercent = (todayData.deepFocusTime / totalFocusTime) * 100;
    const activePercent = (todayData.activeReadingTime / totalFocusTime) * 100;
    const scanPercent = (todayData.scanningTime / totalFocusTime) * 100;
    
    // Update mini bars
    const deepMini = document.getElementById('deepMini');
    const activeMini = document.getElementById('activeMini');
    const scanMini = document.getElementById('scanMini');
    
    if (deepMini) deepMini.style.width = `${deepPercent}%`;
    if (activeMini) activeMini.style.width = `${activePercent}%`;
    if (scanMini) scanMini.style.width = `${scanPercent}%`;
  }
  
  // Update current focus badge based on current session
  const focusBadge = document.getElementById('focusBadge');
  if (focusBadge && currentSession) {
    const elapsed = Date.now() - currentSession.startTime;
    const minutes = elapsed / 60000;
    
    let focusState = '[SCAN]';
    let badgeClass = 'focus-badge-large scan-state';
    
    if (minutes >= 10) {
      focusState = '[DEEP]';
      badgeClass = 'focus-badge-large deep-state';
    } else if (minutes >= 5) {
      focusState = '[ACTIVE]';
      badgeClass = 'focus-badge-large active-state';
    }
    
    focusBadge.textContent = focusState;
    focusBadge.className = badgeClass;
  } else if (focusBadge) {
    focusBadge.textContent = '[IDLE]';
    focusBadge.className = 'focus-badge-large idle-state';
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
      
      // Update total time display
      if (elements.totalTimeValue) {
        const totalMinutes = Math.floor((todayData.totalTime + elapsed) / 60000);
        elements.totalTimeValue.textContent = totalMinutes;
      }
      
      // Update focus state display
      updateFocusDisplay();
    }
  }, 1000);
}

// Setup event listeners
function setupEventListeners() {
  // Analytics button
  if (elements.viewAnalytics) {
    elements.viewAnalytics.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('analytics/analytics.html') });
    });
  }
  
  // SYNAPSE ANALYST button
  if (elements.askCoach) {
    elements.askCoach.addEventListener('click', () => {
      chrome.windows.create({
        url: chrome.runtime.getURL('popup/coach-dialog.html'),
        type: 'popup',
        width: 500,
        height: 600,
        left: Math.round((screen.width - 500) / 2),
        top: Math.round((screen.height - 600) / 2)
      });
    });
  }
  
  // Missions (Todo) button
  if (elements.viewTodos) {
    elements.viewTodos.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('popup/todo-manager.html') });
    });
  }
  
  // Click on intention display to edit
  if (elements.intentionDisplay) {
    elements.intentionDisplay.addEventListener('click', () => {
      showIntentionInput();
      if (elements.intentionInput) {
        elements.intentionInput.value = elements.intentionDisplay.textContent;
        elements.intentionInput.select();
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
