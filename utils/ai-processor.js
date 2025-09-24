// AI Processor for You Are What You Read Extension
// Integrates with Chrome's built-in AI APIs for creative diary generation

export class AIProcessor {
  constructor() {
    this.aiCapabilities = null;
    this.initialized = false;
    this.diaryStyles = {
      casual: {
        tone: 'friendly and conversational',
        perspective: 'first person',
        creativity: 'high',
        humor: 'moderate'
      },
      professional: {
        tone: 'formal and reflective',
        perspective: 'third person',
        creativity: 'moderate',
        humor: 'minimal'
      },
      humorous: {
        tone: 'playful and witty',
        perspective: 'first person',
        creativity: 'very high',
        humor: 'high'
      },
      poetic: {
        tone: 'artistic and metaphorical',
        perspective: 'varied',
        creativity: 'maximum',
        humor: 'subtle'
      }
    };
  }

  // Initialize AI capabilities
  async initialize() {
    try {
      // Check for Chrome AI API availability
      if ('ai' in self && 'summarizer' in self.ai) {
        this.aiCapabilities = {
          summarizer: await this.checkCapability('summarizer'),
          writer: await this.checkCapability('writer'),
          rewriter: await this.checkCapability('rewriter')
        };
        this.initialized = true;
      } else {
        console.log('Chrome AI APIs not available, using fallback generation');
        this.initialized = false;
      }
    } catch (error) {
      console.error('Error initializing AI processor:', error);
      this.initialized = false;
    }
  }

  // Check if a specific AI capability is available
  async checkCapability(capability) {
    try {
      if (self.ai && self.ai[capability]) {
        const capabilities = await self.ai[capability].capabilities();
        return capabilities.available === 'readily';
      }
    } catch (error) {
      console.error(`Error checking ${capability} capability:`, error);
    }
    return false;
  }

  // Generate diary entry from browsing data
  async generateDiary(browsingData, gameState) {
    const preferences = await this.getPreferences();
    const style = this.diaryStyles[preferences.diaryStyle] || this.diaryStyles.casual;
    
    // If Chrome AI APIs are available, use them
    if (this.initialized && this.aiCapabilities?.writer) {
      return await this.generateWithAI(browsingData, gameState, style);
    }
    
    // Fallback to template-based generation
    return await this.generateWithTemplates(browsingData, gameState, style);
  }

  // Generate diary using Chrome AI APIs
  async generateWithAI(browsingData, gameState, style) {
    try {
      // Prepare context for AI
      const context = this.prepareContext(browsingData, gameState);
      
      // Create prompt for diary generation
      const prompt = this.createDiaryPrompt(context, style);
      
      // Use Chrome's Writer API
      const writer = await self.ai.writer.create({
        tone: style.tone,
        format: 'plain-text',
        length: 'medium'
      });
      
      const diaryContent = await writer.write(prompt);
      
      // Enhance with Rewriter API if available
      if (this.aiCapabilities.rewriter) {
        const enhanced = await this.enhanceDiary(diaryContent, style);
        return this.formatDiaryEntry(enhanced, browsingData, gameState);
      }
      
      return this.formatDiaryEntry(diaryContent, browsingData, gameState);
    } catch (error) {
      console.error('Error generating diary with AI:', error);
      // Fallback to template generation
      return await this.generateWithTemplates(browsingData, gameState, style);
    }
  }

  // Generate diary using templates (fallback)
  async generateWithTemplates(browsingData, gameState, style) {
    const { sessions, stats, summary } = browsingData;
    const pet = gameState.moodPet;
    
    // Select template based on mood and style
    const template = this.selectTemplate(summary.mood, style);
    
    // Fill template with data
    const content = this.fillTemplate(template, {
      date: new Date().toLocaleDateString(),
      petName: pet.name,
      petMood: pet.mood,
      headline: summary.headline,
      totalTime: Math.round(stats.totalTime / 60000),
      uniqueSites: stats.uniqueDomains,
      topCategory: Object.entries(stats.categories || {})
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'various',
      highlights: summary.highlights,
      insights: summary.insights,
      level: gameState.level,
      streak: gameState.streak
    });
    
    return this.formatDiaryEntry(content, browsingData, gameState);
  }

  // Prepare context for AI generation
  prepareContext(browsingData, gameState) {
    const { sessions, stats, summary } = browsingData;
    
    return {
      date: new Date().toLocaleDateString(),
      dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
      browsingStats: {
        totalTime: Math.round(stats.totalTime / 60000),
        sessionsCount: stats.totalSessions,
        uniqueDomains: stats.uniqueDomains,
        categories: stats.categories
      },
      topSites: sessions
        .sort((a, b) => b.timeSpent - a.timeSpent)
        .slice(0, 5)
        .map(s => ({ title: s.title, domain: s.domain, time: s.timeSpent })),
      mood: summary.mood,
      highlights: summary.highlights,
      gameProgress: {
        level: gameState.level,
        streak: gameState.streak,
        petName: gameState.moodPet.name,
        petMood: gameState.moodPet.mood
      }
    };
  }

