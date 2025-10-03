// Browsing Tracker - Core analytics functionality

export class BrowsingTracker {
  constructor() {
    this.sessions = [];
    this.domainStats = new Map();
  }

  async addSession(sessionData) {
    // Add session to today's data
    const today = new Date().toDateString();
    const sessionsKey = `sessions_${today}`;
    
    try {
      const result = await chrome.storage.local.get([sessionsKey]);
      const sessions = result[sessionsKey] || [];
      
      // Add new session
      sessions.push({
        ...sessionData,
        id: Date.now().toString(),
        timestamp: Date.now()
      });
      
      // Keep only last 100 sessions per day
      if (sessions.length > 100) {
        sessions.shift();
      }
      
      await chrome.storage.local.set({ [sessionsKey]: sessions });
      
      // Update domain stats
      this.updateDomainStats(sessionData);
      
      return sessionData;
    } catch (error) {
      console.error('Error adding session:', error);
      return null;
    }
  }

  async getTodaysBrowsingData() {
    const today = new Date().toDateString();
    const sessionsKey = `sessions_${today}`;
    
    try {
      const result = await chrome.storage.local.get([sessionsKey]);
      const sessions = result[sessionsKey] || [];
      
      // Calculate daily stats
      const stats = this.calculateDailyStats(sessions);
      
      // Generate daily summary
      const summary = this.generateDailySummary(sessions, stats);
      
      return {
        sessions,
        stats,
        summary
      };
    } catch (error) {
      console.error('Error getting today\'s data:', error);
      return {
        sessions: [],
        stats: {},
        summary: {}
      };
    }
  }

  calculateDailyStats(sessions) {
    const stats = {
      totalSessions: sessions.length,
      totalTime: 0,
      deepFocusSessions: 0,
      activeReadingSessions: 0,
      scanningSessions: 0,
      averageSessionDuration: 0,
      categoryCounts: {},
      domainCounts: {},
      peakHour: null,
      longestSession: null
    };
    
    if (sessions.length === 0) return stats;
    
    let longestDuration = 0;
    const hourCounts = new Array(24).fill(0);
    
    sessions.forEach(session => {
      // Total time
      stats.totalTime += session.duration || 0;
      
      // Focus type counts
      if (session.focusType === 'deep') stats.deepFocusSessions++;
      else if (session.focusType === 'active') stats.activeReadingSessions++;
      else if (session.focusType === 'scanning') stats.scanningSessions++;
      
      // Category counts
      const category = session.category || 'Uncategorized';
      stats.categoryCounts[category] = (stats.categoryCounts[category] || 0) + 1;
      
      // Domain counts
      const domain = session.domain || 'unknown';
      stats.domainCounts[domain] = (stats.domainCounts[domain] || 0) + 1;
      
      // Track longest session
      if (session.duration > longestDuration) {
        longestDuration = session.duration;
        stats.longestSession = session;
      }
      
      // Track hour distribution
      const hour = new Date(session.timestamp).getHours();
      hourCounts[hour]++;
    });
    
    // Calculate averages
    stats.averageSessionDuration = Math.round(stats.totalTime / sessions.length);
    
    // Find peak hour
    let maxCount = 0;
    let peakHour = 0;
    hourCounts.forEach((count, hour) => {
      if (count > maxCount) {
        maxCount = count;
        peakHour = hour;
      }
    });
    stats.peakHour = peakHour;
    
    return stats;
  }

  generateDailySummary(sessions, stats) {
    const summary = {
      headline: this.generateHeadline(stats),
      highlights: this.extractHighlights(sessions),
      insights: this.generateInsights(stats),
      focusQuality: this.calculateFocusQuality(stats)
    };
    
    return summary;
  }

  generateHeadline(stats) {
    if (stats.totalSessions === 0) {
      return "No browsing activity yet today";
    }
    
    const hours = Math.floor(stats.totalTime / 3600000);
    const minutes = Math.floor((stats.totalTime % 3600000) / 60000);
    
    if (stats.deepFocusSessions > stats.totalSessions * 0.5) {
      return `Deep focus day: ${hours}h ${minutes}m of quality reading`;
    } else if (stats.scanningSessions > stats.totalSessions * 0.6) {
      return `Quick browsing: ${stats.totalSessions} short sessions today`;
    } else {
      return `Balanced browsing: ${hours}h ${minutes}m across ${stats.totalSessions} sessions`;
    }
  }

