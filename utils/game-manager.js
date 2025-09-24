// Game Manager for You Are What You Read Extension

import storageManager from './storage.js';

export class GameManager {
  constructor() {
    this.achievements = {
      first_steps: {
        id: 'first_steps',
        name: 'First Steps',
        description: 'Install the extension and start your journey',
        icon: '👶',
        xp: 10,
        condition: () => true
      },
      knowledge_seeker: {
        id: 'knowledge_seeker',
        name: 'Knowledge Seeker',
        description: 'Read 10 educational articles',
        icon: '📚',
        xp: 50,
        condition: (stats) => stats.educationalReads >= 10
      },
      digital_explorer: {
        id: 'digital_explorer',
        name: 'Digital Explorer',
        description: 'Visit 50 unique domains',
        icon: '🗺️',
        xp: 75,
        condition: (stats) => stats.uniqueDomains >= 50
      },
      focus_master: {
        id: 'focus_master',
        name: 'Focus Master',
        description: 'Spend 2+ hours on productive sites in one day',
        icon: '🎯',
        xp: 100,
        condition: (stats) => stats.dailyProductiveTime >= 120
      },
      social_butterfly: {
        id: 'social_butterfly',
        name: 'Social Butterfly',
        description: 'Visit 5 different social media platforms',
        icon: '🦋',
        xp: 30,
        condition: (stats) => stats.socialPlatforms >= 5
      },
      night_owl: {
        id: 'night_owl',
        name: 'Night Owl',
        description: 'Browse after midnight for 3 consecutive days',
        icon: '🦉',
        xp: 40,
        condition: (stats) => stats.nightStreaks >= 3
      },
      early_bird: {
        id: 'early_bird',
        name: 'Early Bird',
        description: 'Start browsing before 6 AM',
        icon: '🐦',
        xp: 40,
        condition: (stats) => stats.earlyMorningBrowsing >= 1
      },
      week_warrior: {
        id: 'week_warrior',
        name: 'Week Warrior',
        description: 'Maintain a 7-day streak',
        icon: '⚔️',
        xp: 150,
        condition: (stats) => stats.streak >= 7
      },
      speed_reader: {
        id: 'speed_reader',
        name: 'Speed Reader',
        description: 'Read 5 articles in under 30 minutes',
        icon: '⚡',
        xp: 60,
        condition: (stats) => stats.speedReading >= 5
      },
      polyglot: {
        id: 'polyglot',
        name: 'Polyglot',
        description: 'Read content in 3 different languages',
        icon: '🌍',
        xp: 80,
        condition: (stats) => stats.languages >= 3
      }
    };

    this.petMoods = {
      Happy: { energy: 10, happiness: 20 },
      Curious: { energy: 5, happiness: 10 },
      Excited: { energy: 15, happiness: 15 },
      Focused: { energy: -5, happiness: 5 },
      Tired: { energy: -20, happiness: -10 },
      Playful: { energy: 10, happiness: 15 }
    };

    this.petTypes = {
      explorer: { preferredCategories: ['news', 'other'], personality: 'adventurous' },
      scholar: { preferredCategories: ['education', 'development'], personality: 'studious' },
      social: { preferredCategories: ['social'], personality: 'friendly' },
      creative: { preferredCategories: ['entertainment'], personality: 'artistic' },
      gamer: { preferredCategories: ['entertainment', 'development'], personality: 'playful' }
    };
  }

  // Initialize game state
  async initializeGameState() {
    await storageManager.initialize();
    const gameState = await storageManager.getGameState();
    
    // Check for daily reset
    await this.checkDailyReset();
    
    return gameState;
  }

  // Get current game state
  async getGameState() {
    const gameState = await storageManager.getGameState();
    const achievements = await storageManager.getAchievements();
    const dailyQuests = await storageManager.getDailyQuests();
    
    return {
      ...gameState,
      achievements: achievements.unlocked,
      dailyQuests
    };
  }

  // Process a browsing session
  async processSession(sessionData) {
    const gameState = await storageManager.getGameState();
    
    // Calculate XP based on session
    const xp = this.calculateSessionXP(sessionData);
    
    // Update XP and check for level up
    const newXP = gameState.currentXP + xp;
    let newLevel = gameState.level;
    let newMaxXP = gameState.maxXP;
    
    if (newXP >= gameState.maxXP) {
      newLevel++;
      newMaxXP = Math.round(gameState.maxXP * 1.5);
      
      // Level up bonus
      await this.triggerLevelUp(newLevel);
    }
    
    // Update mood pet based on browsing
    const petUpdate = await this.updatePetFromSession(sessionData, gameState.moodPet);
    
    // Update game state
    await storageManager.updateGameState({
      currentXP: newXP >= gameState.maxXP ? newXP - gameState.maxXP : newXP,
      level: newLevel,
      maxXP: newMaxXP,
      moodPet: petUpdate
    });
    
    // Check quest progress
    await this.updateQuestProgress(sessionData);
    
    return { xpGained: xp, newLevel, leveledUp: newLevel > gameState.level };
  }

