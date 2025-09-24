// Attention Tracker - Categorization and Analysis

export default class AttentionTracker {
  constructor() {
    // Domain-based categorization rules
    this.categoryRules = {
      'Learning': [
        'coursera', 'udemy', 'edx', 'khanacademy', 'skillshare', 
        'pluralsight', 'lynda', 'masterclass', 'udacity', 'codecademy'
      ],
      'Development': [
        'github', 'stackoverflow', 'dev.to', 'codepen', 'gitlab', 
        'bitbucket', 'jsfiddle', 'codesandbox', 'replit', 'glitch'
      ],
      'Research': [
        'scholar.google', 'arxiv', 'pubmed', 'jstor', 'researchgate',
        'sciencedirect', 'nature', 'ieee', 'acm', 'springer'
      ],
      'Documentation': [
        'docs', 'developer', 'api', 'reference', 'wiki', 
        'mdn', 'w3schools', 'devdocs', 'readthedocs', 'man'
      ],
      'News': [
        'news', 'techcrunch', 'hackernews', 'reuters', 'bloomberg', 
        'wsj', 'nytimes', 'bbc', 'cnn', 'theverge', 'arstechnica'
      ],
      'Social': [
        'twitter', 'linkedin', 'facebook', 'reddit', 'instagram', 
        'youtube', 'tiktok', 'discord', 'slack', 'teams'
      ],
      'Reading': [
        'medium', 'substack', 'blog', 'article', 'post',
        'wordpress', 'blogger', 'ghost', 'hashnode', 'dev.community'
      ],
      'Reference': [
        'wikipedia', 'dictionary', 'thesaurus', 'translate',
        'wolfram', 'britannica', 'merriam-webster', 'oxford'
      ],
      'Productivity': [
        'notion', 'evernote', 'todoist', 'trello', 'asana',
        'monday', 'clickup', 'airtable', 'roam', 'obsidian'
      ],
      'Communication': [
        'gmail', 'outlook', 'mail', 'zoom', 'meet',
        'skype', 'whatsapp', 'telegram', 'signal', 'messenger'
      ]
    };
    
    // Topic extraction patterns
    this.topicPatterns = {
      'JavaScript': /javascript|js|node|react|vue|angular/i,
      'Python': /python|django|flask|pandas|numpy/i,
      'AI/ML': /artificial intelligence|machine learning|ai|ml|deep learning|neural/i,
      'Data Science': /data science|analytics|visualization|statistics/i,
      'Web Development': /web dev|frontend|backend|fullstack|css|html/i,
      'Cloud': /aws|azure|gcp|cloud|kubernetes|docker/i,
      'Security': /security|cybersecurity|encryption|vulnerability/i,
      'Design': /design|ux|ui|figma|sketch|adobe/i,
      'Business': /business|marketing|sales|strategy|management/i,
      'Finance': /finance|investment|trading|crypto|stock/i
    };
  }
  
  // Categorize a URL
  categorizeUrl(url) {
    try {
      const domain = new URL(url).hostname.toLowerCase();
      const pathname = new URL(url).pathname.toLowerCase();
      
      // Check each category
      for (const [category, keywords] of Object.entries(this.categoryRules)) {
        if (keywords.some(keyword => domain.includes(keyword))) {
          return category;
        }
      }
      
      // Check pathname for additional hints
      if (pathname.includes('/learn') || pathname.includes('/course')) {
        return 'Learning';
      }
      if (pathname.includes('/docs') || pathname.includes('/documentation')) {
        return 'Documentation';
      }
      if (pathname.includes('/blog') || pathname.includes('/article')) {
        return 'Reading';
      }
      
      // Default category
      return 'Exploring';
    } catch (error) {
      console.error('Error categorizing URL:', error);
      return 'Exploring';
    }
  }
  
