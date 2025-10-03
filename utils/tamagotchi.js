// Tamagotchi Pet System

class TamagotchiPet {
  constructor() {
    this.pet = null;
    this.init();
  }

  async init() {
    await this.loadPet();
    if (!this.pet) {
      this.createNewPet();
    }
    this.startLifeCycle();
  }

  async loadPet() {
    try {
      const data = await chrome.storage.local.get('tamagotchiPet');
      if (data.tamagotchiPet) {
        this.pet = data.tamagotchiPet;
        this.updatePetAge();
      }
    } catch (error) {
      console.error('Error loading pet:', error);
    }
  }

  createNewPet() {
    this.pet = {
      name: 'Focus Buddy',
      stage: 'egg', // egg -> baby -> teen -> adult
      born: Date.now(),
      stats: {
        happiness: 50,
        energy: 50,
        knowledge: 0,
        health: 100
      },
      missionsCompleted: 0,
      totalFocusTime: 0,
      lastFed: Date.now(),
      lastPlayed: Date.now(),
      mood: 'neutral', // happy, sad, sleeping, studying, excited
      isAlive: true
    };
    this.savePet();
  }

  async savePet() {
    try {
      await chrome.storage.local.set({ tamagotchiPet: this.pet });
    } catch (error) {
      console.error('Error saving pet:', error);
    }
  }

  updatePetAge() {
    const ageInMs = Date.now() - this.pet.born;
    const ageInHours = ageInMs / (1000 * 60 * 60);
    
    // Update stage based on missions completed
    if (this.pet.missionsCompleted >= 16) {
      this.pet.stage = 'adult';
    } else if (this.pet.missionsCompleted >= 6) {
      this.pet.stage = 'teen';
    } else if (this.pet.missionsCompleted >= 1) {
      this.pet.stage = 'baby';
    }
  }

  startLifeCycle() {
    // Update pet stats every minute
    setInterval(() => {
      this.updateStats();
    }, 60000);
  }

  updateStats() {
    // Decrease happiness and energy over time
    this.pet.stats.happiness = Math.max(0, this.pet.stats.happiness - 1);
    this.pet.stats.energy = Math.max(0, this.pet.stats.energy - 1);
    
    // Update mood based on stats
    if (this.pet.stats.happiness < 20) {
      this.pet.mood = 'sad';
    } else if (this.pet.stats.happiness > 80) {
      this.pet.mood = 'happy';
    } else if (this.pet.stats.energy < 20) {
      this.pet.mood = 'sleeping';
    } else {
      this.pet.mood = 'neutral';
    }
    
    // Check if pet needs care
    if (this.pet.stats.happiness === 0 && this.pet.stats.energy === 0) {
      this.pet.mood = 'sad';
    }
    
    this.savePet();
  }

  // Called when a mission is completed
  async onMissionComplete() {
    this.pet.missionsCompleted++;
    this.pet.stats.happiness = Math.min(100, this.pet.stats.happiness + 20);
    this.pet.stats.energy = Math.min(100, this.pet.stats.energy + 10);
    this.pet.stats.knowledge = Math.min(100, this.pet.stats.knowledge + 5);
    this.pet.mood = 'excited';
    this.pet.lastFed = Date.now();
    
    // Check for evolution
    this.updatePetAge();
    
    await this.savePet();
    return this.pet;
  }

  // Called during deep focus sessions
  async onDeepFocus(duration) {
    this.pet.totalFocusTime += duration;
    this.pet.stats.energy = Math.min(100, this.pet.stats.energy + 15);
    this.pet.stats.knowledge = Math.min(100, this.pet.stats.knowledge + 10);
    this.pet.mood = 'studying';
    this.pet.lastPlayed = Date.now();
    
    await this.savePet();
    return this.pet;
  }

  // Called when browsing educational content
  async onLearning() {
    this.pet.stats.knowledge = Math.min(100, this.pet.stats.knowledge + 3);
    this.pet.mood = 'studying';
    
    await this.savePet();
    return this.pet;
  }

  // Get pet display data
  getPetDisplay() {
    const sprites = {
      egg: {
        neutral: '🥚',
        happy: '🥚',
        sad: '🥚',
        sleeping: '🥚',
        studying: '🥚',
        excited: '🥚'
      },
      baby: {
        neutral: '🐣',
        happy: '😊',
        sad: '😢',
        sleeping: '😴',
        studying: '🤓',
        excited: '🎉'
      },
      teen: {
        neutral: '🐥',
        happy: '😄',
        sad: '😔',
        sleeping: '😪',
        studying: '📚',
        excited: '🎊'
      },
      adult: {
        neutral: '🐤',
        happy: '😁',
        sad: '😞',
        sleeping: '💤',
        studying: '🎓',
        excited: '🏆'
      }
    };

    return {
      sprite: sprites[this.pet.stage][this.pet.mood],
      stage: this.pet.stage,
      mood: this.pet.mood,
      stats: this.pet.stats,
      missionsCompleted: this.pet.missionsCompleted,
      needsAttention: this.pet.stats.happiness < 30 || this.pet.stats.energy < 30
    };
  }

  // Get pet status message
  getStatusMessage() {
    if (this.pet.stage === 'egg') {
      if (this.pet.missionsCompleted === 0) {
        return 'Complete your first mission to hatch me!';
      }
    }
    
    if (this.pet.mood === 'sad') {
      return 'I need some attention... Complete a mission to cheer me up!';
    } else if (this.pet.mood === 'sleeping') {
      return 'Zzz... Taking a quick nap...';
    } else if (this.pet.mood === 'studying') {
      return 'Learning new things with you!';
    } else if (this.pet.mood === 'excited') {
      return 'Yay! Great job on that mission!';
    } else if (this.pet.mood === 'happy') {
      return 'I\'m feeling great! Keep up the good work!';
    }
    
    return `${this.pet.missionsCompleted} missions completed! Let's do more!`;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TamagotchiPet;
}
