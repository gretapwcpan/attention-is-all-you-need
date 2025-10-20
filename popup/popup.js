// AttenGame - Popup JavaScript

// DOM Elements
const elements = {
  // Stats
  totalTimeValue: document.getElementById('totalTimeValue'),
  focusScore: document.getElementById('focusScore'),
  goalsCompleted: document.getElementById('goalsCompleted'),
  
  // Companion
  companionLevel: document.getElementById('companionLevel'),
  petStage: document.getElementById('petStage'),
  petSprite: document.getElementById('petSprite'),
  companionName: document.getElementById('companionName'),
  petMessage: document.getElementById('petMessage'),
  
  // XP System
  xpValue: document.getElementById('xpValue'),
  xpBarFill: document.getElementById('xpBarFill'),
  
  // Stats bars
  happinessBar: document.getElementById('happinessBar'),
  happinessValue: document.getElementById('happinessValue'),
  energyBar: document.getElementById('energyBar'),
  energyValue: document.getElementById('energyValue'),
  knowledgeBar: document.getElementById('knowledgeBar'),
  knowledgeValue: document.getElementById('knowledgeValue'),
  
  // Buttons
  viewAnalytics: document.getElementById('viewAnalytics'),
  askCoach: document.getElementById('askCoach'),
  viewTodos: document.getElementById('viewTodos'),
  feedBtn: document.getElementById('feedBtn'),
  statsBtn: document.getElementById('statsBtn'),
  trainBtn: document.getElementById('trainBtn')
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
  console.log('🚀 AttenGame initializing...');
  await loadCurrentSession();
  await loadTodayData();
  await loadCharacter();
  await initTamagotchi();
  await loadXP();
  updateUI();
  startTimer();
  setupEventListeners();
});

// XP System
let userXP = 0;

async function loadXP() {
  try {
    const data = await chrome.storage.local.get('userXP');
    userXP = data.userXP || 0;
    updateXPDisplay();
  } catch (error) {
    console.error('Error loading XP:', error);
  }
}

async function addFocusPoints(amount) {
  userXP += amount;
  await chrome.storage.local.set({ userXP });
  updateXPDisplay();
  showPointsGain(amount);
  
  // Check for evolution when XP changes
  checkXPBasedEvolution(userXP);
}

function updateXPDisplay() {
  if (elements.xpValue) {
    elements.xpValue.textContent = userXP;
  }
  
  // Calculate level and progress
  const level = Math.floor(userXP / 10) + 1;
  
  // Update companion level display
  if (elements.companionLevel) {
    elements.companionLevel.textContent = `Level ${level}`;
  }
  
  // Calculate progress to next evolution
  let progressPercent = 0;
  let nextEvolution = '';
  let xpNeeded = 0;
  
  if (userXP < 5) {
    progressPercent = (userXP / 5) * 100;
    nextEvolution = 'BABY';
    xpNeeded = 5 - userXP;
  } else if (userXP < 20) {
    progressPercent = ((userXP - 5) / 15) * 100;
    nextEvolution = 'TEEN';
    xpNeeded = 20 - userXP;
  } else if (userXP < 50) {
    progressPercent = ((userXP - 20) / 30) * 100;
    nextEvolution = 'ADULT';
    xpNeeded = 50 - userXP;
  } else {
    progressPercent = 100;
    nextEvolution = 'MASTER';
    xpNeeded = 0;
  }
  
  // Update XP progress bar
  if (elements.xpBarFill) {
    elements.xpBarFill.style.width = `${progressPercent}%`;
  }
  
  // Update evolution dots
  const dots = document.querySelectorAll('.xp-dots .dot');
  const filledDots = Math.floor((progressPercent / 100) * dots.length);
  dots.forEach((dot, index) => {
    if (index < filledDots) {
      dot.classList.add('filled');
    } else {
      dot.classList.remove('filled');
    }
  });
  
  // Update next evolution display
  const evolutionName = document.querySelector('.evolution-name');
  const evolutionRequirement = document.querySelector('.evolution-requirement');
  if (evolutionName) {
    evolutionName.textContent = nextEvolution;
  }
  if (evolutionRequirement) {
    evolutionRequirement.textContent = xpNeeded > 0 ? `${xpNeeded} XP` : 'MAX';
  }
}

function showPointsGain(amount) {
  const xpGain = document.createElement('div');
  xpGain.className = 'xp-gain';
  xpGain.textContent = `+${amount} Points`;
  document.body.appendChild(xpGain);
  
  setTimeout(() => {
    xpGain.remove();
  }, 1500);
}

