// Character Storage - IndexedDB management for AI companions

const DB_NAME = 'AttentionCompanions';
const DB_VERSION = 1;

export class CharacterStorage {
  constructor() {
    this.db = null;
    this.initialized = false;
  }

  /**
   * Initialize the database
   */
  async init() {
    if (this.initialized) return true;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        this.initialized = true;
        console.log('Character storage initialized');
        resolve(true);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create characters store
        if (!db.objectStoreNames.contains('characters')) {
          const characterStore = db.createObjectStore('characters', { keyPath: 'id' });
          
          // Create indexes for efficient queries
          characterStore.createIndex('domain', 'domain', { unique: false });
          characterStore.createIndex('category', 'category', { unique: false });
          characterStore.createIndex('type', 'type', { unique: false });
          characterStore.createIndex('evolution', 'evolution', { unique: false });
          characterStore.createIndex('rarity', 'rarity', { unique: false });
          characterStore.createIndex('birthDate', 'birthDate', { unique: false });
          characterStore.createIndex('level', 'level', { unique: false });
        }
        
        // Create sessions store for tracking character-generating sessions
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('characterId', 'characterId', { unique: false });
          sessionStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        
        // Create collections store for user-defined character groups
        if (!db.objectStoreNames.contains('collections')) {
          const collectionStore = db.createObjectStore('collections', { keyPath: 'id' });
          collectionStore.createIndex('name', 'name', { unique: true });
          collectionStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        
        console.log('Database schema created/updated');
      };
    });
  }

  /**
   * Save a new character
   */
  async saveCharacter(character) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['characters'], 'readwrite');
      const store = transaction.objectStore('characters');
      const request = store.add(character);
      
      request.onsuccess = () => {
        console.log('Character saved:', character.name);
        resolve(character);
      };
      
      request.onerror = () => {
        console.error('Failed to save character:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Update an existing character
   */
  async updateCharacter(character) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['characters'], 'readwrite');
      const store = transaction.objectStore('characters');
      const request = store.put(character);
      
      request.onsuccess = () => {
        console.log('Character updated:', character.name);
        resolve(character);
      };
      
      request.onerror = () => {
        console.error('Failed to update character:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get a character by ID
   */
  async getCharacter(id) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['characters'], 'readonly');
      const store = transaction.objectStore('characters');
      const request = store.get(id);
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get all characters
   */
  async getAllCharacters() {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['characters'], 'readonly');
      const store = transaction.objectStore('characters');
      const request = store.getAll();
      
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get characters by category
   */
  async getCharactersByCategory(category) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['characters'], 'readonly');
      const store = transaction.objectStore('characters');
      const index = store.index('category');
      const request = index.getAll(category);
      
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get characters by type
   */
  async getCharactersByType(type) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['characters'], 'readonly');
      const store = transaction.objectStore('characters');
      const index = store.index('type');
      const request = index.getAll(type);
      
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get characters by rarity
   */
  async getCharactersByRarity(rarity) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['characters'], 'readonly');
      const store = transaction.objectStore('characters');
      const index = store.index('rarity');
      const request = index.getAll(rarity);
      
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get recent characters
   */
  async getRecentCharacters(limit = 10) {
    await this.init();
    
    const allCharacters = await this.getAllCharacters();
    
    // Sort by birthDate descending and return limited results
    return allCharacters
      .sort((a, b) => b.birthDate - a.birthDate)
      .slice(0, limit);
  }

  /**
   * Get character statistics
   */
  async getCharacterStats() {
    await this.init();
    
    const characters = await this.getAllCharacters();
    
    const stats = {
      total: characters.length,
      byType: {},
      byCategory: {},
      byRarity: {},
      byEvolution: {},
      averageLevel: 0,
      totalKnowledgePoints: 0,
      mostExperienced: null
    };
    
    let totalLevel = 0;
    let maxExperience = 0;
    
    characters.forEach(char => {
      // Count by type
      stats.byType[char.type] = (stats.byType[char.type] || 0) + 1;
      
      // Count by category
      stats.byCategory[char.category] = (stats.byCategory[char.category] || 0) + 1;
      
      // Count by rarity
      stats.byRarity[char.rarity] = (stats.byRarity[char.rarity] || 0) + 1;
      
      // Count by evolution
      stats.byEvolution[char.evolution] = (stats.byEvolution[char.evolution] || 0) + 1;
      
      // Sum levels and knowledge points
      totalLevel += char.level || 1;
      stats.totalKnowledgePoints += char.stats?.knowledgePoints || 0;
      
      // Find most experienced
      const totalExp = (char.level - 1) * 100 + char.experience;
      if (totalExp > maxExperience) {
        maxExperience = totalExp;
        stats.mostExperienced = char;
      }
    });
    
    stats.averageLevel = characters.length > 0 ? totalLevel / characters.length : 0;
    
    return stats;
  }

  /**
   * Delete a character
   */
  async deleteCharacter(id) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['characters'], 'readwrite');
      const store = transaction.objectStore('characters');
      const request = store.delete(id);
      
      request.onsuccess = () => {
        console.log('Character deleted:', id);
        resolve(true);
      };
      
      request.onerror = () => {
        console.error('Failed to delete character:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Save a session that generated a character
   */
  async saveSession(sessionData) {
    await this.init();
    
    const session = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...sessionData,
      timestamp: Date.now()
    };
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sessions'], 'readwrite');
      const store = transaction.objectStore('sessions');
      const request = store.add(session);
      
      request.onsuccess = () => resolve(session);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get sessions for a character
   */
  async getCharacterSessions(characterId) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      const index = store.index('characterId');
      const request = index.getAll(characterId);
      
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Create a collection
   */
  async createCollection(name, description = '') {
    await this.init();
    
    const collection = {
      id: `col_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      characterIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['collections'], 'readwrite');
      const store = transaction.objectStore('collections');
      const request = store.add(collection);
      
      request.onsuccess = () => resolve(collection);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Add character to collection
   */
  async addToCollection(collectionId, characterId) {
    await this.init();
    
    return new Promise(async (resolve, reject) => {
      const transaction = this.db.transaction(['collections'], 'readwrite');
      const store = transaction.objectStore('collections');
      
      // Get the collection
      const getRequest = store.get(collectionId);
      
      getRequest.onsuccess = () => {
        const collection = getRequest.result;
        if (!collection) {
          reject(new Error('Collection not found'));
          return;
        }
        
        // Add character ID if not already present
        if (!collection.characterIds.includes(characterId)) {
          collection.characterIds.push(characterId);
          collection.updatedAt = Date.now();
          
          // Update the collection
          const putRequest = store.put(collection);
          putRequest.onsuccess = () => resolve(collection);
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve(collection);
        }
      };
      
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Export all data
   */
  async exportData() {
    await this.init();
    
    const data = {
      version: DB_VERSION,
      exportDate: Date.now(),
      characters: await this.getAllCharacters(),
      sessions: await this.getAllSessions(),
      collections: await this.getAllCollections()
    };
    
    return data;
  }

  /**
   * Import data
   */
  async importData(data) {
    await this.init();
    
    // Clear existing data
    await this.clearAllData();
    
    // Import characters
    for (const character of data.characters || []) {
      await this.saveCharacter(character);
    }
    
    // Import sessions
    for (const session of data.sessions || []) {
      await this.saveSession(session);
    }
    
    // Import collections
    for (const collection of data.collections || []) {
      await this.saveCollection(collection);
    }
    
    return true;
  }

  /**
   * Clear all data
   */
  async clearAllData() {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['characters', 'sessions', 'collections'], 'readwrite');
      
      transaction.objectStore('characters').clear();
      transaction.objectStore('sessions').clear();
      transaction.objectStore('collections').clear();
      
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Helper: Get all sessions
   */
  async getAllSessions() {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Helper: Get all collections
   */
  async getAllCollections() {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['collections'], 'readonly');
      const store = transaction.objectStore('collections');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Helper: Save collection
   */
  async saveCollection(collection) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['collections'], 'readwrite');
      const store = transaction.objectStore('collections');
      const request = store.add(collection);
      
      request.onsuccess = () => resolve(collection);
      request.onerror = () => reject(request.error);
    });
  }
}

// Singleton instance
let storageInstance = null;

/**
 * Get or create the character storage instance
 */
export function getCharacterStorage() {
  if (!storageInstance) {
    storageInstance = new CharacterStorage();
  }
  return storageInstance;
}