  // Create prompt for diary generation
  createDiaryPrompt(context, style) {
    return `Generate a ${style.tone} diary entry in ${style.perspective} about today's digital journey.

Context:
- Date: ${context.date} (${context.dayOfWeek})
- Browsing time: ${context.browsingStats.totalTime} minutes across ${context.browsingStats.sessionsCount} sessions
- Visited ${context.browsingStats.uniqueDomains} unique websites
- Main categories: ${Object.keys(context.browsingStats.categories).join(', ')}
- Overall mood: ${context.mood}
- Digital pet ${context.gameProgress.petName} is feeling ${context.gameProgress.petMood}
- Current streak: ${context.gameProgress.streak} days

Top activities:
${context.topSites.map(s => `- ${s.title || s.domain}: ${Math.round(s.time / 60000)} minutes`).join('\n')}

Highlights:
${context.highlights.map(h => `- ${h.text}`).join('\n')}

Create an engaging, ${style.creativity} creative diary entry that captures the essence of this digital day. Include ${style.humor} humor and make it personal and memorable.`;
  }

  // Enhance diary with Rewriter API
  async enhanceDiary(content, style) {
    try {
      const rewriter = await self.ai.rewriter.create({
        tone: style.tone,
        format: 'plain-text',
        length: 'as-is'
      });
      
      return await rewriter.rewrite(content, {
        context: `Make this diary entry more ${style.tone} with ${style.humor} humor level`
      });
    } catch (error) {
      console.error('Error enhancing diary:', error);
      return content;
    }
  }

  // Summarize content using Chrome AI
  async summarizeContent(content) {
    if (!this.initialized || !this.aiCapabilities?.summarizer) {
      return this.fallbackSummarize(content);
    }
    
    try {
      const summarizer = await self.ai.summarizer.create({
        type: 'key-points',
        format: 'plain-text',
        length: 'short'
      });
      
      return await summarizer.summarize(content);
    } catch (error) {
      console.error('Error summarizing content:', error);
      return this.fallbackSummarize(content);
    }
  }

  // Fallback summarization
  fallbackSummarize(content) {
    if (!content || content.length < 100) return content;
    
    // Simple extraction of first few sentences
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [];
    return sentences.slice(0, 3).join(' ');
  }

  // Select template based on mood and style
  selectTemplate(mood, style) {
    const templates = {
      casual: {
        studious: "Dear Diary,\n\nToday {petName} and I went on quite the learning adventure! We spent {totalTime} minutes diving deep into {topCategory} content. {headline}\n\n{highlights}\n\nWhat a productive day! Tomorrow, we'll see what new knowledge awaits.\n\n- Your Digital Self",
        social: "Hey Diary!\n\n{petName} was feeling {petMood} as we caught up with the online world today. {totalTime} minutes of scrolling, chatting, and connecting across {uniqueSites} different sites.\n\n{headline}\n\n{highlights}\n\nSocial battery: recharged! 🔋\n\n- Your Connected Self",
        exploratory: "Adventure Log, Day {streak}:\n\n{petName} led the expedition through {uniqueSites} unique digital territories today! {headline}\n\nDiscoveries made:\n{highlights}\n\nThe internet is vast and full of wonders. Level {level} explorer, signing off!",
        balanced: "Dear Diary,\n\nAnother day in the digital realm with {petName}! We maintained our {streak}-day streak while exploring {topCategory} content for {totalTime} minutes.\n\n{headline}\n\nToday's journey:\n{highlights}\n\nInsights gained:\n{insights}\n\nUntil tomorrow's adventures!"
      },
      humorous: {
        studious: "Captain's Log, Stardate {date}:\n\n{petName} and I accidentally became scholars today. {totalTime} minutes of 'I'll just read one more article' later... {headline}\n\nAchievements unlocked:\n{highlights}\n\nBrain cells gained: countless. Sleep lost: also countless. Worth it? Absolutely!\n\n- Captain Knowledge Pants",
        social: "Gossip Journal Entry #{streak}:\n\nOMG Diary! {petName} was literally {petMood} all day! We spent {totalTime} minutes being social butterflies. 🦋\n\n{headline}\n\nTea spilled:\n{highlights}\n\nSocial media: 1, Productivity: 0. But hey, we're level {level} now!\n\n- Your Extremely Online Self"
      },
      poetic: {
        balanced: "In digital gardens we wandered today,\n{petName} as guide, {petMood} at play.\n{totalTime} minutes of time did flow,\nThrough {uniqueSites} domains we chose to go.\n\n{headline}\n\nMoments captured in binary light:\n{highlights}\n\nDay {streak} complete, level {level} in sight,\nTomorrow brings new digital flight."
      }
    };
    
    const styleTemplates = templates[style.perspective === 'first person' ? 'casual' : 'professional'] || templates.casual;
    return styleTemplates[mood] || styleTemplates.balanced;
  }