// Tamagotchi Pet System
let tamagotchiPet = null;

async function initTamagotchi() {
  try {
    // Load pet data from storage
    const data = await chrome.storage.local.get(['tamagotchiPet', 'userXP']);
    if (data.tamagotchiPet) {
      tamagotchiPet = data.tamagotchiPet;
      // Migrate old 'foundation' stage to 'egg' if needed
      if (tamagotchiPet.stage === 'foundation') {
        tamagotchiPet.stage = 'egg';
      }
    } else {
      // Create new companion
      tamagotchiPet = {
        stage: 'egg',
        born: Date.now(),
        stats: {
          progress: 50,
          energy: 50,
          knowledge: 0,
          health: 100
        },
        goalsCompleted: 0,
        totalFocusTime: 0,
        mood: 'neutral',
        isAlive: true
      };
      await chrome.storage.local.set({ tamagotchiPet });
    }
    
    // Check XP-based evolution immediately - force update
    const currentXP = data.userXP || 0;
    userXP = currentXP; // Ensure userXP is set
    checkXPBasedEvolution(currentXP);
    
    updatePetDisplay();
    
    // Update pet stats periodically (prevent multiple intervals)
    if (!window.petStatsTimer) {
      window.petStatsTimer = setInterval(() => {
        requestAnimationFrame(updatePetStats);
      }, 60000); // Every minute
    }
    
    // Listen for mission completions
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'missionCompleted') {
        onMissionComplete();
      }
    });
    
    // Also listen for storage changes to detect XP updates
    // TEMPORARILY DISABLED TO TEST IF THIS CAUSES UI SHAKING
    /*
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.userXP) {
        const newXP = changes.userXP.newValue || 0;
        checkXPBasedEvolution(newXP);
      }
    });
    */
    
  } catch (error) {
    console.error('Error initializing Tamagotchi:', error);
  }
}

// Track previous display state to prevent unnecessary innerHTML updates
let previousPetImagePath = null;
let previousPetMood = null;

function updatePetDisplay() {
  if (!tamagotchiPet) return;

  // Use SVG images for pet stages
  if (elements.petSprite) {
    // Ensure proper stage mapping
    let imageStage = tamagotchiPet.stage;
    if (imageStage === 'foundation') {
      imageStage = 'egg'; // Map foundation to egg for backwards compatibility
    }
    const imagePath = `image/${imageStage}.svg`;
    const currentMood = tamagotchiPet.mood;

    // Only update innerHTML if image or mood actually changed
    if (imagePath !== previousPetImagePath || currentMood !== previousPetMood) {
      elements.petSprite.innerHTML = `<img src="${imagePath}" alt="${tamagotchiPet.stage}" class="companion-image ${currentMood}">`;
      previousPetImagePath = imagePath;
      previousPetMood = currentMood;
    }
  }
  
  // Update mastery stage
  if (elements.petStage) {
    const stageNames = {
      'foundation': 'FOUNDATION',
      'egg': 'FOUNDATION',
      'baby': 'BEGINNER',
      'teen': 'INTERMEDIATE',
      'adult': 'MASTER'
    };
    // Force re-check XP evolution if stage seems wrong
    if (userXP >= 20 && (tamagotchiPet.stage === 'egg' || tamagotchiPet.stage === 'foundation' || tamagotchiPet.stage === 'baby')) {
      checkXPBasedEvolution(userXP);
    }
    elements.petStage.textContent = `[${stageNames[tamagotchiPet.stage] || tamagotchiPet.stage.toUpperCase()}]`;
  }
  
  // Update companion name
  if (elements.companionName) {
    elements.companionName.textContent = tamagotchiPet.name || 'Focus Buddy';
  }
  
  // Update pet message
  if (elements.petMessage) {
    elements.petMessage.textContent = getPetMessage();
  }
  
  // Add click interaction to mascot (only once)
  if (elements.petSprite && !elements.petSprite.hasAttribute('data-click-handler')) {
    elements.petSprite.setAttribute('data-click-handler', 'true');
    elements.petSprite.style.cursor = 'pointer';
    
    elements.petSprite.addEventListener('click', () => {
      // Trigger celebration animation
      elements.petSprite.classList.add('celebrating');
      
      // Change mood temporarily
      const previousMood = tamagotchiPet.mood;
      tamagotchiPet.mood = 'excited';
      
      // Update message
      const excitedMessages = [
        'Yay! Thanks for the attention!',
        'Woohoo! Let\'s stay focused!',
        'That tickles! Ready to work!',
        'Hi there! Let\'s achieve greatness!',
        'Feeling energized! Let\'s go!'
      ];
      elements.petMessage.textContent = excitedMessages[Math.floor(Math.random() * excitedMessages.length)];
      
      // Small stat boost
      tamagotchiPet.stats.energy = Math.min(100, tamagotchiPet.stats.energy + 5);
      updateStatBar('energy', tamagotchiPet.stats.energy);
      
      // Remove celebration after animation
      setTimeout(() => {
        elements.petSprite.classList.remove('celebrating');
        tamagotchiPet.mood = previousMood;
        elements.petMessage.textContent = getPetMessage();
      }, 1200);
    });
  }
  
  // Update stats bars with proper percentages
  const progressValue = tamagotchiPet.stats.progress || tamagotchiPet.stats.happiness || 50;
  const energyValue = tamagotchiPet.stats.energy || 50;
  const knowledgeValue = tamagotchiPet.stats.knowledge || 0;
  
  updateStatBar('happiness', progressValue);
  updateStatBar('energy', energyValue);
  updateStatBar('knowledge', knowledgeValue);
}

