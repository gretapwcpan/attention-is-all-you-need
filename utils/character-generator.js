// Character Generator - Creates AI companions from browsing content

import { getAIService } from './ai-service.js';

export class CharacterGenerator {
  constructor() {
    this.aiService = getAIService();
    this.types = ['Scholar', 'Explorer', 'Guardian', 'Sage', 'Inventor'];
    this.initialized = false;
  }

  /**
   * Initialize the generator
   */
  async initialize() {
    if (this.initialized) return true;
    
    const available = await this.aiService.initialize();
    this.initialized = true;
    
    if (!available) {
      console.log('AI not available, using fallback character generation');
    }
    
    return available;
  }

  /**
   * Generate a character from page content
   */
  async generateFromContent(pageData) {
    await this.initialize();
    
    // Enrich page data with category if not present
    if (!pageData.category) {
      pageData.category = this.detectCategory(pageData);
    }
    
    try {
      // Try AI generation first
      const aiAvailable = await this.aiService.checkAvailability();
      
      if (aiAvailable) {
        const character = await this.aiService.generateCharacter(pageData);
        return this.enrichCharacter(character, pageData);
      }
    } catch (error) {
      console.error('AI generation failed, using fallback:', error);
    }
    
    // Fallback to template-based generation
    return this.generateFallback(pageData);
  }

  /**
   * Enrich character with additional metadata
   */
  enrichCharacter(character, pageData) {
    return {
      id: this.generateId(),
      ...character,
      domain: pageData.domain || 'unknown',
      category: pageData.category || 'General',
      birthDate: Date.now(),
      birthUrl: pageData.url,
      birthTitle: pageData.title,
      evolution: 'base',
      level: 1,
      experience: 0,
      stats: {
        sessionCount: 1,
        totalTime: 0,
        knowledgePoints: 10,
        focusBonus: 0
      },
      traits: this.generateTraits(character.type),
      rarity: this.calculateRarity(character)
    };
  }

  /**
   * Generate fallback character when AI is unavailable
   */
  generateFallback(pageData) {
    const templates = this.getTemplates();
    const category = pageData.category || 'General';
    const template = templates[category] || templates['General'];
    
    // Select random elements from template
    const name = this.selectRandom(template.names);
    const suffix = Math.floor(Math.random() * 999);
    const type = this.selectRandom(this.types);
    const ability = this.selectRandom(template.abilities);
    const personality = this.selectRandom(template.personalities);
    const color = this.generateColor(category);
    
    const character = {
      name: `${name}-${suffix}`,
      type: type,
      personality: personality,
      ability: ability,
      backstory: `Emerged from your exploration of ${category.toLowerCase()} knowledge.`,
      visual: {
        primaryColor: color,
        shape: this.selectRandom(['crystalline', 'geometric', 'organic', 'ethereal']),
        feature: this.selectRandom(['glowing core', 'floating particles', 'energy rings', 'data streams'])
      }
    };
    
    return this.enrichCharacter(character, pageData);
  }

  /**
   * Get character templates for fallback generation
   */
  getTemplates() {
    return {
      'Technology': {
        names: ['Byte', 'Pixel', 'Circuit', 'Data', 'Quantum', 'Binary', 'Nexus', 'Core'],
        abilities: ['Code Analysis', 'Bug Detection', 'System Optimization', 'Data Mining', 'Pattern Matching'],
        personalities: ['logical and precise', 'curious and analytical', 'efficient and focused', 'innovative and bold']
      },
      'Science': {
        names: ['Nova', 'Atom', 'Photon', 'Neutron', 'Cosmos', 'Quark', 'Helix', 'Fusion'],
        abilities: ['Hypothesis Formation', 'Data Synthesis', 'Pattern Discovery', 'Theory Building', 'Experiment Design'],
        personalities: ['methodical and thorough', 'inquisitive and persistent', 'theoretical and abstract', 'empirical and practical']
      },
      'Learning': {
        names: ['Scholar', 'Sage', 'Mentor', 'Guide', 'Wisdom', 'Knowledge', 'Insight', 'Oracle'],
        abilities: ['Knowledge Absorption', 'Memory Enhancement', 'Concept Linking', 'Deep Understanding', 'Quick Learning'],
        personalities: ['patient and wise', 'eager and enthusiastic', 'thoughtful and deep', 'curious and open']
      },
      'Development': {
        names: ['Builder', 'Architect', 'Creator', 'Forge', 'Craft', 'Design', 'Framework', 'Stack'],
        abilities: ['Problem Solving', 'Architecture Design', 'Code Generation', 'Debug Mastery', 'Optimization'],
        personalities: ['creative and resourceful', 'systematic and organized', 'pragmatic and efficient', 'innovative and daring']
      },
      'Research': {
        names: ['Seeker', 'Explorer', 'Pioneer', 'Discovery', 'Quest', 'Probe', 'Survey', 'Deep'],
        abilities: ['Deep Diving', 'Connection Finding', 'Source Verification', 'Insight Generation', 'Truth Seeking'],
        personalities: ['thorough and meticulous', 'adventurous and bold', 'skeptical and rigorous', 'open and curious']
      },
      'General': {
        names: ['Echo', 'Spark', 'Flow', 'Pulse', 'Wave', 'Drift', 'Glow', 'Shift'],
        abilities: ['Adaptation', 'Learning', 'Observation', 'Analysis', 'Synthesis'],
        personalities: ['balanced and steady', 'flexible and adaptive', 'observant and quiet', 'friendly and helpful']
      }
    };
  }

