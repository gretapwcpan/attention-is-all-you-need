// AI Service - Gemini Nano Integration for Chrome Built-in AI
// Updated to match latest Chrome Prompt API documentation

export class AIService {
  constructor() {
    this.session = null;
    this.available = false;
    this.availability = 'no';
    this.modelParams = null;
    this.initialized = false;
    this.abortController = null;
  }

  /**
   * Initialize the AI service and check capabilities
   */
  async initialize() {
    if (this.initialized) {
      return this.available;
    }

    try {
      // Check if Chrome AI APIs are available
      if (!('ai' in self) || !('languageModel' in self.ai)) {
        console.log('Chrome AI APIs not available. Please enable flags:');
        console.log('chrome://flags/#optimization-guide-on-device-model');
        console.log('chrome://flags/#prompt-api-for-gemini-nano');
        this.available = false;
        this.initialized = true;
        return false;
      }

      // Check availability using the new method
      this.availability = await self.ai.languageModel.availability();
      console.log('AI Availability status:', this.availability);

      // Get model parameters
      try {
        this.modelParams = await self.ai.languageModel.params();
        console.log('Model parameters:', this.modelParams);
      } catch (paramsError) {
        console.log('Could not get model params:', paramsError);
        // Set default params if the method is not available
        this.modelParams = {
          defaultTopK: 3,
          maxTopK: 128,
          defaultTemperature: 1,
          maxTemperature: 2
        };
      }

      if (this.availability === 'no') {
        console.log('Gemini Nano is not available on this device');
        this.available = false;
        this.initialized = true;
        return false;
      }

      // Try to create a session
      try {
        await this.createSession();
      } catch (createError) {
        console.log('Failed to create initial session:', createError);
        
        if (this.availability === 'after-download') {
          console.log('Gemini Nano needs to be downloaded. Please wait for the model to download.');
          console.log('You may need to restart Chrome after the download completes.');
        }
        
        this.available = false;
      }

      this.initialized = true;
      return this.available;

    } catch (error) {
      console.error('Error initializing AI service:', error);
      this.available = false;
      this.initialized = true;
      return false;
    }
  }