  extractHighlights(sessions) {
    const highlights = [];
    
    // Find longest session
    const longestSession = sessions.reduce((max, session) => 
      (session.duration > (max?.duration || 0)) ? session : max, null);
    
    if (longestSession) {
      highlights.push({
        type: 'longest',
        title: longestSession.title,
        duration: longestSession.duration,
        category: longestSession.category
      });
    }
    
    // Find most visited category
    const categoryMap = new Map();
    sessions.forEach(session => {
      const category = session.category || 'Uncategorized';
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    });
    
    const topCategory = Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1])[0];
    
    if (topCategory) {
      highlights.push({
        type: 'topCategory',
        category: topCategory[0],
        count: topCategory[1]
      });
    }
    
    return highlights;
  }

  generateInsights(stats) {
    const insights = [];
    
    // Focus quality insight
    const focusRatio = stats.deepFocusSessions / (stats.totalSessions || 1);
    if (focusRatio > 0.5) {
      insights.push("Excellent focus quality today! Over half your sessions were deep focus.");
    } else if (focusRatio < 0.2) {
      insights.push("Consider longer, uninterrupted sessions for deeper focus.");
    }
    
    // Peak hour insight
    if (stats.peakHour !== null) {
      const hourStr = stats.peakHour > 12 ? 
        `${stats.peakHour - 12}PM` : 
        `${stats.peakHour === 0 ? 12 : stats.peakHour}AM`;
      insights.push(`Most active around ${hourStr}`);
    }
    
    // Category diversity insight
    const categoryCount = Object.keys(stats.categoryCounts).length;
    if (categoryCount > 5) {
      insights.push("Diverse browsing across many categories today.");
    } else if (categoryCount === 1) {
      insights.push("Focused browsing in a single category.");
    }
    
    return insights;
  }

  calculateFocusQuality(stats) {
    if (stats.totalSessions === 0) return 0;
    
    const deepWeight = 1.0;
    const activeWeight = 0.7;
    const scanningWeight = 0.3;
    
    const weightedScore = 
      (stats.deepFocusSessions * deepWeight) +
      (stats.activeReadingSessions * activeWeight) +
      (stats.scanningSessions * scanningWeight);
    
    return Math.round((weightedScore / stats.totalSessions) * 100);
  }

  updateDomainStats(session) {
    if (!session.domain) return;
    
    const stats = this.domainStats.get(session.domain) || {
      totalTime: 0,
      visitCount: 0,
      lastVisit: null
    };
    
    stats.totalTime += session.duration || 0;
    stats.visitCount++;
    stats.lastVisit = Date.now();
    
    this.domainStats.set(session.domain, stats);
  }

  async getBrowsingPatterns() {
    const patterns = {
      daily: [],
      weekly: [],
      topDomains: [],
      categoryTrends: {}
    };
    
    try {
      // Get last 7 days of data
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateString = date.toDateString();
        const sessionsKey = `sessions_${dateString}`;
        
        const result = await chrome.storage.local.get([sessionsKey]);
        const sessions = result[sessionsKey] || [];
        
        if (sessions.length > 0) {
          const stats = this.calculateDailyStats(sessions);
          patterns.daily.push({
            date: dateString,
            stats,
            sessionCount: sessions.length
          });
        }
      }
      
      // Calculate top domains
      const domainTotals = new Map();
      patterns.daily.forEach(day => {
        Object.entries(day.stats.domainCounts).forEach(([domain, count]) => {
          domainTotals.set(domain, (domainTotals.get(domain) || 0) + count);
        });
      });
      
      patterns.topDomains = Array.from(domainTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([domain, count]) => ({ domain, count }));
      
      // Calculate category trends
      patterns.daily.forEach(day => {
        Object.entries(day.stats.categoryCounts).forEach(([category, count]) => {
          if (!patterns.categoryTrends[category]) {
            patterns.categoryTrends[category] = [];
          }
          patterns.categoryTrends[category].push({
            date: day.date,
            count
          });
        });
      });
      
      return patterns;
    } catch (error) {
      console.error('Error getting browsing patterns:', error);
      return patterns;
    }
  }

  async clearOldSessions() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30); // Keep 30 days of data
      
      const allKeys = await chrome.storage.local.get(null);
      const keysToRemove = [];
      
      Object.keys(allKeys).forEach(key => {
        if (key.startsWith('sessions_')) {
          const dateString = key.replace('sessions_', '');
          const sessionDate = new Date(dateString);
          
          if (sessionDate < cutoffDate) {
            keysToRemove.push(key);
          }
        }
      });
      
      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
        console.log(`Cleared ${keysToRemove.length} old session records`);
      }
    } catch (error) {
      console.error('Error clearing old sessions:', error);
    }
  }
}