  /**
   * Detect category from page data
   */
  detectCategory(pageData) {
    const { url, title, content } = pageData;
    const text = `${title} ${content}`.toLowerCase();
    
    // Category keywords
    const categories = {
      'Technology': ['code', 'programming', 'software', 'tech', 'computer', 'digital', 'app', 'web'],
      'Science': ['science', 'research', 'study', 'experiment', 'theory', 'physics', 'chemistry', 'biology'],
      'Learning': ['learn', 'course', 'tutorial', 'education', 'teach', 'lesson', 'guide', 'how to'],
      'Development': ['github', 'stackoverflow', 'npm', 'framework', 'library', 'api', 'development', 'coding'],
      'Research': ['paper', 'journal', 'academic', 'scholar', 'publication', 'thesis', 'dissertation', 'peer']
    };
    
    // Count keyword matches
    let bestCategory = 'General';
    let bestScore = 0;
    
    for (const [category, keywords] of Object.entries(categories)) {
      let score = 0;
      keywords.forEach(keyword => {
        if (text.includes(keyword)) score++;
      });
      
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    }
    
    return bestCategory;
  }

  /**
   * Generate traits based on character type
   */
  generateTraits(type) {
    const traitMap = {
      'Scholar': ['studious', 'analytical', 'knowledgeable'],
      'Explorer': ['adventurous', 'curious', 'brave'],
      'Guardian': ['protective', 'loyal', 'steadfast'],
      'Sage': ['wise', 'insightful', 'patient'],
      'Inventor': ['creative', 'innovative', 'resourceful']
    };
    
    return traitMap[type] || ['unique', 'special', 'mysterious'];
  }

  /**
   * Calculate character rarity
   */
  calculateRarity(character) {
    // Simple rarity calculation based on randomness
    const rand = Math.random();
    
    if (rand < 0.6) return 'common';
    if (rand < 0.85) return 'uncommon';
    if (rand < 0.95) return 'rare';
    if (rand < 0.99) return 'epic';
    return 'legendary';
  }

  /**
   * Generate a color based on category
   */
  generateColor(category) {
    const colorMap = {
      'Technology': ['#00D4FF', '#00FF88', '#7B61FF', '#FF006E'],
      'Science': ['#4A90E2', '#7B68EE', '#00CED1', '#9370DB'],
      'Learning': ['#FFD700', '#FFA500', '#FF6347', '#FF69B4'],
      'Development': ['#00FF00', '#32CD32', '#00FA9A', '#7FFF00'],
      'Research': ['#8A2BE2', '#9400D3', '#8B008B', '#9932CC'],
      'General': ['#808080', '#A9A9A9', '#C0C0C0', '#D3D3D3']
    };
    
    const colors = colorMap[category] || colorMap['General'];
    return this.selectRandom(colors);
  }

  /**
   * Generate unique character ID
   */
  generateId() {
    return `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Select random element from array
   */
  selectRandom(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Check if character should spawn (based on session quality)
   */
  shouldSpawnCharacter(sessionData) {
    const { duration, focusType } = sessionData;
    
    // Always spawn for deep focus sessions
    if (focusType === 'deep') return true;
    
    // High chance for active reading
    if (focusType === 'active') return Math.random() < 0.8;
    
    // Lower chance for scanning, but increase with duration
    if (focusType === 'scanning') {
      const minutes = duration / 60000;
      return Math.random() < (0.3 + (minutes * 0.1));
    }
    
    return false;
  }

  /**
   * Evolve character based on progress
   */
  evolveCharacter(character, sessionData) {
    const updatedCharacter = { ...character };
    
    // Update stats
    updatedCharacter.stats.sessionCount++;
    updatedCharacter.stats.totalTime += sessionData.duration;
    
    // Add experience
    const expGained = this.calculateExperience(sessionData);
    updatedCharacter.experience += expGained;
    updatedCharacter.stats.knowledgePoints += Math.floor(expGained / 10);
    
    // Check for level up
    const requiredExp = updatedCharacter.level * 100;
    if (updatedCharacter.experience >= requiredExp) {
      updatedCharacter.level++;
      updatedCharacter.experience -= requiredExp;
      
      // Check for evolution
      if (updatedCharacter.level === 5 && updatedCharacter.evolution === 'base') {
        updatedCharacter.evolution = 'advanced';
        updatedCharacter.visual.feature = 'radiant aura';
      } else if (updatedCharacter.level === 10 && updatedCharacter.evolution === 'advanced') {
        updatedCharacter.evolution = 'master';
        updatedCharacter.visual.feature = 'cosmic energy';
      }
    }
    
    return updatedCharacter;
  }

  /**
   * Calculate experience gained from session
   */
  calculateExperience(sessionData) {
    const { duration, focusType } = sessionData;
    const minutes = duration / 60000;
    
    const multipliers = {
      'deep': 3,
      'active': 2,
      'scanning': 1
    };
    
    const multiplier = multipliers[focusType] || 1;
    return Math.floor(minutes * 10 * multiplier);
  }
}

// Singleton instance
let generatorInstance = null;

/**
 * Get or create the character generator instance
 */
export function getCharacterGenerator() {
  if (!generatorInstance) {
    generatorInstance = new CharacterGenerator();
  }
  return generatorInstance;
}