// Cache for stat bar values to prevent unnecessary updates
const statBarCache = {};

function updateStatBar(stat, value) {
  const bar = document.getElementById(`${stat}Bar`);
  const valueEl = document.getElementById(`${stat}Value`);
  
  // Only update if value actually changed
  const roundedValue = Math.round(value);
  if (statBarCache[stat] === roundedValue) {
    return; // Skip update if value hasn't changed
  }
  statBarCache[stat] = roundedValue;
  
  if (bar) {
    bar.style.width = `${roundedValue}%`;
  }
  if (valueEl) {
    valueEl.textContent = `${roundedValue}%`;
  }
}

function getPetMessage() {
  if ((tamagotchiPet.stage === 'foundation' || tamagotchiPet.stage === 'egg') && userXP < 5) {
    return 'Complete your first goal to begin your journey!';
  }
  
  switch (tamagotchiPet.mood) {
    case 'sad':
      return 'I need some attention... Complete a goal to boost progress!';
    case 'sleeping':
      return 'Zzz... Taking a quick rest...';
    case 'studying':
      return 'Learning and growing with you!';
    case 'excited':
      return 'Excellent work on that goal!';
    case 'happy':
      return "Making great progress! Keep it up!";
    default:
      return `${tamagotchiPet.goalsCompleted || tamagotchiPet.missionsCompleted || 0} goals completed! Let's achieve more!`;
  }
}

function updatePetStats() {
  if (!tamagotchiPet) return;
  
  // Decrease progress and energy over time
  const progressStat = tamagotchiPet.stats.progress || tamagotchiPet.stats.happiness;
  tamagotchiPet.stats.progress = Math.max(0, progressStat - 1);
  tamagotchiPet.stats.happiness = tamagotchiPet.stats.progress; // Keep for compatibility
  tamagotchiPet.stats.energy = Math.max(0, tamagotchiPet.stats.energy - 1);
  
  // Update mood based on stats
  if (tamagotchiPet.stats.progress < 20) {
    tamagotchiPet.mood = 'sad';
  } else if (tamagotchiPet.stats.progress > 80) {
    tamagotchiPet.mood = 'happy';
  } else if (tamagotchiPet.stats.energy < 20) {
    tamagotchiPet.mood = 'sleeping';
  } else {
    tamagotchiPet.mood = 'neutral';
  }
  
  // Save and update display
  chrome.storage.local.set({ tamagotchiPet });
  updatePetDisplay();
}

async function onMissionComplete() {
  if (!tamagotchiPet) return;
  
  const goalsCount = tamagotchiPet.goalsCompleted || tamagotchiPet.missionsCompleted || 0;
  tamagotchiPet.goalsCompleted = goalsCount + 1;
  tamagotchiPet.missionsCompleted = tamagotchiPet.goalsCompleted; // Keep for compatibility
  tamagotchiPet.stats.progress = Math.min(100, (tamagotchiPet.stats.progress || tamagotchiPet.stats.happiness || 50) + 20);
  tamagotchiPet.stats.happiness = tamagotchiPet.stats.progress; // Keep for compatibility
  tamagotchiPet.stats.energy = Math.min(100, tamagotchiPet.stats.energy + 10);
  tamagotchiPet.stats.knowledge = Math.min(100, tamagotchiPet.stats.knowledge + 5);
  tamagotchiPet.mood = 'excited';
  
  // XP-based evolution is now handled by checkXPBasedEvolution()
  // which is triggered by storage changes when XP is updated
  
  // Add celebration animation
  if (elements.petSprite) {
    elements.petSprite.classList.add('celebrating');
    setTimeout(() => {
      elements.petSprite.classList.remove('celebrating');
    }, 1000);
  }
  
  await chrome.storage.local.set({ tamagotchiPet });
  updatePetDisplay();
  
  // Award XP points for mission completion (5 XP per mission)
  await addFocusPoints(5);
  
  // Reset mood after a few seconds
  setTimeout(() => {
    tamagotchiPet.mood = 'happy';
    updatePetDisplay();
  }, 5000);
}