  // Fill template with data
  fillTemplate(template, data) {
    let filled = template;
    
    // Replace simple placeholders
    Object.keys(data).forEach(key => {
      if (typeof data[key] !== 'object') {
        const regex = new RegExp(`{${key}}`, 'g');
        filled = filled.replace(regex, data[key]);
      }
    });
    
    // Handle highlights
    if (data.highlights && data.highlights.length > 0) {
      const highlightText = data.highlights
        .map(h => `${h.icon} ${h.text}`)
        .join('\n');
      filled = filled.replace('{highlights}', highlightText);
    } else {
      filled = filled.replace('{highlights}', '✨ A day of digital wandering');
    }
    
    // Handle insights
    if (data.insights && data.insights.length > 0) {
      const insightText = data.insights
        .map(i => `• ${i}`)
        .join('\n');
      filled = filled.replace('{insights}', insightText);
    } else {
      filled = filled.replace('{insights}', '• Every click tells a story');
    }
    
    // Add current date if needed
    filled = filled.replace('{date}', new Date().toLocaleDateString());
    
    return filled;
  }

  // Format final diary entry
  formatDiaryEntry(content, browsingData, gameState) {
    return {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      content: content,
      stats: {
        totalTime: browsingData.stats.totalTime,
        uniqueSites: browsingData.stats.uniqueDomains,
        topCategory: Object.entries(browsingData.stats.categories || {})
          .sort((a, b) => b[1] - a[1])[0]?.[0] || 'various'
      },
      gameState: {
        level: gameState.level,
        streak: gameState.streak,
        petMood: gameState.moodPet.mood
      },
      mood: browsingData.summary.mood,
      highlights: browsingData.summary.highlights
    };
  }

  // Get user preferences
  async getPreferences() {
    try {
      const prefs = await chrome.storage.local.get(['userPreferences']);
      return prefs.userPreferences || {
        diaryStyle: 'casual',
        diaryLength: 'medium'
      };
    } catch (error) {
      return {
        diaryStyle: 'casual',
        diaryLength: 'medium'
      };
    }
  }

  // Generate emoji story format
  generateEmojiStory(sessions) {
    const emojiMap = {
      education: '📚',
      development: '💻',
      social: '💬',
      entertainment: '🎮',
      news: '📰',
      shopping: '🛍️',
      video: '📺',
      other: '🌐'
    };
    
    const story = sessions
      .slice(0, 10)
      .map(s => emojiMap[s.category] || emojiMap.other)
      .join(' → ');
    
    return story || '🌟';
  }

  // Generate comic strip format
  generateComicStrip(browsingData, gameState) {
    const panels = [
      {
        title: 'Morning',
        content: `${gameState.moodPet.name} wakes up ready for digital adventures!`,
        emotion: '😊'
      },
      {
        title: 'Midday',
        content: `Deep dive into ${browsingData.stats.topCategory || 'interesting'} content`,
        emotion: '🤓'
      },
      {
        title: 'Afternoon',
        content: `${browsingData.stats.uniqueDomains} sites visited and counting!`,
        emotion: '🚀'
      },
      {
        title: 'Evening',
        content: `Level ${gameState.level} achieved! Streak continues: ${gameState.streak} days`,
        emotion: '🎉'
      }
    ];
    
    return {
      type: 'comic',
      panels,
      emojiStory: this.generateEmojiStory(browsingData.sessions)
    };
  }

  // Generate haiku format
  generateHaiku(browsingData) {
    const syllables = {
      line1: this.generateHaikuLine(5, browsingData),
      line2: this.generateHaikuLine(7, browsingData),
      line3: this.generateHaikuLine(5, browsingData)
    };
    
    return `${syllables.line1}\n${syllables.line2}\n${syllables.line3}`;
  }

  // Generate haiku line with syllable count
  generateHaikuLine(syllableCount, browsingData) {
    const templates = {
      5: [
        'Digital wanderer',
        'Pixels light the way',
        'Knowledge flows like streams',
        'Clicking through the web'
      ],
      7: [
        'Through endless pages we scroll',
        'Information cascades down',
        'The internet never sleeps',
        'Connections made in silence'
      ]
    };
    
    const lines = templates[syllableCount] || templates[5];
    return lines[Math.floor(Math.random() * lines.length)];
  }

  // Generate time capsule format
  generateTimeCapsule(browsingData, gameState) {
    const capsule = {
      date: new Date().toISOString(),
      snapshot: {
        level: gameState.level,
        streak: gameState.streak,
        petName: gameState.moodPet.name,
        petMood: gameState.moodPet.mood
      },
      memories: browsingData.summary.highlights.map(h => h.text),
      statistics: {
        timeSpent: browsingData.stats.totalTime,
        sitesVisited: browsingData.stats.uniqueDomains,
        favoriteCategory: Object.entries(browsingData.stats.categories || {})
          .sort((a, b) => b[1] - a[1])[0]?.[0] || 'various'
      },
      message: `Future self, on this day you explored ${browsingData.stats.uniqueDomains} digital realms and gained wisdom.`
    };
    
    return capsule;
  }
}

// Export singleton instance
export default new AIProcessor();