  // Extract topics from page title
  extractTopics(title) {
    const topics = [];
    
    if (!title) return topics;
    
    for (const [topic, pattern] of Object.entries(this.topicPatterns)) {
      if (pattern.test(title)) {
        topics.push(topic);
      }
    }
    
    // Extract custom topics from common patterns
    const techWords = title.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)*\b/g);
    if (techWords) {
      techWords.forEach(word => {
        if (word.length > 3 && !topics.includes(word)) {
          topics.push(word);
        }
      });
    }
    
    return topics.slice(0, 5); // Limit to 5 topics
  }
  
  // Generate insights from analytics data
  generateInsights(analytics) {
    const insights = [];
    
    if (!analytics || analytics.totalTime === 0) {
      return [{
        type: 'empty',
        message: 'Start browsing to generate insights about your attention patterns.'
      }];
    }
    
    // Focus quality insight
    const deepFocusPercent = (analytics.deepFocusTime / analytics.totalTime) * 100;
    if (deepFocusPercent > 60) {
      insights.push({
        type: 'positive',
        category: 'focus',
        message: `Excellent focus! ${Math.round(deepFocusPercent)}% of your time was in deep concentration.`,
        value: deepFocusPercent
      });
    } else if (deepFocusPercent < 20) {
      insights.push({
        type: 'suggestion',
        category: 'focus',
        message: 'Try longer uninterrupted sessions for deeper focus and better retention.',
        value: deepFocusPercent
      });
    }
    
    // Category distribution insight
    const topCategories = Object.entries(analytics.categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    if (topCategories.length > 0) {
      const topCategory = topCategories[0];
      const topPercent = (topCategory[1] / analytics.totalTime) * 100;
      
      insights.push({
        type: 'info',
        category: 'distribution',
        message: `${topCategory[0]} dominated your attention today (${Math.round(topPercent)}%)`,
        value: topPercent,
        data: topCategories
      });
    }
    
    // Site diversity insight
    const siteCount = analytics.uniqueSites.length;
    if (siteCount > 30) {
      insights.push({
        type: 'observation',
        category: 'diversity',
        message: `High exploration: visited ${siteCount} different sites. Consider if this aligns with your goals.`,
        value: siteCount
      });
    } else if (siteCount < 5) {
      insights.push({
        type: 'positive',
        category: 'diversity',
        message: `Focused browsing: stayed on just ${siteCount} sites for deeper engagement.`,
        value: siteCount
      });
    }
    
    // Time-based insights
    const totalHours = analytics.totalTime / 3600000;
    if (totalHours > 6) {
      insights.push({
        type: 'warning',
        category: 'time',
        message: `${Math.round(totalHours)} hours online today. Remember to take breaks!`,
        value: totalHours
      });
    }
    
    // Topic variety insight
    if (analytics.topics.length > 10) {
      insights.push({
        type: 'observation',
        category: 'topics',
        message: `Explored ${analytics.topics.length} different topics. Wide-ranging curiosity!`,
        value: analytics.topics.length
      });
    }
    
    // Pattern detection
    const patterns = this.detectPatterns(analytics.sessions);
    if (patterns.contextSwitching > 10) {
      insights.push({
        type: 'suggestion',
        category: 'pattern',
        message: 'Frequent context switching detected. Try batching similar tasks.',
        value: patterns.contextSwitching
      });
    }
    
    return insights;
  }
  
  // Detect browsing patterns
  detectPatterns(sessions) {
    const patterns = {
      contextSwitching: 0,
      rabbitHoles: 0,
      focusBlocks: 0
    };
    
    if (!sessions || sessions.length < 2) return patterns;
    
    let lastCategory = null;
    let categoryStreak = 0;
    
    sessions.forEach(session => {
      // Count context switches
      if (lastCategory && lastCategory !== session.category) {
        patterns.contextSwitching++;
        categoryStreak = 0;
      } else {
        categoryStreak++;
      }
      
      // Detect focus blocks (5+ sessions in same category)
      if (categoryStreak >= 5) {
        patterns.focusBlocks++;
      }
      
      // Detect rabbit holes (quick succession of related content)
      if (session.duration < 60000 && session.focusType === 'scanning') {
        patterns.rabbitHoles++;
      }
      
      lastCategory = session.category;
    });
    
    return patterns;
  }
  
  // Calculate attention score
  calculateAttentionScore(analytics) {
    if (!analytics || analytics.totalTime === 0) return 0;
    
    // Weighted factors
    const weights = {
      deepFocus: 0.4,
      consistency: 0.2,
      intentionality: 0.2,
      efficiency: 0.2
    };
    
    // Calculate component scores
    const deepFocusScore = (analytics.deepFocusTime / analytics.totalTime) * 100;
    
    const consistencyScore = Math.min(
      (analytics.sessions.length / 20) * 100, 
      100
    ); // Normalize to 20 sessions
    
    const intentionalityScore = this.calculateIntentionalityScore(analytics);
    
    const efficiencyScore = this.calculateEfficiencyScore(analytics);
    
    // Calculate weighted total
    const totalScore = 
      (deepFocusScore * weights.deepFocus) +
      (consistencyScore * weights.consistency) +
      (intentionalityScore * weights.intentionality) +
      (efficiencyScore * weights.efficiency);
    
    return Math.round(totalScore);
  }
  
  // Calculate intentionality score
  calculateIntentionalityScore(analytics) {
    // Check if browsing aligns with productive categories
    const productiveCategories = ['Learning', 'Development', 'Research', 'Documentation', 'Productivity'];
    
    const productiveTime = Object.entries(analytics.categories)
      .filter(([category]) => productiveCategories.includes(category))
      .reduce((sum, [_, time]) => sum + time, 0);
    
    return (productiveTime / analytics.totalTime) * 100;
  }
  
  // Calculate efficiency score
  calculateEfficiencyScore(analytics) {
    if (!analytics.sessions || analytics.sessions.length === 0) return 0;
    
    // Ratio of deep focus sessions to total sessions
    const deepSessions = analytics.sessions.filter(s => s.focusType === 'deep').length;
    const efficiency = (deepSessions / analytics.sessions.length) * 100;
    
    return Math.min(efficiency * 2, 100); // Scale up but cap at 100
  }
}
