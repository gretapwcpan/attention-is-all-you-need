// Browsing Tracker for You Are What You Read Extension

import storageManager from './storage.js';

export class BrowsingTracker {
  constructor() {
    this.sessionCache = new Map();
    this.domainStats = new Map();
  }

  // Add a browsing session
  async addSession(sessionData) {
    // Enrich session data
    const enrichedSession = {
      ...sessionData,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      date: new Date(sessionData.timestamp).toDateString(),
      hour: new Date(sessionData.timestamp).getHours(),
      dayOfWeek: new Date(sessionData.timestamp).getDay(),
      readingSpeed: this.calculateReadingSpeed(sessionData)
    };

    // Update domain stats
    this.updateDomainStats(enrichedSession);

    // Save to storage
    await storageManager.addBrowsingSession(enrichedSession);

    // Update cache
    this.sessionCache.set(enrichedSession.id, enrichedSession);

    return enrichedSession;
  }

  // Get today's browsing data
  async getTodaysBrowsingData() {
    const sessions = await storageManager.getTodaysBrowsing();
    
    // Enrich with aggregated stats
    const stats = this.calculateDailyStats(sessions);
    
    return {
      sessions,
      stats,
      summary: this.generateDailySummary(sessions, stats)
    };
  }

  // Calculate daily statistics
  calculateDailyStats(sessions) {
    const stats = {
      totalSessions: sessions.length,
      totalTime: 0,
      uniqueDomains: new Set(),
      categories: {},
      peakHour: null,
      averageSessionTime: 0,
      longestSession: null,
      mostVisitedDomain: null,
      readingTime: 0,
      videoTime: 0,
      socialTime: 0
    };

    const hourCounts = new Array(24).fill(0);
    const domainCounts = {};

    sessions.forEach(session => {
      // Time stats
      stats.totalTime += session.timeSpent || 0;
      
      // Domain stats
      stats.uniqueDomains.add(session.domain);
      domainCounts[session.domain] = (domainCounts[session.domain] || 0) + 1;
      
      // Category stats
      const category = session.category || 'other';
      stats.categories[category] = (stats.categories[category] || 0) + 1;
      
      // Hour distribution
      const hour = new Date(session.timestamp).getHours();
      hourCounts[hour]++;
      
      // Longest session
      if (!stats.longestSession || session.timeSpent > stats.longestSession.timeSpent) {
        stats.longestSession = session;
      }
      
      // Category-specific time
      if (category === 'education' || category === 'article' || category === 'news') {
        stats.readingTime += session.timeSpent || 0;
      } else if (category === 'video' || category === 'entertainment') {
        stats.videoTime += session.timeSpent || 0;
      } else if (category === 'social') {
        stats.socialTime += session.timeSpent || 0;
      }
    });

    // Calculate derived stats
    stats.uniqueDomains = stats.uniqueDomains.size;
    stats.averageSessionTime = sessions.length > 0 ? stats.totalTime / sessions.length : 0;
    
    // Find peak hour
    let maxHourCount = 0;
    hourCounts.forEach((count, hour) => {
      if (count > maxHourCount) {
        maxHourCount = count;
        stats.peakHour = hour;
      }
    });
    
    // Find most visited domain
    let maxDomainCount = 0;
    for (const [domain, count] of Object.entries(domainCounts)) {
      if (count > maxDomainCount) {
        maxDomainCount = count;
        stats.mostVisitedDomain = domain;
      }
    }

    return stats;
  }

  // Generate daily summary
  generateDailySummary(sessions, stats) {
    if (sessions.length === 0) {
      return {
        headline: "No browsing activity yet today",
        mood: "waiting",
        highlights: [],
        insights: []
      };
    }

    // Determine overall mood
    const mood = this.determineDailyMood(stats);
    
    // Generate headline
    const headline = this.generateHeadline(stats, mood);
    
    // Extract highlights
    const highlights = this.extractHighlights(sessions);
    
    // Generate insights
    const insights = this.generateInsights(stats);

    return {
      headline,
      mood,
      highlights,
      insights
    };
  }

  // Determine daily mood based on browsing patterns
  determineDailyMood(stats) {
    const { categories, totalTime, readingTime, socialTime, videoTime } = stats;
    
    // Calculate percentages
    const readingPercent = totalTime > 0 ? (readingTime / totalTime) * 100 : 0;
    const socialPercent = totalTime > 0 ? (socialTime / totalTime) * 100 : 0;
    const videoPercent = totalTime > 0 ? (videoTime / totalTime) * 100 : 0;
    
    if (readingPercent > 50) return 'studious';
    if (socialPercent > 40) return 'social';
    if (videoPercent > 40) return 'entertained';
    if (stats.uniqueDomains > 20) return 'exploratory';
    if (stats.totalTime < 30 * 60000) return 'light';
    if (stats.totalTime > 180 * 60000) return 'intense';
    
    return 'balanced';
  }

  // Generate headline based on stats
  generateHeadline(stats, mood) {
    const headlines = {
      studious: `📚 Learning mode activated! ${Math.round(stats.readingTime / 60000)} minutes of reading`,
      social: `🦋 Social butterfly day with ${stats.socialTime / 60000} minutes connecting`,
      entertained: `🎬 Entertainment focused with ${stats.videoTime / 60000} minutes of content`,
      exploratory: `🗺️ Digital explorer! Visited ${stats.uniqueDomains} unique sites`,
      light: `☁️ Light browsing day with ${Math.round(stats.totalTime / 60000)} minutes online`,
      intense: `🔥 Power user mode! ${Math.round(stats.totalTime / 60000)} minutes of browsing`,
      balanced: `⚖️ Balanced browsing across ${Object.keys(stats.categories).length} categories`
    };
    
    return headlines[mood] || headlines.balanced;
  }

