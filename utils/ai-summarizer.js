/**
 * AI Summarizer Module
 * Generates intelligent summaries of browsing content using Chrome's built-in AI
 */

import { getAIService } from './ai-service.js';

class AISummarizer {
  constructor() {
    this.aiService = getAIService();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return true;
    
    try {
      await this.aiService.initialize();
      this.initialized = true;
      console.log('AI Summarizer initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize AI Summarizer:', error);
      return false;
    }
  }

  /**
   * Generate a summary of the page content
   */
  async summarizePage(pageData) {
    if (!this.initialized) {
      await this.initialize();
    }

    const { title, content, url, timeSpent } = pageData;
    
    // Create a focused prompt for summarization
    const prompt = `
      You are an AI reading coach helping a user understand what they just read.
      
      Page Title: ${title}
      Time Spent: ${Math.round(timeSpent / 60000)} minutes
      
      Content excerpt:
      ${content.substring(0, 2000)}
      
      Please provide a brief, helpful summary (2-3 sentences) highlighting:
      1. The main topic or concept
      2. Key takeaways or insights
      3. Why this might be valuable to remember
      
      Keep it conversational and encouraging.
    `;

    try {
      const summary = await this.aiService.generateText(prompt);
      return {
        title: this.extractTopicFromTitle(title),
        text: summary,
        url: url,
        timestamp: Date.now(),
        timeSpent: timeSpent
      };
    } catch (error) {
      console.error('Error generating summary:', error);
      return this.generateFallbackSummary(pageData);
    }
  }

  /**
   * Generate a daily summary of all reading
   */
  async generateDailySummary(sessions) {
    if (!this.initialized) {
      await this.initialize();
    }

    const topics = sessions.map(s => s.title).join(', ');
    const totalTime = sessions.reduce((sum, s) => sum + s.timeSpent, 0);
    
    const prompt = `
      You are an browser content analyst providing a daily reading summary.
      
      Today's reading sessions:
      ${sessions.map(s => `- ${s.title} (${Math.round(s.timeSpent / 60000)} min)`).join('\n')}
      
      Total time: ${Math.round(totalTime / 60000)} minutes
      
      Provide an encouraging summary that:
      1. Highlights the main themes explored today
      2. Identifies connections between topics
      3. Suggests what was learned
      4. Offers a motivational insight
      
      Keep it brief (3-4 sentences) and positive.
    `;

    try {
      const summary = await this.aiService.generateText(prompt);
      return {
        title: 'Daily Reading Summary',
        text: summary,
        timestamp: Date.now(),
        sessions: sessions.length,
        totalTime: totalTime
      };
    } catch (error) {
      console.error('Error generating daily summary:', error);
      return {
        title: 'Daily Reading Summary',
        text: `You explored ${sessions.length} topics today for ${Math.round(totalTime / 60000)} minutes. Great focus on learning!`,
        timestamp: Date.now(),
        sessions: sessions.length,
        totalTime: totalTime
      };
    }
  }

  /**
   * Extract main topic from title
   */
  extractTopicFromTitle(title) {
    // Remove common suffixes and clean up
    const cleaned = title
      .replace(/[-–—|] .+$/, '') // Remove site names after separators
      .replace(/\s+/g, ' ')
      .trim();
    
    // Truncate if too long
    if (cleaned.length > 50) {
      return cleaned.substring(0, 47) + '...';
    }
    
    return cleaned || 'Reading Session';
  }

  /**
   * Generate fallback summary without AI
   */
  generateFallbackSummary(pageData) {
    const { title, url, timeSpent } = pageData;
    const domain = new URL(url).hostname.replace('www.', '');
    const minutes = Math.round(timeSpent / 60000);
    
    const templates = [
      `You spent ${minutes} minutes reading about "${this.extractTopicFromTitle(title)}" on ${domain}. This focused reading session helps build your knowledge base.`,
      `Great ${minutes}-minute deep dive into "${this.extractTopicFromTitle(title)}". Consistent reading like this strengthens understanding.`,
      `You explored "${this.extractTopicFromTitle(title)}" for ${minutes} minutes. Each reading session adds to your expertise.`
    ];
    
    return {
      title: this.extractTopicFromTitle(title),
      text: templates[Math.floor(Math.random() * templates.length)],
      url: url,
      timestamp: Date.now(),
      timeSpent: timeSpent
    };
  }

  /**
   * Check if content should be summarized
   */
  shouldSummarize(pageData) {
    const { timeSpent, content, url } = pageData;
    
    // Don't summarize if:
    // - Less than 2 minutes spent
    // - Too little content
    // - Certain domains (social media, etc.)
    if (timeSpent < 120000) return false;
    if (!content || content.length < 500) return false;
    
    const excludedDomains = [
      'facebook.com', 'twitter.com', 'instagram.com', 
      'youtube.com', 'tiktok.com', 'netflix.com'
    ];
    
    const domain = new URL(url).hostname;
    if (excludedDomains.some(excluded => domain.includes(excluded))) {
      return false;
    }
    
    return true;
  }
}

// Singleton instance
let summarizerInstance = null;

export function getAISummarizer() {
  if (!summarizerInstance) {
    summarizerInstance = new AISummarizer();
  }
  return summarizerInstance;
}
