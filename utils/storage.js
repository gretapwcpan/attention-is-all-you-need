// Storage Manager for Attention Analytics

export default class StorageManager {
  constructor() {
    this.storageKey = 'attentionAnalytics';
  }
  
  // Initialize storage with default structure
  async initialize() {
    const existing = await this.get('initialized');
    if (!existing) {
      await this.set('initialized', true);
      await this.set('version', '2.0.0');
      await this.set('settings', {
        trackingEnabled: true,
        notificationsEnabled: true,
        darkMode: false,
        focusThreshold: 10, // minutes for deep focus
        breakReminder: 60, // minutes between break reminders
        dailyGoal: 240 // minutes of productive time
      });
      
      // Initialize today's data
      const today = new Date().toDateString();
      await this.set(`analytics_${today}`, {
        date: today,
        totalTime: 0,
        deepFocusTime: 0,
        activeReadingTime: 0,
        scanningTime: 0,
        categories: {},
        uniqueSites: [],
        topics: [],
        sessions: []
      });
    }
  }
  
  // Get data from storage
  async get(key) {
    try {
      const result = await chrome.storage.local.get([key]);
      return result[key];
    } catch (error) {
      console.error('Storage get error:', error);
      return null;
    }
  }
  
  // Set data in storage
  async set(key, value) {
    try {
      await chrome.storage.local.set({ [key]: value });
      return true;
    } catch (error) {
      console.error('Storage set error:', error);
      return false;
    }
  }
  
  // Remove data from storage
  async remove(key) {
    try {
      await chrome.storage.local.remove(key);
      return true;
    } catch (error) {
      console.error('Storage remove error:', error);
      return false;
    }
  }
  
  // Get all storage data
  async getAll() {
    try {
      return await chrome.storage.local.get(null);
    } catch (error) {
      console.error('Storage getAll error:', error);
      return {};
    }
  }
  
  // Clear all storage
  async clear() {
    try {
      await chrome.storage.local.clear();
      return true;
    } catch (error) {
      console.error('Storage clear error:', error);
      return false;
    }
  }
  
  // Add a browsing session
  async addSession(session) {
    const today = new Date().toDateString();
    const sessionsKey = `sessions_${today}`;
    
    const sessions = await this.get(sessionsKey) || [];
    sessions.push(session);
    
    // Keep only last 100 sessions per day
    if (sessions.length > 100) {
      sessions.shift();
    }
    
    await this.set(sessionsKey, sessions);
  }
  
  // Get sessions for a date
  async getSessions(date) {
    const dateString = date instanceof Date ? date.toDateString() : date;
    return await this.get(`sessions_${dateString}`) || [];
  }
  
  // Get analytics for a date
  async getAnalytics(date) {
    const dateString = date instanceof Date ? date.toDateString() : date;
    return await this.get(`analytics_${dateString}`);
  }
  
  // Update settings
  async updateSettings(updates) {
    const settings = await this.get('settings') || {};
    const newSettings = { ...settings, ...updates };
    await this.set('settings', newSettings);
    return newSettings;
  }
  
  // Get settings
  async getSettings() {
    return await this.get('settings') || {
      trackingEnabled: true,
      notificationsEnabled: true,
      darkMode: false,
      focusThreshold: 10,
      breakReminder: 60,
      dailyGoal: 240
    };
  }
  
  // Get storage usage
  async getStorageUsage() {
    try {
      const bytesInUse = await chrome.storage.local.getBytesInUse();
      const quota = chrome.storage.local.QUOTA_BYTES;
      return {
        used: bytesInUse,
        total: quota,
        percentage: (bytesInUse / quota) * 100
      };
    } catch (error) {
      console.error('Storage usage error:', error);
      return { used: 0, total: 0, percentage: 0 };
    }
  }
  
  // Export data as JSON
  async exportData() {
    const allData = await this.getAll();
    const exportData = {
      version: '2.0.0',
      exportDate: new Date().toISOString(),
      data: allData
    };
    return JSON.stringify(exportData, null, 2);
  }
  
  // Import data from JSON
  async importData(jsonString) {
    try {
      const importData = JSON.parse(jsonString);
      if (importData.version && importData.data) {
        // Clear existing data
        await this.clear();
        
        // Import new data
        for (const [key, value] of Object.entries(importData.data)) {
          await this.set(key, value);
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Import error:', error);
      return false;
    }
  }
  
  // Get weekly summary
  async getWeeklySummary() {
    const summary = {
      totalTime: 0,
      deepFocusTime: 0,
      activeReadingTime: 0,
      scanningTime: 0,
      topCategories: {},
      uniqueSites: new Set(),
      topics: new Set(),
      dailyAverages: {}
    };
    
    const today = new Date();
    let daysWithData = 0;
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateString = date.toDateString();
      
      const dayData = await this.get(`analytics_${dateString}`);
      if (dayData) {
        daysWithData++;
        summary.totalTime += dayData.totalTime || 0;
        summary.deepFocusTime += dayData.deepFocusTime || 0;
        summary.activeReadingTime += dayData.activeReadingTime || 0;
        summary.scanningTime += dayData.scanningTime || 0;
        
        // Aggregate categories
        Object.entries(dayData.categories || {}).forEach(([category, time]) => {
          summary.topCategories[category] = (summary.topCategories[category] || 0) + time;
        });
        
        // Collect unique sites and topics
        (dayData.uniqueSites || []).forEach(site => summary.uniqueSites.add(site));
        (dayData.topics || []).forEach(topic => summary.topics.add(topic));
      }
    }
    
    // Calculate daily averages
    if (daysWithData > 0) {
      summary.dailyAverages = {
        totalTime: summary.totalTime / daysWithData,
        deepFocusTime: summary.deepFocusTime / daysWithData,
        activeReadingTime: summary.activeReadingTime / daysWithData,
        scanningTime: summary.scanningTime / daysWithData
      };
    }
    
    return summary;
  }
}
