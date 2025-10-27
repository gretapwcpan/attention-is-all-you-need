// Todo Manager JavaScript - Enhanced with Drag & Drop and AI Categorization
import { getTodoCategorizer } from '../utils/todo-categorizer.js';

class TodoManager {
    constructor() {
        this.goals = [];
        this.sortable = null;
        this.categorizer = null;
        this.currentFilter = 'all';
        this.init();
    }

    async init() {
        // Initialize categorizer
        this.categorizer = getTodoCategorizer();
        await this.categorizer.prewarm(); // Pre-warm AI model
        
        this.loadData();
        this.setupEventListeners();
        this.render();
        this.updateProgress();
        this.initializeSortable();
    }

    initializeSortable() {
        const goalsList = document.getElementById('goalsList');
        if (goalsList && typeof Sortable !== 'undefined') {
            this.sortable = Sortable.create(goalsList, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                dragClass: 'sortable-drag',
                handle: '.drag-handle',
                onEnd: (evt) => {
                    this.handleDragEnd(evt);
                }
            });
        }
    }

    handleDragEnd(evt) {
        const { oldIndex, newIndex } = evt;
        if (oldIndex === newIndex) return;

        // Reorder the goals array
        const movedGoal = this.goals.splice(oldIndex, 1)[0];
        this.goals.splice(newIndex, 0, movedGoal);

        // Update positions
        this.goals.forEach((goal, index) => {
            goal.position = index;
        });

        this.saveData();
        this.showMotivationalMessage('✨ Priorities updated!');
    }

    setupEventListeners() {
        // Back button
        const backBtn = document.getElementById('backBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                window.close();
            });
        }
        
        // Add goal button
        const addBtn = document.getElementById('addGoalBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addGoal());
        }
        
        const goalInput = document.getElementById('goalInput');
        if (goalInput) {
            goalInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.addGoal();
            });
        }

        // Category filter
        const categoryFilter = document.getElementById('categoryFilter');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', (e) => {
                this.currentFilter = e.target.value;
                this.render();
                this.updateFilterCount();
            });
        }

        // Footer buttons
        const analyticsBtn = document.getElementById('viewAnalyticsBtn');
        if (analyticsBtn) {
            analyticsBtn.addEventListener('click', () => {
                chrome.tabs.create({ url: chrome.runtime.getURL('analytics/analytics.html') });
            });
        }

        const clearBtn = document.getElementById('clearCompletedBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearCompleted();
            });
        }
    }

    loadData() {
        const savedData = localStorage.getItem('todoManagerData');
        if (savedData) {
            const data = JSON.parse(savedData);
            this.goals = data.goals || [];
            // Ensure all goals have required properties
            this.goals.forEach((goal, index) => {
                if (goal.completed === undefined) {
                    goal.completed = false;
                }
                if (goal.position === undefined) {
                    goal.position = index;
                }
                if (!goal.category) {
                    goal.category = 'personal';
                }
            });
            // Sort by position
            this.goals.sort((a, b) => a.position - b.position);
        } else {
            this.goals = [];
        }
    }

    saveData() {
        const data = {
            goals: this.goals,
            lastUpdated: new Date().toISOString()
        };
        localStorage.setItem('todoManagerData', JSON.stringify(data));
        
        // Also save to Chrome storage for cross-device sync
        if (chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.set({ todoManagerData: data });
        }
    }

    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    async addGoal() {
        const input = document.getElementById('goalInput');
        if (!input) return;
        
        const title = input.value.trim();
        if (!title) return;

        // Get AI categorization
        let category = 'General';
        
        if (this.categorizer) {
            try {
                const result = await this.categorizer.categorizeTodo(title);
                category = result.category;
            } catch (error) {
                console.log('Categorization failed, using default:', error);
            }
        }

        const newGoal = {
            id: this.generateId(),
            title: title,
            category: category,
            position: 0, // New items go to top
            completed: false,
            createdAt: new Date().toISOString()
        };

        // Add to beginning and update positions
        this.goals.unshift(newGoal);
        this.goals.forEach((goal, index) => {
            goal.position = index;
        });

        this.saveData();
        this.render();
        this.updateProgress();
        
        input.value = '';
        
        // Show category notification
        const categoryName = this.categorizer ? 
            this.categorizer.getCategoryDisplayName(category) : 
            category;
        this.showMotivationalMessage(`📝 Added to ${categoryName}`);
    }

    async toggleGoal(goalId) {
        const goal = this.goals.find(g => g.id === goalId);
        if (!goal) return;

        goal.completed = !goal.completed;
        if (goal.completed) {
            goal.completedAt = new Date().toISOString();
            
            // Award 1 XP for completing a mission
            await this.awardXP(1);
            
            // Notify Tamagotchi pet about mission completion
            if (chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({
                    action: 'missionCompleted',
                    missionData: {
                        goalTitle: goal.title,
                        category: goal.category
                    }
                }).catch(() => {
                    // Ignore errors if background script isn't ready
                });
            }
        }
        
        this.saveData();
        this.render();
        this.updateProgress();
    }
    
    async awardXP(amount) {
        try {
            // Get current XP
            const data = await chrome.storage.local.get('userXP');
            const currentXP = data.userXP || 0;
            const newXP = currentXP + amount;
            
            // Save new XP
            await chrome.storage.local.set({ userXP: newXP });
            
            // Show XP gain animation
            this.showXPGain(amount);
        } catch (error) {
            console.error('Error awarding XP:', error);
        }
    }
    
    showXPGain(amount) {
        const xpGain = document.createElement('div');
        xpGain.className = 'xp-gain';
        xpGain.textContent = `+${amount} XP`;
        xpGain.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-family: 'Orbitron', monospace;
            font-size: 32px;
            font-weight: 900;
            color: #FFD700;
            text-shadow: 0 0 20px #FFD700;
            z-index: 10000;
            pointer-events: none;
            animation: xp-float-up 1.5s ease-out forwards;
        `;
        document.body.appendChild(xpGain);
        
        setTimeout(() => {
            xpGain.remove();
        }, 1500);
    }

    deleteGoal(goalId) {
        if (confirm('Are you sure you want to delete this mission?')) {
            this.goals = this.goals.filter(g => g.id !== goalId);
            // Update positions
            this.goals.forEach((goal, index) => {
                goal.position = index;
            });
            this.saveData();
            this.render();
            this.updateProgress();
        }
    }

    async changeCategory(goalId) {
        const goal = this.goals.find(g => g.id === goalId);
        if (!goal) return;

        // Prompt user for new category
        const newCategory = prompt('Enter a new category:', goal.category);
        if (newCategory && newCategory.trim()) {
            // Format the category
            const formatted = newCategory.trim().charAt(0).toUpperCase() + 
                            newCategory.trim().slice(1).toLowerCase();
            goal.category = formatted;
            
            this.saveData();
            this.render();
            
            this.showMotivationalMessage(`📂 Changed to ${formatted}`);
        }
    }

    updateProgress() {
        const totalGoals = this.goals.length;
        const completedGoals = this.goals.filter(g => g.completed).length;
        
        const progress = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;
        
        // Update stats
        const totalGoalsEl = document.getElementById('totalGoals');
        if (totalGoalsEl) totalGoalsEl.textContent = totalGoals;
        
        const completedGoalsEl = document.getElementById('completedGoals');
        if (completedGoalsEl) completedGoalsEl.textContent = completedGoals;
        
        const progressEl = document.getElementById('todayProgress');
        if (progressEl) progressEl.textContent = `${progress}%`;
        
        const progressPercentEl = document.getElementById('progressPercent');
        if (progressPercentEl) progressPercentEl.textContent = `${progress}%`;
        
        // Update progress bar
        const progressFill = document.getElementById('progressFill');
        if (progressFill) progressFill.style.width = `${progress}%`;
        
        // Update streak
        this.updateStreak();
    }

    updateFilterCount() {
        const categoryFilter = document.getElementById('categoryFilter');
        if (!categoryFilter) return;

        // Get unique categories from goals
        const categories = [...new Set(this.goals.map(g => g.category))].sort();
        
        // Store current selection
        const currentSelection = categoryFilter.value;
        
        // Clear and rebuild options
        categoryFilter.innerHTML = '';
        
        // Add "All" option
        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = `All Categories (${this.goals.length})`;
        categoryFilter.appendChild(allOption);
        
        // Add each unique category
        categories.forEach(category => {
            const count = this.goals.filter(g => g.category === category).length;
            const option = document.createElement('option');
            option.value = category;
            option.textContent = `${category} (${count})`;
            categoryFilter.appendChild(option);
        });
        
        // Restore selection if it still exists
        if (currentSelection && Array.from(categoryFilter.options).some(opt => opt.value === currentSelection)) {
            categoryFilter.value = currentSelection;
        } else {
            categoryFilter.value = 'all';
            this.currentFilter = 'all';
        }
    }

    updateStreak() {
        const lastActivity = localStorage.getItem('lastActivityDate');
        const today = new Date().toDateString();
        let streak = parseInt(localStorage.getItem('streak') || '0');
        
        if (lastActivity !== today) {
            const yesterday = new Date(Date.now() - 86400000).toDateString();
            if (lastActivity === yesterday) {
                streak++;
            } else if (lastActivity !== today) {
                streak = 1;
            }
            localStorage.setItem('lastActivityDate', today);
            localStorage.setItem('streak', streak.toString());
        }
        
        const streakEl = document.getElementById('streak');
        if (streakEl) {
            streakEl.textContent = `${streak} ${streak === 1 ? 'day' : 'days'}`;
        }
    }

    clearCompleted() {
        const completedCount = this.goals.filter(g => g.completed).length;
        if (completedCount === 0) {
            return;
        }
        
        if (confirm(`Clear ${completedCount} completed mission${completedCount > 1 ? 's' : ''}?`)) {
            this.goals = this.goals.filter(g => !g.completed);
            // Update positions
            this.goals.forEach((goal, index) => {
                goal.position = index;
            });
            this.saveData();
            this.render();
            this.updateProgress();
        }
    }

    showMotivationalMessage(message) {
        const messageElement = document.getElementById('motivationalMessage');
        if (!messageElement) return;
        
        messageElement.textContent = message;
        messageElement.classList.add('show');
        
        setTimeout(() => {
            messageElement.classList.remove('show');
        }, 3000);
    }

    getFilteredGoals() {
        if (this.currentFilter === 'all') {
            return this.goals;
        }
        return this.goals.filter(g => g.category.toLowerCase() === this.currentFilter.toLowerCase());
    }

    render() {
        const goalsList = document.getElementById('goalsList');
        if (!goalsList) return;
        
        const filteredGoals = this.getFilteredGoals();
        
        if (filteredGoals.length === 0) {
            goalsList.innerHTML = `
                <div class="empty-state">
                    <h3>No missions yet</h3>
                    <p>${this.currentFilter !== 'all' ? 'No missions in this category' : 'Deploy your first mission objective above!'}</p>
                </div>
            `;
            return;
        }

        goalsList.innerHTML = '';
        filteredGoals.forEach(goal => {
            this.renderGoal(goal);
        });
        
        // Re-initialize sortable after render
        if (this.sortable) {
            this.sortable.destroy();
        }
        this.initializeSortable();
        
        // Update filter counts
        this.updateFilterCount();
    }

    renderGoal(goal) {
        const template = document.getElementById('goalTemplate');
        if (!template) return;
        
        const goalElement = template.content.cloneNode(true);
        const goalItem = goalElement.querySelector('.goal-item');
        
        if (goalItem) {
            goalItem.dataset.goalId = goal.id;
            if (goal.completed) {
                goalItem.classList.add('completed');
            }
        }
        
        // Add drag handle
        const dragHandle = goalElement.querySelector('.drag-handle');
        if (dragHandle && goal.completed) {
            dragHandle.style.visibility = 'hidden';
        }
        
        // Set title
        const titleEl = goalElement.querySelector('.goal-title');
        if (titleEl) {
            titleEl.textContent = goal.title;
        }
        
        // Add category badge
        const categoryBadge = goalElement.querySelector('.category-badge');
        if (categoryBadge) {
            const displayName = this.categorizer ? 
                this.categorizer.getCategoryDisplayName(goal.category) : 
                goal.category;
            categoryBadge.textContent = displayName;
            
            // Apply dynamic color if categorizer is available
            if (this.categorizer) {
                const color = this.categorizer.getCategoryColor(goal.category);
                categoryBadge.style.backgroundColor = color;
                categoryBadge.style.color = '#ffffff';
                categoryBadge.style.borderColor = color;
            }
            
            categoryBadge.addEventListener('click', () => {
                this.changeCategory(goal.id);
            });
        }
        
        // Edit input field
        const editInput = goalElement.querySelector('.goal-edit-input');
        if (editInput) {
            editInput.value = goal.title;
            editInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.saveGoalEdit(goal.id);
                } else if (e.key === 'Escape') {
                    this.cancelGoalEdit(goal.id);
                }
            });
        }
        
        // Edit button
        const editBtn = goalElement.querySelector('.edit-goal');
        if (editBtn) {
            if (goal.completed) {
                editBtn.style.display = 'none';
            } else {
                editBtn.addEventListener('click', () => {
                    this.editGoal(goal.id);
                });
            }
        }
        
        // Save button
        const saveBtn = goalElement.querySelector('.save-goal');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveGoalEdit(goal.id);
            });
        }
        
        // Cancel button
        const cancelBtn = goalElement.querySelector('.cancel-goal');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.cancelGoalEdit(goal.id);
            });
        }
        
        // Complete button
        const completeBtn = goalElement.querySelector('.complete-goal');
        if (completeBtn) {
            if (goal.completed) {
                completeBtn.style.display = 'none';
            } else {
                completeBtn.addEventListener('click', async () => {
                    await this.toggleGoal(goal.id);
                    this.triggerCoinCelebration();
                });
            }
        }
        
        // Delete button
        const deleteBtn = goalElement.querySelector('.delete-goal');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                this.deleteGoal(goal.id);
            });
        }
        
        const goalsList = document.getElementById('goalsList');
        if (goalsList) {
            goalsList.appendChild(goalElement);
        }
    }
    
    editGoal(goalId) {
        // Exit any other edit mode first
        const allGoalItems = document.querySelectorAll('.goal-item');
        allGoalItems.forEach(item => {
            item.classList.remove('editing');
        });
        
        // Enter edit mode for this goal
        const goalItem = document.querySelector(`[data-goal-id="${goalId}"]`);
        if (goalItem) {
            goalItem.classList.add('editing');
            const editInput = goalItem.querySelector('.goal-edit-input');
            if (editInput) {
                editInput.focus();
                editInput.select();
            }
        }
    }
    
    async saveGoalEdit(goalId) {
        const goalItem = document.querySelector(`[data-goal-id="${goalId}"]`);
        if (!goalItem) return;
        
        const editInput = goalItem.querySelector('.goal-edit-input');
        if (!editInput) return;
        
        const newTitle = editInput.value.trim();
        
        // Validation
        if (!newTitle) {
            this.showMotivationalMessage('⚠️ Mission title cannot be empty!');
            editInput.focus();
            return;
        }
        
        // Find and update the goal
        const goal = this.goals.find(g => g.id === goalId);
        if (goal) {
            goal.title = newTitle;
            goal.lastEdited = new Date().toISOString();
            
            // Re-categorize with new title
            if (this.categorizer) {
                try {
                    const result = await this.categorizer.categorizeTodo(newTitle);
                    goal.category = result.category;
                } catch (error) {
                    console.log('Re-categorization failed:', error);
                }
            }
            
            // Save and re-render
            this.saveData();
            this.render();
        }
    }
    
    cancelGoalEdit(goalId) {
        const goalItem = document.querySelector(`[data-goal-id="${goalId}"]`);
        if (goalItem) {
            goalItem.classList.remove('editing');
            
            // Reset input value to original
            const goal = this.goals.find(g => g.id === goalId);
            if (goal) {
                const editInput = goalItem.querySelector('.goal-edit-input');
                if (editInput) {
                    editInput.value = goal.title;
                }
            }
        }
    }
    
    triggerCoinCelebration() {
        const celebrationContainer = document.getElementById('coinCelebration');
        if (!celebrationContainer) return;
        
        // Clear any existing coins
        celebrationContainer.innerHTML = '';
        
        // Create multiple coins
        const coinCount = 8;
        for (let i = 0; i < coinCount; i++) {
            setTimeout(() => {
                const coin = document.createElement('div');
                coin.className = 'gold-coin';
                coin.style.left = Math.random() * window.innerWidth + 'px';
                coin.innerHTML = `
                    <svg viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" fill="#FFD700" stroke="#FFA500" stroke-width="1"/>
                        <circle cx="12" cy="12" r="8" fill="none" stroke="#FFA500" stroke-width="0.5"/>
                        <text x="12" y="16" text-anchor="middle" fill="#FFA500" font-size="12" font-weight="bold">$</text>
                    </svg>
                `;
                celebrationContainer.appendChild(coin);
                
                // Remove coin after animation
                setTimeout(() => {
                    coin.remove();
                }, 2000);
            }, i * 100);
        }
    }
}

// Initialize the Todo Manager when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new TodoManager();
});