  // Extract highlights from sessions
  extractHighlights(sessions) {
    const highlights = [];
    
    // Find interesting sessions
    const longSessions = sessions.filter(s => s.timeSpent > 10 * 60000);
    const educationalSessions = sessions.filter(s => s.category === 'education');
    const uniqueDomains = [...new Set(sessions.map(s => s.domain))];
    
    if (longSessions.length > 0) {
      highlights.push({
        type: 'focus',
        text: `Deep focus on ${longSessions[0].title || longSessions[0].domain}`,
        icon: '🎯'
      });
    }
    
    if (educationalSessions.length >= 3) {
      highlights.push({
        type: 'learning',
        text: `Learning spree with ${educationalSessions.length} educational resources`,
        icon: '🎓'
      });
    }
    
    if (uniqueDomains.length >= 10) {
      highlights.push({
        type: 'exploration',
        text: `Explored ${uniqueDomains.length} different websites`,
        icon: '🌍'
      });
    }
    
    // Time-based highlights
    const morningSession = sessions.find(s => new Date(s.timestamp).getHours() < 9);
    if (morningSession) {
      highlights.push({
        type: 'early',
        text: 'Early bird browsing session',
        icon: '🌅'
      });
    }
    
    return highlights;
  }

  // Generate insights from stats
  generateInsights(stats) {
    const insights = [];
    
    if (stats.peakHour !== null) {
      insights.push(`Most active at ${stats.peakHour}:00`);
    }
    
    if (stats.mostVisitedDomain) {
      insights.push(`Favorite site: ${stats.mostVisitedDomain}`);
    }
    
    if (stats.averageSessionTime > 0) {
      const avgMinutes = Math.round(stats.averageSessionTime / 60000);
      insights.push(`Average session: ${avgMinutes} minutes`);
    }
    
    // Category distribution insight
    const topCategory = Object.entries(stats.categories)
      .sort((a, b) => b[1] - a[1])[0];
    if (topCategory) {
      insights.push(`Mostly ${topCategory[0]} content today`);
    }
    
    return insights;
  }

  // Calculate reading speed
  calculateReadingSpeed(session) {
    if (!session.content || !session.timeSpent) return null;
    
    const words = session.content.split(/\s+/).length;
    const minutes = session.timeSpent / 60000;
    
    if (minutes > 0) {
      return Math.round(words / minutes);
    }
    
    return null;
  }

  // Update domain statistics
  updateDomainStats(session) {
    const domain = session.domain;
    if (!domain) return;
    
    if (!this.domainStats.has(domain)) {
      this.domainStats.set(domain, {
        visits: 0,
        totalTime: 0,
        categories: new Set(),
        lastVisit: null
      });
    }
    
    const stats = this.domainStats.get(domain);
    stats.visits++;
    stats.totalTime += session.timeSpent || 0;
    stats.categories.add(session.category);
    stats.lastVisit = session.timestamp;
  }

  // Get browsing patterns
  async getBrowsingPatterns() {
    const history = await storageManager.get('browsingHistory') || [];
    
    const patterns = {
      timeDistribution: new Array(24).fill(0),
      dayDistribution: new Array(7).fill(0),
      categoryDistribution: {},
      topDomains: [],
      browsingHabits: []
    };
    
    // Analyze history
    history.forEach(session => {
      // Time distribution
      const hour = new Date(session.timestamp).getHours();
      patterns.timeDistribution[hour]++;
      
      // Day distribution
      const day = new Date(session.timestamp).getDay();
      patterns.dayDistribution[day]++;
      
      // Category distribution
      const category = session.category || 'other';
      patterns.categoryDistribution[category] = 
        (patterns.categoryDistribution[category] || 0) + 1;
    });
    
    // Get top domains
    const domainCounts = {};
    history.forEach(session => {
      if (session.domain) {
        domainCounts[session.domain] = (domainCounts[session.domain] || 0) + 1;
      }
    });
    
    patterns.topDomains = Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count }));
    
    // Identify habits
    patterns.browsingHabits = this.identifyHabits(patterns);
    
    return patterns;
  }

  // Identify browsing habits
  identifyHabits(patterns) {
    const habits = [];
    
    // Find peak browsing time
    const peakHour = patterns.timeDistribution.indexOf(
      Math.max(...patterns.timeDistribution)
    );
    habits.push({
      type: 'peak_time',
      description: `Most active at ${peakHour}:00`,
      strength: 'strong'
    });
    
    // Find most active day
    const peakDay = patterns.dayDistribution.indexOf(
      Math.max(...patterns.dayDistribution)
    );
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    habits.push({
      type: 'peak_day',
      description: `Most active on ${days[peakDay]}s`,
      strength: 'medium'
    });
    
    // Dominant category
    const topCategory = Object.entries(patterns.categoryDistribution)
      .sort((a, b) => b[1] - a[1])[0];
    if (topCategory) {
      habits.push({
        type: 'preferred_content',
        description: `Prefers ${topCategory[0]} content`,
        strength: 'strong'
      });
    }
    
    return habits;
  }

  // Get session by ID
  getSession(sessionId) {
    return this.sessionCache.get(sessionId);
  }

  // Clear old sessions from cache
  clearOldSessions() {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    for (const [id, session] of this.sessionCache.entries()) {
      if (session.timestamp < sevenDaysAgo) {
        this.sessionCache.delete(id);
      }
    }
  }
}

// Export singleton instance
export default new BrowsingTracker();
