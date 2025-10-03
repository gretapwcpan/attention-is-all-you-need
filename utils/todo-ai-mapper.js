// Todo AI Mapper - Maps browsing content to todos
class TodoAIMapper {
    constructor() {
        this.todoStorage = new TodoStorage();
        this.currentGoals = [];
        this.activeTodo = null;
        this.mappingEnabled = true;
        this.init();
    }

    async init() {
        // Load todos and start monitoring
        await this.loadTodos();
        this.startMonitoring();
    }

    async loadTodos() {
        const data = await this.todoStorage.loadTodos();
        this.currentGoals = data.goals || [];
    }

    // Extract keywords from todos for matching
    extractKeywords(text) {
        if (!text) return [];
        
        // Remove common words and extract meaningful keywords
        const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were']);
        
        return text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !commonWords.has(word));
    }

    // Find matching todos based on page content
    findMatchingTodos(pageData) {
        const matches = [];
        const pageKeywords = new Set([
            ...this.extractKeywords(pageData.title),
            ...this.extractKeywords(pageData.url),
            ...this.extractKeywords(pageData.content)
        ]);

        this.currentGoals.forEach(goal => {
            goal.todos.forEach(todo => {
                if (todo.completed) return;

                // Extract keywords from todo
                const todoKeywords = [
                    ...this.extractKeywords(todo.title),
                    ...(todo.relatedKeywords || [])
                ];

                // Calculate match score
                const matchScore = todoKeywords.filter(keyword => 
                    pageKeywords.has(keyword.toLowerCase())
                ).length;

                if (matchScore > 0) {
                    matches.push({
                        goal: goal,
                        todo: todo,
                        score: matchScore,
                        confidence: this.calculateConfidence(matchScore, todoKeywords.length)
                    });
                }
            });
        });

        // Sort by score and return top matches
        return matches.sort((a, b) => b.score - a.score);
    }

    calculateConfidence(matchScore, totalKeywords) {
        if (totalKeywords === 0) return 0;
        const ratio = matchScore / totalKeywords;
        
        if (ratio >= 0.7) return 'high';
        if (ratio >= 0.4) return 'medium';
        return 'low';
    }

    // Start monitoring browsing activity
    startMonitoring() {
        // Listen for messages from content script
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'pageContent') {
                this.handlePageContent(request.data, sender.tab);
                sendResponse({ success: true });
            }
        });
    }

    // Handle page content and map to todos
    async handlePageContent(pageData, tab) {
        if (!this.mappingEnabled) return;

        // Reload todos to get latest data
        await this.loadTodos();

        // Find matching todos
        const matches = this.findMatchingTodos(pageData);

        if (matches.length > 0) {
            const topMatch = matches[0];
            
            // Only process high and medium confidence matches
            if (topMatch.confidence !== 'low') {
                await this.trackTodoActivity(topMatch, tab);
            }
        }
    }

    // Track activity for a matched todo
    async trackTodoActivity(match, tab) {
        const { goal, todo } = match;
        
        // Check if this is a new active todo
        if (!this.activeTodo || this.activeTodo.id !== todo.id) {
            this.activeTodo = todo;
            
            // Start a new session for this todo
            const session = {
                todoId: todo.id,
                goalId: goal.id,
                startTime: Date.now(),
                tabId: tab.id,
                url: tab.url,
                title: tab.title
            };

            // Store session
            await this.storeSession(session);

            // Show notification if enabled
            if (match.confidence === 'high') {
                this.showNotification(goal, todo);
            }
        }

        // Update time tracking
        await this.updateTimeTracking(todo.id);
    }

    // Store browsing session related to todo
    async storeSession(session) {
        const sessions = await chrome.storage.local.get('todoSessions');
        const allSessions = sessions.todoSessions || [];
        allSessions.push(session);
        
        // Keep only last 100 sessions
        if (allSessions.length > 100) {
            allSessions.shift();
        }

        await chrome.storage.local.set({ todoSessions: allSessions });
    }

    // Update time tracking for active todo
    async updateTimeTracking(todoId) {
        const data = await this.todoStorage.loadTodos();
        
        data.goals.forEach(goal => {
            const todo = goal.todos.find(t => t.id === todoId);
            if (todo) {
                // Increment actual time by 1 minute (called periodically)
                todo.actualTime = (todo.actualTime || 0) + 1;
                
                // Add to current browsing session
                if (!todo.browsingSessions) {
                    todo.browsingSessions = [];
                }
                
                const lastSession = todo.browsingSessions[todo.browsingSessions.length - 1];
                if (lastSession && (Date.now() - lastSession.endTime) < 300000) { // Within 5 minutes
                    lastSession.endTime = Date.now();
                } else {
                    todo.browsingSessions.push({
                        startTime: Date.now(),
                        endTime: Date.now()
                    });
                }
            }
        });

        await this.todoStorage.saveTodos(data);
    }

    // Show notification when working on a todo
    showNotification(goal, todo) {
        const notificationId = `todo-${todo.id}`;
        
        chrome.notifications.create(notificationId, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon128.png'),
            title: '🎯 Working on Todo',
            message: `Detected: "${todo.title}" from goal "${goal.title}"`,
            buttons: [
                { title: 'Mark Complete' },
                { title: 'View Progress' }
            ],
            priority: 1
        });

        // Handle notification button clicks
        chrome.notifications.onButtonClicked.addListener((notifId, buttonIndex) => {
            if (notifId === notificationId) {
                if (buttonIndex === 0) {
                    // Mark todo as complete
                    this.markTodoComplete(goal.id, todo.id);
                } else if (buttonIndex === 1) {
                    // Open todo manager
                    chrome.tabs.create({ 
                        url: chrome.runtime.getURL('popup/todo-manager.html') 
                    });
                }
            }
        });
    }

    // Mark a todo as complete
    async markTodoComplete(goalId, todoId) {
        const data = await this.todoStorage.loadTodos();
        
        data.goals.forEach(goal => {
            if (goal.id === goalId) {
                const todo = goal.todos.find(t => t.id === todoId);
                if (todo) {
                    todo.completed = true;
                    todo.completedAt = new Date().toISOString();
                }
            }
        });

        await this.todoStorage.saveTodos(data);
        
        // Show completion notification
        chrome.notifications.create({
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon128.png'),
            title: '✅ Todo Completed!',
            message: 'Great job! Keep up the momentum.',
            priority: 2
        });
    }

    // Get progress summary for popup
    async getProgressSummary() {
        const data = await this.todoStorage.loadTodos();
        let totalTodos = 0;
        let completedTodos = 0;
        let totalTimeEstimated = 0;
        let totalTimeActual = 0;

        data.goals.forEach(goal => {
            goal.todos.forEach(todo => {
                totalTodos++;
                if (todo.completed) completedTodos++;
                totalTimeEstimated += todo.estimatedTime || 0;
                totalTimeActual += todo.actualTime || 0;
            });
        });

        return {
            totalTodos,
            completedTodos,
            progress: totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0,
            totalTimeEstimated,
            totalTimeActual,
            efficiency: totalTimeEstimated > 0 ? Math.round((totalTimeActual / totalTimeEstimated) * 100) : 100
        };
    }

    // Suggest todos based on current browsing
    async suggestRelevantTodos(url, title) {
        await this.loadTodos();
        
        const pageData = {
            url: url,
            title: title,
            content: '' // Content will be filled by content script
        };

        const matches = this.findMatchingTodos(pageData);
        
        // Return top 3 relevant todos
        return matches.slice(0, 3).map(match => ({
            goal: match.goal.title,
            todo: match.todo.title,
            confidence: match.confidence,
            estimatedTime: match.todo.estimatedTime,
            actualTime: match.todo.actualTime || 0
        }));
    }
}

// Export for use in service worker
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TodoAIMapper;
}
