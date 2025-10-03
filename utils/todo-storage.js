// Todo Storage Utility
class TodoStorage {
    constructor() {
        this.storageKey = 'todoManagerData';
        this.analyticsKey = 'todoAnalytics';
    }

    // Load todos from Chrome storage
    async loadTodos() {
        return new Promise((resolve) => {
            if (chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.get([this.storageKey], (result) => {
                    if (result[this.storageKey]) {
                        resolve(result[this.storageKey]);
                    } else {
                        // Fallback to localStorage
                        const localData = localStorage.getItem(this.storageKey);
                        resolve(localData ? JSON.parse(localData) : this.getDefaultData());
                    }
                });
            } else {
                // Fallback for non-extension environment
                const localData = localStorage.getItem(this.storageKey);
                resolve(localData ? JSON.parse(localData) : this.getDefaultData());
            }
        });
    }

    // Save todos to Chrome storage
    async saveTodos(data) {
        const saveData = {
            ...data,
            lastUpdated: new Date().toISOString()
        };

        // Save to localStorage for immediate access
        localStorage.setItem(this.storageKey, JSON.stringify(saveData));

        // Save to Chrome storage for sync
        if (chrome.storage && chrome.storage.sync) {
            return new Promise((resolve) => {
                chrome.storage.sync.set({ [this.storageKey]: saveData }, () => {
                    resolve(saveData);
                });
            });
        }

        return Promise.resolve(saveData);
    }

    // Get default data structure
    getDefaultData() {
        return {
            goals: [],
            settings: {
                enableNotifications: true,
                enableAutoTracking: true,
                dailyReminderTime: '09:00'
            },
            stats: {
                totalGoalsCreated: 0,
                totalTodosCompleted: 0,
                totalTimeTracked: 0
            }
        };
    }

    // Save analytics data
    async saveAnalytics(analyticsData) {
        const data = {
            ...analyticsData,
            timestamp: new Date().toISOString()
        };

        if (chrome.storage && chrome.storage.local) {
            return new Promise((resolve) => {
                chrome.storage.local.get([this.analyticsKey], (result) => {
                    const existing = result[this.analyticsKey] || { sessions: [] };
                    existing.sessions.push(data);
                    
                    // Keep only last 30 days of data
                    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
                    existing.sessions = existing.sessions.filter(s => 
                        new Date(s.timestamp).getTime() > thirtyDaysAgo
                    );

                    chrome.storage.local.set({ [this.analyticsKey]: existing }, () => {
                        resolve(existing);
                    });
                });
            });
        }

        return Promise.resolve(data);
    }

    // Get analytics data
    async getAnalytics() {
        return new Promise((resolve) => {
            if (chrome.storage && chrome.storage.local) {
                chrome.storage.local.get([this.analyticsKey], (result) => {
                    resolve(result[this.analyticsKey] || { sessions: [] });
                });
            } else {
                resolve({ sessions: [] });
            }
        });
    }

    // Export data as JSON
    async exportData() {
        const todos = await this.loadTodos();
        const analytics = await this.getAnalytics();
        
        return {
            todos,
            analytics,
            exportedAt: new Date().toISOString(),
            version: '1.0.0'
        };
    }

    // Import data from JSON
    async importData(jsonData) {
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            
            if (data.todos) {
                await this.saveTodos(data.todos);
            }
            
            if (data.analytics && chrome.storage && chrome.storage.local) {
                await new Promise((resolve) => {
                    chrome.storage.local.set({ [this.analyticsKey]: data.analytics }, resolve);
                });
            }
            
            return { success: true, message: 'Data imported successfully' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    // Clear all data
    async clearAllData() {
        localStorage.removeItem(this.storageKey);
        localStorage.removeItem('lastActivityDate');
        localStorage.removeItem('streak');
        
        if (chrome.storage) {
            return new Promise((resolve) => {
                chrome.storage.sync.remove([this.storageKey], () => {
                    chrome.storage.local.remove([this.analyticsKey], () => {
                        resolve({ success: true });
                    });
                });
            });
        }
        
        return Promise.resolve({ success: true });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TodoStorage;
}