  // Calculate XP from session
  calculateSessionXP(session) {
    let xp = 5; // Base XP
    
    // Time bonus (1 XP per minute, max 30)
    const minutes = Math.min(session.timeSpent / 60000, 30);
    xp += Math.floor(minutes);
    
    // Category bonuses
    const categoryBonus = {
      education: 10,
      development: 8,
      news: 5,
      article: 7,
      social: 3,
      entertainment: 4,
      shopping: 2,
      other: 3
    };
    
    xp += categoryBonus[session.category] || 3;
    
    // Engagement bonus
    if (session.engagement) {
      if (session.engagement.scrollDepth > 75) xp += 5;
      if (session.engagement.highlights?.length > 0) xp += 3;
    }
    
    return xp;
  }

  // Update pet mood from session
  async updatePetFromSession(session, currentPet) {
    let mood = currentPet.mood;
    let energy = currentPet.energy || 100;
    let happiness = currentPet.happiness || 100;
    
    // Determine mood based on category
    const categoryMoods = {
      education: 'Focused',
      development: 'Focused',
      social: 'Happy',
      entertainment: 'Playful',
      news: 'Curious',
      shopping: 'Excited'
    };
    
    mood = categoryMoods[session.category] || 'Curious';
    
    // Apply mood effects
    const moodEffect = this.petMoods[mood];
    energy = Math.max(0, Math.min(100, energy + moodEffect.energy));
    happiness = Math.max(0, Math.min(100, happiness + moodEffect.happiness));
    
    // Evolve pet type based on browsing patterns
    const type = await this.evolvePetType(session.category, currentPet.type);
    
    return {
      ...currentPet,
      mood,
      energy,
      happiness,
      type
    };
  }

  // Evolve pet type based on browsing
  async evolvePetType(category, currentType) {
    // Get browsing history stats
    const history = await storageManager.getTodaysBrowsing();
    const categoryCounts = {};
    
    history.forEach(session => {
      categoryCounts[session.category] = (categoryCounts[session.category] || 0) + 1;
    });
    
    // Find dominant category
    let dominantCategory = category;
    let maxCount = 0;
    
    for (const [cat, count] of Object.entries(categoryCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantCategory = cat;
      }
    }
    
    // Map category to pet type
    const categoryToPetType = {
      education: 'scholar',
      development: 'scholar',
      social: 'social',
      entertainment: 'creative',
      news: 'explorer',
      shopping: 'explorer',
      other: 'explorer'
    };
    
    return categoryToPetType[dominantCategory] || currentType;
  }

  // Check and award achievements
  async checkAchievements(sessionData) {
    const stats = await this.calculateStats();
    const currentAchievements = await storageManager.getAchievements();
    const newAchievements = [];
    
    for (const [id, achievement] of Object.entries(this.achievements)) {
      if (!currentAchievements.unlocked.includes(id)) {
        if (achievement.condition(stats)) {
          const isNew = await storageManager.unlockAchievement(id);
          if (isNew) {
            newAchievements.push(achievement);
            
            // Award XP for achievement
            const gameState = await storageManager.getGameState();
            await storageManager.updateGameState({
              currentXP: gameState.currentXP + achievement.xp
            });
          }
        }
      }
    }
    
    return newAchievements;
  }

  // Calculate user stats for achievements
  async calculateStats() {
    const history = await storageManager.get('browsingHistory') || [];
    const gameState = await storageManager.getGameState();
    
    const stats = {
      educationalReads: 0,
      uniqueDomains: new Set(),
      dailyProductiveTime: 0,
      socialPlatforms: new Set(),
      nightStreaks: 0,
      earlyMorningBrowsing: 0,
      streak: gameState.streak || 0,
      speedReading: 0,
      languages: new Set()
    };
    
    // Process history
    history.forEach(session => {
      if (session.category === 'education') stats.educationalReads++;
      stats.uniqueDomains.add(session.domain);
      
      const hour = new Date(session.timestamp).getHours();
      if (hour >= 0 && hour < 6) stats.earlyMorningBrowsing++;
      
      if (session.category === 'education' || session.category === 'development') {
        stats.dailyProductiveTime += session.timeSpent / 60000;
      }
      
      // Check for social platforms
      const socialDomains = ['facebook', 'twitter', 'instagram', 'linkedin', 'reddit'];
      socialDomains.forEach(social => {
        if (session.domain?.includes(social)) {
          stats.socialPlatforms.add(social);
        }
      });
    });
    
    // Convert sets to counts
    stats.uniqueDomains = stats.uniqueDomains.size;
    stats.socialPlatforms = stats.socialPlatforms.size;
    stats.languages = stats.languages.size;
    
    return stats;
  }