  /**
   * Create a new AI session with proper configuration
   */
  async createSession(options = {}) {
    console.log('Creating AI session...');
    
    // Clean up existing session if any
    if (this.abortController) {
      this.abortController.abort();
    }
    
    // Create new abort controller for session management
    this.abortController = new AbortController();
    
    // Prepare session configuration
    const sessionConfig = {
      signal: this.abortController.signal,
      temperature: Math.min(options.temperature || 0.8, this.modelParams?.maxTemperature || 2),
      topK: Math.min(options.topK || 40, this.modelParams?.maxTopK || 128)
    };

    // Add initial prompts if provided
    if (options.initialPrompts) {
      sessionConfig.initialPrompts = options.initialPrompts;
    }

    // Add download progress monitoring for after-download status
    if (this.availability === 'after-download') {
      sessionConfig.monitor = (m) => {
        m.addEventListener('downloadprogress', (e) => {
          console.log(`Model download progress: ${e.loaded} / ${e.total} bytes`);
          const progress = Math.round((e.loaded / e.total) * 100);
          console.log(`Download ${progress}% complete`);
          
          // You could dispatch a custom event here for UI updates
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ai-download-progress', { 
              detail: { loaded: e.loaded, total: e.total, progress } 
            }));
          }
        });
      };
    }

    try {
      this.session = await self.ai.languageModel.create(sessionConfig);
      
      if (this.session) {
        this.available = true;
        console.log('Gemini Nano session created successfully!');
        console.log('Session configuration:', sessionConfig);
        return this.session;
      }
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  /**
   * Check if AI is available with detailed status
   */
  async checkAvailability() {
    if (!this.initialized) {
      await this.initialize();
    }
    
    return {
      available: this.available,
      status: this.availability,
      message: this.getAvailabilityMessage()
    };
  }

  /**
   * Get human-readable availability message
   */
  getAvailabilityMessage() {
    switch (this.availability) {
      case 'readily':
        return 'AI is ready to use';
      case 'after-download':
        return 'AI model is downloading, please wait...';
      case 'no':
        return 'AI is not available on this device';
      default:
        return 'Unknown availability status';
    }
  }

  /**
   * Generate text using Gemini Nano
   */
  async generateText(prompt, options = {}) {
    if (!this.available || !this.session) {
      // Try to create a session if not available
      if (this.availability === 'readily' || this.availability === 'after-download') {
        try {
          await this.createSession(options);
        } catch (error) {
          throw new Error('AI service not available. Using fallback mode.');
        }
      } else {
        throw new Error('AI service not available. Using fallback mode.');
      }
    }

    try {
      const result = await this.session.prompt(prompt);
      return result;
    } catch (error) {
      console.error('Error generating text:', error);
      
      // If session expired or failed, try to recreate it
      if (error.message?.includes('session') || error.message?.includes('abort')) {
        console.log('Session expired, creating new session...');
        await this.createSession(options);
        // Retry once with new session
        return await this.session.prompt(prompt);
      }
      
      throw error;
    }
  }

  /**
   * Generate text with streaming (for future use when API is stable)
   */
  async generateTextStream(prompt, options = {}) {
    if (!this.available || !this.session) {
      throw new Error('AI service not available');
    }

    try {
      // Check if streaming is available
      if (this.session.promptStreaming) {
        const stream = await this.session.promptStreaming(prompt);
        return stream;
      } else {
        console.log('Streaming not available, falling back to regular prompt');
        const result = await this.generateText(prompt, options);
        // Simulate streaming by returning an async generator
        return (async function* () {
          yield result;
        })();
      }
    } catch (error) {
      console.error('Error in streaming generation:', error);
      throw error;
    }
  }

  /**
   * Count tokens in a prompt (if available)
   */
  async countTokens(text) {
    if (!this.session) {
      await this.createSession();
    }
    
    try {
      if (this.session.countPromptTokens) {
        return await this.session.countPromptTokens(text);
      } else {
        // Rough estimation if method not available
        return Math.ceil(text.length / 4);
      }
    } catch (error) {
      console.error('Error counting tokens:', error);
      // Fallback to rough estimation
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * Generate a character from browsing content
   */
  async generateCharacter(pageData) {
    const prompt = this.buildCharacterPrompt(pageData);
    
    // Use initial prompts for better context
    const options = {
      initialPrompts: [
        {
          role: 'system',
          content: 'You are a creative assistant that generates companion characters based on web content. Always respond with valid JSON.'
        }
      ]
    };
    
    try {
      const response = await this.generateText(prompt, options);
      
      // Try to parse as JSON
      try {
        // Extract JSON from the response (in case there's extra text)
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        console.error('Failed to parse AI response as JSON:', parseError);
        console.log('Raw response:', response);
      }
      
      // If parsing fails, extract key information manually
      return this.extractCharacterFromText(response, pageData);
      
    } catch (error) {
      console.error('Error generating character:', error);
      throw error;
    }
  }

  /**
   * Build a prompt for character generation
   */
  buildCharacterPrompt(pageData) {
    const { title, content, category, domain } = pageData;
    
    // Truncate content to avoid token limits
    const summary = content ? content.slice(0, 500) : '';
    
    return `You are creating a companion character inspired by web content.

Content Title: "${title || 'Untitled'}"
Category: ${category || 'General'}
Domain: ${domain || 'Unknown'}
Summary: ${summary}

Create a unique character with these attributes:
1. Name: A creative, memorable name related to the content theme
2. Type: Choose ONE from [Scholar, Explorer, Guardian, Sage, Inventor]
3. Personality: One defining personality trait (max 5 words)
4. Ability: A special knowledge-based power (max 5 words)
5. Backstory: A one-sentence origin story
6. Visual: Primary color (hex), shape style, and one special feature

Return ONLY valid JSON in this exact format:
{
  "name": "example name",
  "type": "Scholar",
  "personality": "curious and methodical",
  "ability": "Pattern Recognition",
  "backstory": "Born from deep research into quantum mechanics.",
  "visual": {
    "primaryColor": "#4A90E2",
    "shape": "crystalline",
    "feature": "glowing eyes"
  }
}`;
  }

  /**
   * Extract character data from text response (fallback parser)
   */
  extractCharacterFromText(text, pageData) {
    // Default character structure
    const character = {
      name: 'Unknown Companion',
      type: 'Explorer',
      personality: 'curious',
      ability: 'Knowledge Seeking',
      backstory: `Emerged from exploring ${pageData.category || 'the web'}.`,
      visual: {
        primaryColor: '#6B46C1',
        shape: 'geometric',
        feature: 'glowing core'
      }
    };

    // Try to extract name
    const nameMatch = text.match(/name[:\s]+["']?([^"'\n,]+)/i);
    if (nameMatch) character.name = nameMatch[1].trim();

    // Try to extract type
    const types = ['Scholar', 'Explorer', 'Guardian', 'Sage', 'Inventor'];
    const typeMatch = types.find(type => text.toLowerCase().includes(type.toLowerCase()));
    if (typeMatch) character.type = typeMatch;

    // Try to extract personality
    const personalityMatch = text.match(/personality[:\s]+["']?([^"'\n,]+)/i);
    if (personalityMatch) character.personality = personalityMatch[1].trim();

    // Try to extract ability
    const abilityMatch = text.match(/ability[:\s]+["']?([^"'\n,]+)/i);
    if (abilityMatch) character.ability = abilityMatch[1].trim();

    // Try to extract color
    const colorMatch = text.match(/#[0-9A-Fa-f]{6}/);
    if (colorMatch) character.visual.primaryColor = colorMatch[0];

    return character;
  }

  /**
   * Generate insights from browsing data with context
   */
  async generateInsights(browsingData) {
    if (!this.available) {
      return this.generateFallbackInsights(browsingData);
    }

    const prompt = `Analyze this browsing data and provide 3 concise insights:

Total Time: ${browsingData.totalTime} minutes
Categories: ${Object.keys(browsingData.categories).join(', ')}
Deep Focus: ${browsingData.deepFocusTime} minutes
Sites Visited: ${browsingData.uniqueSites.length}

Provide exactly 3 insights, each max 15 words, focusing on:
1. Focus quality
2. Learning patterns
3. Suggestion for improvement

Format as numbered list.`;

    const options = {
      initialPrompts: [
        {
          role: 'system',
          content: 'You are a helpful analytics assistant providing concise, actionable insights about browsing patterns.'
        }
      ],
      temperature: 0.7 // Lower temperature for more consistent insights
    };

    try {
      const response = await this.generateText(prompt, options);
      return this.parseInsights(response);
    } catch (error) {
      console.error('Error generating insights:', error);
      return this.generateFallbackInsights(browsingData);
    }
  }

  /**
   * Parse insights from AI response
   */
  parseInsights(text) {
    const insights = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
      // Look for numbered items or bullet points
      const match = line.match(/^[\d\-\*•]\s*(.+)/);
      if (match) {
        insights.push(match[1].trim());
      }
    });

    // Ensure we have at least 3 insights
    while (insights.length < 3) {
      insights.push('Continue exploring to generate more insights.');
    }

    return insights.slice(0, 3);
  }

  /**
   * Generate fallback insights when AI is not available
   */
  generateFallbackInsights(browsingData) {
    const insights = [];
    
    // Focus quality insight
    const focusPercent = (browsingData.deepFocusTime / browsingData.totalTime) * 100;
    if (focusPercent > 50) {
      insights.push('Excellent deep focus sessions today!');
    } else {
      insights.push('Try longer uninterrupted sessions for deeper learning.');
    }

    // Category diversity
    const categoryCount = Object.keys(browsingData.categories).length;
    if (categoryCount > 5) {
      insights.push('Diverse exploration across many topics.');
    } else if (categoryCount === 1) {
      insights.push('Focused learning in a single domain.');
    } else {
      insights.push(`Balanced exploration across ${categoryCount} categories.`);
    }

    // Time-based suggestion
    if (browsingData.totalTime > 180) {
      insights.push('Remember to take regular breaks!');
    } else if (browsingData.totalTime < 30) {
      insights.push('Spend more time for deeper understanding.');
    } else {
      insights.push('Good session length for focused learning.');
    }

    return insights;
  }

  /**
   * Initialize with user interaction (required for model download)
   */
  async initializeWithUserAction(buttonElement) {
    return new Promise((resolve) => {
      buttonElement.addEventListener('click', async () => {
        // User interaction satisfies the requirement for model download
        const result = await this.initialize();
        resolve(result);
      }, { once: true });
    });
  }

  /**
   * Get system requirements for Chrome AI
   */
  getSystemRequirements() {
    return {
      operatingSystem: [
        'Windows 10 or 11',
        'macOS 13+ (Ventura and onwards)',
        'Linux',
        'ChromeOS (from Platform 16389.0.0 onwards)'
      ],
      storage: 'At least 22 GB of free space',
      gpu: 'Strictly more than 4 GB of VRAM',
      chrome: 'Version 127 or higher',
      network: 'Unmetered connection (metered connections may block download)',
      note: 'Chrome for Android, iOS, and ChromeOS on non-Chromebook Plus devices are not yet supported'
    };
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    
    if (this.session) {
      // Chrome AI sessions are automatically cleaned up
      this.session = null;
    }
    
    this.available = false;
    this.initialized = false;
  }
}

// Singleton instance
let aiServiceInstance = null;

/**
 * Get or create the AI service instance
 */
export function getAIService() {
  if (!aiServiceInstance) {
    aiServiceInstance = new AIService();
  }
  return aiServiceInstance;
}