// New function to check XP-based evolution
function checkXPBasedEvolution(xp) {
  if (!tamagotchiPet) return;
  
  let newStage = tamagotchiPet.stage;
  
  // XP-based evolution thresholds
  if (xp >= 50) {
    newStage = 'adult'; // Master stage at 50 XP
  } else if (xp >= 20) {
    newStage = 'teen'; // Intermediate stage at 20 XP
  } else if (xp >= 5) {
    newStage = 'baby'; // Beginner stage at 5 XP
  } else {
    newStage = 'egg'; // Egg stage below 5 XP (changed from 'foundation')
  }
  
  // If stage changed, update and save
  if (newStage !== tamagotchiPet.stage) {
    const oldStage = tamagotchiPet.stage;
    tamagotchiPet.stage = newStage;
    
    // Boost stats on evolution
    if (newStage !== 'egg' && newStage !== 'foundation') {
      tamagotchiPet.stats.progress = Math.min(100, tamagotchiPet.stats.progress + 30);
      tamagotchiPet.stats.happiness = tamagotchiPet.stats.progress;
      tamagotchiPet.stats.energy = Math.min(100, tamagotchiPet.stats.energy + 20);
      tamagotchiPet.mood = 'excited';
      
      // Show evolution message
      showEvolutionMessage(oldStage, newStage);
    }
    
    chrome.storage.local.set({ tamagotchiPet });
    updatePetDisplay();
  }
}

