// Todo Manager JavaScript - Simplified Goals Only Version
class TodoManager {
    constructor() {
        this.goals = [];
        this.init();
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.render();
        this.updateProgress();
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
            // Ensure all goals have a completed property
            this.goals.forEach(goal => {
                if (goal.completed === undefined) {
                    goal.completed = false;
                }
            });
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

    addGoal() {
        const input = document.getElementById('goalInput');
        if (!input) return;
        
        const title = input.value.trim();
        if (!title) return;

        const newGoal = {
            id: this.generateId(),
            title: title,
            completed: false,
            createdAt: new Date().toISOString()
        };

        this.goals.push(newGoal);
        this.saveData();
        this.render();
        this.updateProgress();
        
        input.value = '';
    }

    async toggleGoal(goalId) {
        const goal = this.goals.find(g => g.id === goalId);
        if (!goal) return;

        goal.completed = !goal.completed;
        if (goal.completed) {
            goal.completedAt = new Date().toISOString();
            this.showMotivationalMessage(this.getCompletionMessage(goal));
            
            // Award 5 XP for completing a mission (to match popup.js)
            await this.awardXP(5);
            
            // Notify Tamagotchi pet about mission completion
            if (chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({
                    action: 'missionCompleted',
                    missionData: {
                        goalTitle: goal.title
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
            this.saveData();
            this.render();
            this.updateProgress();
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
            this.showMotivationalMessage('No completed missions to clear.');
            return;
        }
        
        if (confirm(`Clear ${completedCount} completed mission${completedCount > 1 ? 's' : ''}?`)) {
            this.goals = this.goals.filter(g => !g.completed);
            this.saveData();
            this.render();
            this.updateProgress();
            this.showMotivationalMessage('🧹 Completed missions cleared! Ready for new objectives.');
        }
    }

    getCompletionMessage(goal) {
        const messages = [
            `✅ Mission "${goal.title}" complete!`,
            `🎉 Objective achieved: "${goal.title}"!`,
            `💪 Well done! "${goal.title}" is done!`,
            `🚀 Success! "${goal.title}" accomplished!`,
            `⭐ Excellent! "${goal.title}" completed!`
        ];
        
        return messages[Math.floor(Math.random() * messages.length)];
    }

    showMotivationalMessage(message) {
        const messageElement = document.getElementById('motivationalMessage');
        if (!messageElement) return;
        
        messageElement.textContent = message;
        messageElement.classList.add('show');
        
        setTimeout(() => {
            messageElement.classList.remove('show');
        }, 5000);
    }

    render() {
        const goalsList = document.getElementById('goalsList');
        if (!goalsList) return;
        
        if (this.goals.length === 0) {
            goalsList.innerHTML = `
                <div class="empty-state">
                    <h3>No missions yet</h3>
                    <p>Deploy your first mission objective above!</p>
                </div>
            `;
            return;
        }

        goalsList.innerHTML = '';
        this.goals.forEach(goal => {
            this.renderGoal(goal);
        });
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
        
        const titleEl = goalElement.querySelector('.goal-title');
        if (titleEl) {
            titleEl.textContent = goal.title;
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
        
        this.showMotivationalMessage('📝 Editing mission... Press Enter to save, Escape to cancel.');
    }
    
    saveGoalEdit(goalId) {
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
            
            // Save and re-render
            this.saveData();
            this.render();
            this.showMotivationalMessage('✅ Mission updated successfully!');
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
        
        this.showMotivationalMessage('❌ Edit cancelled. Mission unchanged.');
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
