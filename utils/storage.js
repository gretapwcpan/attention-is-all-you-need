// Storage Manager - Centralized data persistence for analytics

export default class StorageManager {
  constructor() {
    this.cache = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Check if storage is initialized
      const existing = await this.get('initialized');
      if (!existing) {
        await this.set('initialized', true);
        await this.set('version', '2.0.0');
        await this.initializeDefaultSettings();
        await this.initializeTodayData();
      }
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Storage initialization error:', error);
      return false;
    }
  }

  async initializeDefaultSettings() {
    const defaultSettings = {
      trackingEnabled: true,
      notificationsEnabled: true,
      darkMode: 'auto', // 'auto', 'light', 'dark'
      focusThreshold: 10, // minutes for deep focus
      breakReminder: 60, // minutes between break reminders
      dailyGoal: 240, // minutes of productive browsing
      privacyMode: false,
      dataRetentionDays: 30,
      exportFormat: 'json' // 'json' or 'csv'
    };
    
    await this.set('settings', defaultSettings);
    return defaultSettings;
  }

  async initializeTodayData() {
    const today = new Date().toDateString();
    const analyticsKey = `analytics_${today}`;
    
    const defaultAnalytics = {
      date: today,
      totalTime: 0,
      deepFocusTime: 0,
      activeReadingTime: 0,
      scanningTime: 0,
      categories: {},
      uniqueSites: [],
      topics: [],
      sessions: []
    };
    
    await this.set(analyticsKey, defaultAnalytics);
    return defaultAnalytics;
  }

  async get(key) {
    try {
      // Check cache first
      if (this.cache.has(key)) {
        return this.cache.get(key);
      }
      
      const result = await chrome.storage.local.get([key]);
      const value = result[key];
      
      // Update cache
      if (value !== undefined) {
        this.cache.set(key, value);
      }
      
      return value;
    } catch (error) {
      console.error(`Storage get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key, value) {
    try {
      await chrome.storage.local.set({ [key]: value });
      
      // Update cache
      this.cache.set(key, value);
      
      return true;
    } catch (error) {
      console.error(`Storage set error for key ${key}:`, error);
      return false;
    }
  }

  async remove(key) {
    try {
      await chrome.storage.local.remove(key);
      
      // Remove from cache
      this.cache.delete(key);
      
      return true;
    } catch (error) {
      console.error(`Storage remove error for key ${key}:`, error);
      return false;
    }
  }

  async getAll() {
    try {
      const data = await chrome.storage.local.get(null);
      return data;
    } catch (error) {
      console.error('Storage getAll error:', error);
      return {};
    }
  }

  async clear() {
    try {
      await chrome.storage.local.clear();
      this.cache.clear();
      
      // Re-initialize with defaults
      await this.initialize();
      
      return true;
    } catch (error) {
      console.error('Storage clear error:', error);
      return false;
    }
  }

  async addSession(session) {
    const today = new Date().toDateString();
    const sessionsKey = `sessions_${today}`;
    
    try {
      const sessions = await this.get(sessionsKey) || [];
      
      // Add session with timestamp
      sessions.push({
        ...session,
        id: `session_${Date.now()}`,
        timestamp: Date.now()
      });
      
      // Keep only last 200 sessions per day
      if (sessions.length > 200) {
        sessions.splice(0, sessions.length - 200);
      }
      
      await this.set(sessionsKey, sessions);
      
      // Update analytics
      await this.updateAnalytics(session);
      
      return session;
    } catch (error) {
      console.error('Error adding session:', error);
      return null;
    }
  }

  async updateAnalytics(session) {
    const today = new Date().toDateString();
    const analyticsKey = `analytics_${today}`;
    
    try {
      const analytics = await this.get(analyticsKey) || this.getDefaultAnalytics(today);
      
      // Update total time
      analytics.totalTime += session.duration || 0;
      
      // Update focus type times
      switch (session.focusType) {
        case 'deep':
          analytics.deepFocusTime += session.duration || 0;
          break;
        case 'active':
          analytics.activeReadingTime += session.duration || 0;
          break;
        case 'scanning':
          analytics.scanningTime += session.duration || 0;
          break;
      }
      
      // Update categories
      const category = session.category || 'Uncategorized';
      if (!analytics.categories[category]) {
        analytics.categories[category] = 0;
      }
      analytics.categories[category] += session.duration || 0;
      
      // Update unique sites
      if (session.domain && !analytics.uniqueSites.includes(session.domain)) {
        analytics.uniqueSites.push(session.domain);
      }
      
      // Update topics
      if (session.topics && Array.isArray(session.topics)) {
        session.topics.forEach(topic => {
          if (!analytics.topics.includes(topic)) {
            analytics.topics.push(topic);
          }
        });
      }
      
      // Add session summary
      analytics.sessions.push({
        title: session.title,
        domain: session.domain,
        category: session.category,
        duration: session.duration,
        focusType: session.focusType,
        timestamp: session.timestamp || Date.now()
      });
      
      await this.set(analyticsKey, analytics);
      
      return analytics;
    } catch (error) {
      console.error('Error updating analytics:', error);
      return null;
    }
  }

  getDefaultAnalytics(date) {
    return {
      date: date,
      totalTime: 0,
      deepFocusTime: 0,
      activeReadingTime: 0,
      scanningTime: 0,
      categories: {},
      uniqueSites: [],
      topics: [],
      sessions: []
    };
  }

  async getSessions(date) {
    const dateString = date instanceof Date ? date.toDateString() : date;
    const sessionsKey = `sessions_${dateString}`;
    
    try {
      const sessions = await this.get(sessionsKey) || [];
      return sessions;
    } catch (error) {
      console.error('Error getting sessions:', error);
      return [];
    }
  }

  async getAnalytics(date) {
    const dateString = date instanceof Date ? date.toDateString() : date;
    const analyticsKey = `analytics_${dateString}`;
    
    try {
      const analytics = await this.get(analyticsKey);
      return analytics || this.getDefaultAnalytics(dateString);
    } catch (error) {
      console.error('Error getting analytics:', error);
      return this.getDefaultAnalytics(dateString);
    }
  }

  async updateSettings(updates) {
    try {
      const currentSettings = await this.get('settings') || {};
      const newSettings = { ...currentSettings, ...updates };
      await this.set('settings', newSettings);
      return newSettings;
    } catch (error) {
      console.error('Error updating settings:', error);
      return null;
    }
  }

  async getSettings() {
    try {
      const settings = await this.get('settings');
      return settings || await this.initializeDefaultSettings();
    } catch (error) {
      console.error('Error getting settings:', error);
      return await this.initializeDefaultSettings();
    }
  }

  async getStorageUsage() {
    try {
      if (chrome.storage.local.getBytesInUse) {
        const bytesInUse = await chrome.storage.local.getBytesInUse();
        const maxBytes = chrome.storage.local.QUOTA_BYTES || 5242880; // 5MB default
        
        return {
          used: bytesInUse,
          total: maxBytes,
          percentage: Math.round((bytesInUse / maxBytes) * 100)
        };
      }
      
      // Fallback: estimate based on stored data
      const allData = await this.getAll();
      const dataString = JSON.stringify(allData);
      const bytes = new Blob([dataString]).size;
      
      return {
        used: bytes,
        total: 5242880,
        percentage: Math.round((bytes / 5242880) * 100)
      };
    } catch (error) {
      console.error('Error getting storage usage:', error);
      return { used: 0, total: 5242880, percentage: 0 };
    }
  }

  async exportData() {
    try {
      const allData = await this.getAll();
      
      // Filter out system keys
      const exportData = {};
      Object.keys(allData).forEach(key => {
        if (key.startsWith('sessions_') || 
            key.startsWith('analytics_') || 
            key === 'settings') {
          exportData[key] = allData[key];
        }
      });
      
      return {
        version: '2.0.0',
        exportDate: new Date().toISOString(),
        data: exportData
      };
    } catch (error) {
      console.error('Error exporting data:', error);
      return null;
    }
  }

  async importData(jsonString) {
    try {
      const importData = JSON.parse(jsonString);
      
      if (!importData.version || !importData.data) {
        throw new Error('Invalid import format');
      }
      
      // Clear existing data
      await this.clear();
      
      // Import new data
      for (const [key, value] of Object.entries(importData.data)) {
        await this.set(key, value);
      }
      
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }

  async getWeeklySummary() {
    const summary = {
      days: [],
      totalTime: 0,
      totalSessions: 0,
      averageDailyTime: 0,
      topCategories: {},
      topDomains: {},
      focusDistribution: {
        deep: 0,
        active: 0,
        scanning: 0
      }
    };
    
    try {
      // Get last 7 days of data
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateString = date.toDateString();
        
        const analytics = await this.getAnalytics(dateString);
        if (analytics && analytics.totalTime > 0) {
          summary.days.push({
            date: dateString,
            totalTime: analytics.totalTime,
            sessionCount: analytics.sessions.length,
            focusScore: this.calculateFocusScore(analytics)
          });
          
          // Aggregate totals
          summary.totalTime += analytics.totalTime;
          summary.totalSessions += analytics.sessions.length;
          
          // Aggregate focus distribution
          summary.focusDistribution.deep += analytics.deepFocusTime;
          summary.focusDistribution.active += analytics.activeReadingTime;
          summary.focusDistribution.scanning += analytics.scanningTime;
          
          // Aggregate categories
          Object.entries(analytics.categories).forEach(([category, time]) => {
            summary.topCategories[category] = (summary.topCategories[category] || 0) + time;
          });
          
          // Aggregate domains
          analytics.uniqueSites.forEach(domain => {
            summary.topDomains[domain] = (summary.topDomains[domain] || 0) + 1;
          });
        }
      }
      
      // Calculate averages
      if (summary.days.length > 0) {
        summary.averageDailyTime = Math.round(summary.totalTime / summary.days.length);
      }
      
      // Sort and limit top items
      summary.topCategories = Object.entries(summary.topCategories)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {});
      
      summary.topDomains = Object.entries(summary.topDomains)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([domain, count]) => ({ domain, count }));
      
      return summary;
    } catch (error) {
      console.error('Error getting weekly summary:', error);
      return summary;
    }
  }

  calculateFocusScore(analytics) {
    if (!analytics || analytics.totalTime === 0) return 0;
    
    const deepWeight = 1.0;
    const activeWeight = 0.7;
    const scanningWeight = 0.3;
    
    const weightedTime = 
      (analytics.deepFocusTime * deepWeight) +
      (analytics.activeReadingTime * activeWeight) +
      (analytics.scanningTime * scanningWeight);
    
    return Math.round((weightedTime / analytics.totalTime) * 100);
  }

  async cleanupOldData() {
    try {
      const settings = await this.getSettings();
      const retentionDays = settings.dataRetentionDays || 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      const allKeys = Object.keys(await this.getAll());
      const keysToRemove = [];
      
      allKeys.forEach(key => {
        if (key.startsWith('sessions_') || key.startsWith('analytics_')) {
          const dateString = key.split('_')[1];
          const keyDate = new Date(dateString);
          
          if (keyDate < cutoffDate) {
            keysToRemove.push(key);
          }
        }
      });
      
      if (keysToRemove.length > 0) {
        for (const key of keysToRemove) {
          await this.remove(key);
        }
        console.log(`Cleaned up ${keysToRemove.length} old data entries`);
      }
      
      return keysToRemove.length;
    } catch (error) {
      console.error('Error cleaning up old data:', error);
      return 0;
    }
  }
}