// Show evolution celebration message
function showEvolutionMessage(oldStage, newStage) {
  const stageNames = {
    'foundation': 'Foundation',
    'egg': 'Foundation',
    'baby': 'Beginner',
    'teen': 'Intermediate',
    'adult': 'Master'
  };
  
  const message = `🎉 Evolution! Your companion evolved from ${stageNames[oldStage]} to ${stageNames[newStage]}!`;
  
  // Create evolution notification
  const notification = document.createElement('div');
  notification.className = 'evolution-notification';
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 15px 30px;
    border-radius: 10px;
    font-family: 'Orbitron', monospace;
    font-weight: bold;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    z-index: 10000;
    animation: slide-down 0.5s ease-out;
  `;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slide-up 0.5s ease-out';
    setTimeout(() => notification.remove(), 500);
  }, 3000);
}

// Link focus states to pet energy
function updatePetWithFocusState() {
  if (!tamagotchiPet || !currentSession) return;
  
  const elapsed = Date.now() - currentSession.startTime;
  const minutes = elapsed / 60000;
  
  if (minutes >= 10) {
    // Deep focus boosts energy
    tamagotchiPet.stats.energy = Math.min(100, tamagotchiPet.stats.energy + 2);
    tamagotchiPet.mood = 'studying';
  } else if (minutes >= 5) {
    // Active reading maintains energy
    tamagotchiPet.stats.energy = Math.min(100, tamagotchiPet.stats.energy + 1);
  }
  
  updatePetDisplay();
}

// Note: AI summaries feature has been removed as the DOM elements no longer exist
// This functionality has been replaced by the Tamagotchi pet system

// Open AttenGame Insights dialog window
async function askAICoach() {
  // Open the AttenGame Insights dialog in a new window
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
  
  if (elements.focusScore) {
    elements.focusScore.textContent = calculateFocusScore();
  }
  
  // Update goals completed count
  if (elements.goalsCompleted && tamagotchiPet) {
    const goalsCount = tamagotchiPet.goalsCompleted || 0;
    elements.goalsCompleted.textContent = goalsCount;
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

// Removed intention system - replaced by XP display

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

// Track previous states to prevent unnecessary updates
let previousFocusState = null;
let previousFocusClass = null;

// Update focus state display
function updateFocusDisplay() {
  // Calculate percentages for mini bars
  const totalFocusTime = todayData.deepFocusTime + todayData.activeReadingTime + todayData.scanningTime;

  if (totalFocusTime > 0) {
    const deepPercent = (todayData.deepFocusTime / totalFocusTime) * 100;
    const activePercent = (todayData.activeReadingTime / totalFocusTime) * 100;
    const scanPercent = (todayData.scanningTime / totalFocusTime) * 100;

    // Update mini bars only if they exist and values changed
    const deepMini = document.getElementById('deepMini');
    const activeMini = document.getElementById('activeMini');
    const scanMini = document.getElementById('scanMini');

    // BATCH ALL READS FIRST to avoid layout thrashing
    const currentDeepWidth = deepMini ? deepMini.style.width : '';
    const currentActiveWidth = activeMini ? activeMini.style.width : '';
    const currentScanWidth = scanMini ? scanMini.style.width : '';

    // THEN BATCH ALL WRITES with rounded values to prevent floating point jitter
    const newDeepWidth = `${Math.round(deepPercent * 10) / 10}%`;
    const newActiveWidth = `${Math.round(activePercent * 10) / 10}%`;
    const newScanWidth = `${Math.round(scanPercent * 10) / 10}%`;

    if (deepMini && currentDeepWidth !== newDeepWidth) {
      deepMini.style.width = newDeepWidth;
    }
    if (activeMini && currentActiveWidth !== newActiveWidth) {
      activeMini.style.width = newActiveWidth;
    }
    if (scanMini && currentScanWidth !== newScanWidth) {
      scanMini.style.width = newScanWidth;
    }
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

    // Only update if the state actually changed
    if (focusState !== previousFocusState) {
      focusBadge.textContent = focusState;
      previousFocusState = focusState;
    }
    if (badgeClass !== previousFocusClass) {
      focusBadge.className = badgeClass;
      previousFocusClass = badgeClass;
    }
  } else if (focusBadge) {
    const idleState = '[IDLE]';
    const idleClass = 'focus-badge-large idle-state';

    if (idleState !== previousFocusState) {
      focusBadge.textContent = idleState;
      previousFocusState = idleState;
    }
    if (idleClass !== previousFocusClass) {
      focusBadge.className = idleClass;
      previousFocusClass = idleClass;
    }
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

// Timer management
let mainTimer = null;
let lastUpdateTime = 0;
let lastTotalMinutes = -1;

// Start timer for current session - optimized to reduce layout thrashing
function startTimer() {
  // Prevent multiple timers
  if (mainTimer) {
    clearInterval(mainTimer);
  }

  // Use requestAnimationFrame for smooth updates
  function updateTimer() {
    if (currentSession) {
      const now = Date.now();
      const elapsed = now - currentSession.startTime;
      const minutes = Math.floor(elapsed / 60000);

      // Batch DOM updates using requestAnimationFrame
      requestAnimationFrame(() => {
        // Only update total time display if it actually changed
        if (elements.totalTimeValue) {
          const totalMinutes = Math.floor((todayData.totalTime + elapsed) / 60000);
          if (totalMinutes !== lastTotalMinutes) {
            elements.totalTimeValue.textContent = totalMinutes;
            lastTotalMinutes = totalMinutes;
          }
        }

        // Only update focus display every 10 seconds to reduce reflows
        if (now - lastUpdateTime >= 10000) {
          updateFocusDisplay();
          lastUpdateTime = now;
        }
      });
    }
  }

  // Run updates every 5 seconds instead of every second
  mainTimer = setInterval(updateTimer, 5000);
  
  // Run once immediately
  updateTimer();
}

// Setup event listeners
function setupEventListeners() {
  // Analytics button
  if (elements.viewAnalytics) {
    elements.viewAnalytics.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('analytics/analytics.html') });
    });
  }
  
  // AttenGame Insights button
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
  
  // Daily Goals button
  if (elements.viewTodos) {
    elements.viewTodos.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('popup/todo-manager.html') });
    });
  }
  
  // Companion action buttons (renamed from feedBtn, statsBtn, trainBtn)
  const goalsBtn = document.getElementById('feedBtn');
  const statsBtn = document.getElementById('statsBtn');
  const trainBtn = document.getElementById('trainBtn');
  
  if (goalsBtn) {
    goalsBtn.addEventListener('click', () => {
      // Open Daily Goals to complete a goal
      chrome.tabs.create({ url: chrome.runtime.getURL('popup/todo-manager.html') });
    });
  }
  
  if (statsBtn) {
    statsBtn.addEventListener('click', () => {
      // Show detailed stats - open analytics
      chrome.tabs.create({ url: chrome.runtime.getURL('analytics/analytics.html') });
    });
  }
  
  if (trainBtn) {
    trainBtn.addEventListener('click', () => {
      // Open AI Coach for training
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