  // Update quest progress
  async updateQuestProgress(sessionData) {
    const quests = await storageManager.getDailyQuests();
    
    for (const quest of quests) {
      if (quest.completed) continue;
      
      let progressUpdate = 0;
      
      switch (quest.type) {
        case 'category_diversity':
          // Track unique categories visited
          progressUpdate = 1; // Simplified for now
          break;
          
        case 'learning_time':
          if (sessionData.category === 'education' || sessionData.category === 'development') {
            progressUpdate = Math.floor(sessionData.timeSpent / 60000);
          }
          break;
          
        case 'new_sites':
          // Check if this is a new domain
          progressUpdate = 1; // Simplified
          break;
          
        case 'focus_session':
          if (sessionData.timeSpent >= 15 * 60000) {
            progressUpdate = 15;
          }
          break;
      }
      
      if (progressUpdate > 0) {
        const newProgress = Math.min(quest.progress + progressUpdate, quest.target);
        await storageManager.updateQuestProgress(quest.id, newProgress);
        
        // Check if quest completed
        if (newProgress >= quest.target && !quest.completed) {
          await this.completeQuest(quest);
        }
      }
    }
  }

  // Complete a quest
  async completeQuest(quest) {
    // Award XP
    const gameState = await storageManager.getGameState();
    await storageManager.updateGameState({
      currentXP: gameState.currentXP + quest.xp
    });
    
    // Mark as completed
    quest.completed = true;
    
    return quest;
  }

  // Check and update streak
  async checkAndUpdateStreak() {
    const gameState = await storageManager.getGameState();
    const today = new Date().toDateString();
    const lastActive = gameState.lastActiveDate;
    
    if (lastActive === today) {
      // Already active today
      return gameState.streak;
    }
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = yesterday.toDateString();
    
    let newStreak = gameState.streak;
    
    if (lastActive === yesterdayString) {
      // Continuing streak
      newStreak++;
    } else {
      // Streak broken
      newStreak = 1;
    }
    
    await storageManager.updateGameState({
      streak: newStreak,
      lastActiveDate: today
    });
    
    return newStreak;
  }

  // Increment streak (called when diary is generated)
  async incrementStreak() {
    const gameState = await storageManager.getGameState();
    const today = new Date().toDateString();
    
    if (gameState.lastActiveDate !== today) {
      await storageManager.updateGameState({
        streak: gameState.streak + 1,
        lastActiveDate: today
      });
    }
  }

  // Check for daily reset
  async checkDailyReset() {
    const gameState = await storageManager.getGameState();
    const today = new Date().toDateString();
    
    if (gameState.lastActiveDate !== today) {
      // Reset daily values
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (gameState.lastActiveDate !== yesterday.toDateString()) {
        // Streak broken
        await storageManager.updateGameState({
          streak: 0
        });
      }
      
      // Generate new daily quests
      await storageManager.getDailyQuests();
    }
  }

  // Trigger level up effects
  async triggerLevelUp(newLevel) {
    // Could add special rewards or unlock features at certain levels
    const milestones = {
      5: { reward: 'New pet costume unlocked!', xpBonus: 50 },
      10: { reward: 'Master Explorer title earned!', xpBonus: 100 },
      20: { reward: 'Legendary Reader status achieved!', xpBonus: 200 }
    };

    if (milestones[newLevel]) {
      const gameState = await storageManager.getGameState();
      await storageManager.updateGameState({
        currentXP: gameState.currentXP + milestones[newLevel].xpBonus
      });
      return milestones[newLevel];
    }

    return null;
  }

  // Claim an achievement
  async claimAchievement(achievementId) {
    const achievement = this.achievements[achievementId];
    if (!achievement) return null;

    const isNew = await storageManager.unlockAchievement(achievementId);
    if (isNew) {
      // Award XP
      const gameState = await storageManager.getGameState();
      await storageManager.updateGameState({
        currentXP: gameState.currentXP + achievement.xp
      });
    }

    return achievement;
  }

  // Update mood pet manually
  async updateMoodPet(mood) {
    const gameState = await storageManager.getGameState();
    const pet = gameState.moodPet;

    const moodEffect = this.petMoods[mood];
    if (moodEffect) {
      pet.mood = mood;
      pet.energy = Math.max(0, Math.min(100, pet.energy + moodEffect.energy));
      pet.happiness = Math.max(0, Math.min(100, pet.happiness + moodEffect.happiness));

      await storageManager.updateGameState({
        moodPet: pet
      });
    }

    return pet;
  }
}

// Export singleton instance
export default new GameManager();
