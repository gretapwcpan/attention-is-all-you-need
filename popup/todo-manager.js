// Todo Manager JavaScript
class TodoManager {
    constructor() {
        this.goals = [];
        this.activeTimers = {};
        this.init();
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.render();
        this.updateProgress();
        this.showMotivationalMessage();
    }

    setupEventListeners() {
        // Add goal button
        document.getElementById('addGoalBtn').addEventListener('click', () => this.addGoal());
        document.getElementById('newGoalInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addGoal();
        });

        // Footer buttons
        document.getElementById('viewAnalyticsBtn').addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('analytics/analytics.html') });
        });

        document.getElementById('clearCompletedBtn').addEventListener('click', () => {
            this.clearCompleted();
        });
    }

    loadData() {
        const savedData = localStorage.getItem('todoManagerData');
        if (savedData) {
            const data = JSON.parse(savedData);
            this.goals = data.goals || [];
        } else {
            // Initialize with sample data for first-time users
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
        const input = document.getElementById('newGoalInput');
        const title = input.value.trim();
        
        if (!title) return;

        const newGoal = {
            id: this.generateId(),
            title: title,
            todos: [],
            createdAt: new Date().toISOString(),
            progress: 0
        };

        this.goals.push(newGoal);
        this.saveData();
        this.render();
        this.updateProgress();
        
        input.value = '';
        this.showMotivationalMessage('🎯 New goal added! Let\'s break it down into actionable todos.');
    }

    deleteGoal(goalId) {
        if (confirm('Are you sure you want to delete this goal and all its todos?')) {
            this.goals = this.goals.filter(g => g.id !== goalId);
            this.saveData();
            this.render();
            this.updateProgress();
        }
    }

    addTodo(goalId) {
        const goal = this.goals.find(g => g.id === goalId);
        if (!goal) return;

        const goalElement = document.querySelector(`[data-goal-id="${goalId}"]`);
        const titleInput = goalElement.querySelector('.new-todo-input');
        const timeInput = goalElement.querySelector('.todo-time-estimate');
        
        const title = titleInput.value.trim();
        const estimatedTime = parseInt(timeInput.value) || 30; // Default 30 minutes
        
        if (!title) return;

        const newTodo = {
            id: this.generateId(),
            title: title,
            estimatedTime: estimatedTime,
            actualTime: 0,
            completed: false,
            createdAt: new Date().toISOString(),
            sessions: []
        };

        goal.todos.push(newTodo);
        this.saveData();
        this.renderGoal(goal);
        this.updateGoalProgress(goal);
        
        titleInput.value = '';
        timeInput.value = '';
    }

    toggleTodo(goalId, todoId) {
        const goal = this.goals.find(g => g.id === goalId);
        if (!goal) return;
        
        const todo = goal.todos.find(t => t.id === todoId);
        if (!todo) return;

        todo.completed = !todo.completed;
        if (todo.completed) {
            todo.completedAt = new Date().toISOString();
            this.showMotivationalMessage(this.getCompletionMessage(goal, todo));
            
            // Notify Tamagotchi pet about mission completion
            chrome.runtime.sendMessage({
                action: 'missionCompleted',
                missionData: {
                    goalTitle: goal.title,
                    todoTitle: todo.title,
                    estimatedTime: todo.estimatedTime,
                    actualTime: todo.actualTime
                }
            });
            
            // Also update pet in popup if it's open
            chrome.runtime.sendMessage({
                action: 'updateTamagotchi',
                type: 'missionComplete'
            });
        }
        
        this.saveData();
        this.renderGoal(goal);
        this.updateGoalProgress(goal);
        this.updateProgress();
    }

    deleteTodo(goalId, todoId) {
        const goal = this.goals.find(g => g.id === goalId);
        if (!goal) return;
        
        goal.todos = goal.todos.filter(t => t.id !== todoId);
        this.saveData();
        this.renderGoal(goal);
        this.updateGoalProgress(goal);
        this.updateProgress();
    }

    startTimer(goalId, todoId) {
        const timerId = `${goalId}-${todoId}`;
        
        if (this.activeTimers[timerId]) return;

        const startTime = Date.now();
        const todoElement = document.querySelector(`[data-todo-id="${todoId}"]`);
        const timerDisplay = todoElement.querySelector('.timer-display');
        const timerSection = todoElement.querySelector('.todo-timer');
        const startBtn = todoElement.querySelector('.start-timer');
        
        timerSection.style.display = 'flex';
        startBtn.style.display = 'none';

        this.activeTimers[timerId] = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);

        // Store timer start in todo sessions
        const goal = this.goals.find(g => g.id === goalId);
        const todo = goal.todos.find(t => t.id === todoId);
        todo.currentSession = { startTime: startTime };
    }

    stopTimer(goalId, todoId) {
        const timerId = `${goalId}-${todoId}`;
        
        if (!this.activeTimers[timerId]) return;

        clearInterval(this.activeTimers[timerId]);
        delete this.activeTimers[timerId];

        const goal = this.goals.find(g => g.id === goalId);
        const todo = goal.todos.find(t => t.id === todoId);
        
        if (todo.currentSession) {
            const sessionTime = Math.floor((Date.now() - todo.currentSession.startTime) / 1000 / 60); // in minutes
            todo.actualTime = (todo.actualTime || 0) + sessionTime;
            todo.sessions.push({
                startTime: todo.currentSession.startTime,
                endTime: Date.now(),
                duration: sessionTime
            });
            delete todo.currentSession;
        }

        this.saveData();
        this.renderGoal(goal);
        
        // Show progress message
        if (todo.actualTime >= todo.estimatedTime && !todo.completed) {
            this.showMotivationalMessage(`⏰ You've spent ${todo.actualTime} minutes on "${todo.title}". Time to mark it complete?`);
        }
    }

    updateGoalProgress(goal) {
        if (goal.todos.length === 0) {
            goal.progress = 0;
        } else {
            const completed = goal.todos.filter(t => t.completed).length;
            goal.progress = Math.round((completed / goal.todos.length) * 100);
        }
        this.saveData();
    }

    updateProgress() {
        let totalTodos = 0;
        let completedTodos = 0;
        
        this.goals.forEach(goal => {
            totalTodos += goal.todos.length;
            completedTodos += goal.todos.filter(t => t.completed).length;
        });

        const progress = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;
        document.getElementById('todayProgress').textContent = `${progress}%`;
        
        // Update streak (simplified version - tracks consecutive days with completions)
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
        
        document.getElementById('streak').textContent = `${streak} ${streak === 1 ? 'day' : 'days'}`;
    }

    clearCompleted() {
        this.goals.forEach(goal => {
            goal.todos = goal.todos.filter(t => !t.completed);
        });
        this.saveData();
        this.render();
        this.updateProgress();
        this.showMotivationalMessage('🧹 Completed todos cleared! Ready for new challenges.');
    }

    getCompletionMessage(goal, todo) {
        const messages = [
            `✅ Great job completing "${todo.title}"!`,
            `🎉 Another one done! You're making progress on "${goal.title}"!`,
            `💪 Keep it up! "${todo.title}" is complete!`,
            `🚀 You're on fire! "${todo.title}" checked off!`,
            `⭐ Excellent work on "${todo.title}"!`
        ];
        
        // Add special messages for milestones
        if (goal.progress === 100) {
            return `🏆 Incredible! You've completed all todos for "${goal.title}"!`;
        } else if (goal.progress >= 50 && goal.progress < 60) {
            return `📊 You're 50% done with "${goal.title}"! Halfway there!`;
        }
        
        return messages[Math.floor(Math.random() * messages.length)];
    }

    showMotivationalMessage(message) {
        const messageElement = document.getElementById('motivationalMessage');
        messageElement.textContent = message;
        messageElement.classList.add('show');
        
        setTimeout(() => {
            messageElement.classList.remove('show');
        }, 5000);
    }

    render() {
        const goalsList = document.getElementById('goalsList');
        
        if (this.goals.length === 0) {
            goalsList.innerHTML = `
                <div class="empty-state">
                    <h3>No goals yet</h3>
                    <p>Start by adding your first goal above!</p>
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
        const existingElement = document.querySelector(`[data-goal-id="${goal.id}"]`);
        
        const template = document.getElementById('goalTemplate');
        const goalElement = template.content.cloneNode(true);
        const goalItem = goalElement.querySelector('.goal-item');
        
        goalItem.dataset.goalId = goal.id;
        goalElement.querySelector('.goal-title').textContent = goal.title;
        goalElement.querySelector('.goal-progress').textContent = `${goal.progress}%`;
        
        // Setup goal header click to expand/collapse
        const header = goalElement.querySelector('.goal-header');
        const content = goalElement.querySelector('.goal-content');
        const expandIcon = goalElement.querySelector('.goal-expand-icon');
        
        header.addEventListener('click', (e) => {
            if (e.target.closest('.goal-actions')) return;
            
            const isExpanded = content.style.display !== 'none';
            content.style.display = isExpanded ? 'none' : 'block';
            expandIcon.classList.toggle('expanded', !isExpanded);
        });
        
        // Delete goal button
        goalElement.querySelector('.delete-goal').addEventListener('click', () => {
            this.deleteGoal(goal.id);
        });
        
        // Add todo button
        goalElement.querySelector('.btn-add-todo').addEventListener('click', () => {
            this.addTodo(goal.id);
        });
        
        // Add todo on Enter key
        const todoInput = goalElement.querySelector('.new-todo-input');
        todoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTodo(goal.id);
        });
        
        // Render todos
        const todosList = goalElement.querySelector('.todos-list');
        goal.todos.forEach(todo => {
            const todoElement = this.renderTodo(goal.id, todo);
            todosList.appendChild(todoElement);
        });
        
        if (existingElement) {
            existingElement.replaceWith(goalElement);
        } else {
            document.getElementById('goalsList').appendChild(goalElement);
        }
    }

    renderTodo(goalId, todo) {
        const template = document.getElementById('todoTemplate');
        const todoElement = template.content.cloneNode(true);
        const todoItem = todoElement.querySelector('.todo-item');
        
        todoItem.dataset.todoId = todo.id;
        if (todo.completed) {
            todoItem.classList.add('completed');
        }
        
        const checkbox = todoElement.querySelector('.todo-checkbox');
        checkbox.checked = todo.completed;
        checkbox.addEventListener('change', () => {
            this.toggleTodo(goalId, todo.id);
        });
        
        todoElement.querySelector('.todo-title').textContent = todo.title;
        todoElement.querySelector('.todo-time-estimate').textContent = `Est: ${todo.estimatedTime}m`;
        
        if (todo.actualTime > 0) {
            const actualTimeElement = todoElement.querySelector('.todo-time-actual');
            actualTimeElement.textContent = `Actual: ${todo.actualTime}m`;
            actualTimeElement.style.display = 'inline-block';
        }
        
        // Timer button
        const timerBtn = todoElement.querySelector('.start-timer');
        timerBtn.addEventListener('click', () => {
            this.startTimer(goalId, todo.id);
        });
        
        // Stop timer button
        todoElement.querySelector('.btn-stop-timer').addEventListener('click', () => {
            this.stopTimer(goalId, todo.id);
        });
        
        // Delete todo button
        todoElement.querySelector('.delete-todo').addEventListener('click', () => {
            this.deleteTodo(goalId, todo.id);
        });
        
        return todoElement;
    }
}

// Initialize the Todo Manager when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new TodoManager();
});
