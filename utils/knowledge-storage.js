/**
 * Knowledge Storage Module
 * Manages persistent storage of knowledge graph data using chrome.storage.local
 */

export class KnowledgeStorage {
  constructor() {
    this.STORAGE_KEY = 'knowledge_nodes';
    this.INDEX_KEY = 'concept_index';
    this.TIMELINE_KEY = 'knowledge_timeline';
    this.MAX_NODES = 500; // Keep last 500 nodes to manage storage
    this.initialized = false;
  }

  /**
   * Initialize storage and check capacity
   */
  async initialize() {
    if (this.initialized) return true;
    
    try {
      // Check current storage usage
      const data = await chrome.storage.local.get(null);
      const storageSize = JSON.stringify(data).length;
      console.log(`Knowledge Storage initialized. Current size: ${(storageSize / 1024).toFixed(2)}KB`);
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize Knowledge Storage:', error);
      return false;
    }
  }

  /**
   * Save a knowledge node to storage
   */
  async saveNode(node) {
    try {
      // Get existing data
      const data = await chrome.storage.local.get([
        this.STORAGE_KEY, 
        this.INDEX_KEY, 
        this.TIMELINE_KEY
      ]);
      
      const nodes = data[this.STORAGE_KEY] || [];
      const index = data[this.INDEX_KEY] || {};
      const timeline = data[this.TIMELINE_KEY] || {};
      
      // Add new node
      nodes.push(node);
      
      // Update concept index
      for (const concept of node.concepts) {
        const normalizedConcept = concept.toLowerCase().trim();
        if (!index[normalizedConcept]) {
          index[normalizedConcept] = [];
        }
        if (!index[normalizedConcept].includes(node.id)) {
          index[normalizedConcept].push(node.id);
        }
      }
      
      // Update timeline
      const dateKey = node.date;
      if (!timeline[dateKey]) {
        timeline[dateKey] = [];
      }
      timeline[dateKey].push(node.id);
      
      // Trim old nodes if needed
      if (nodes.length > this.MAX_NODES) {
        const removedNodes = nodes.splice(0, nodes.length - this.MAX_NODES);
        
        // Clean up index for removed nodes
        for (const removedNode of removedNodes) {
          for (const concept of removedNode.concepts) {
            const normalizedConcept = concept.toLowerCase().trim();
            if (index[normalizedConcept]) {
              index[normalizedConcept] = index[normalizedConcept].filter(
                id => id !== removedNode.id
              );
              if (index[normalizedConcept].length === 0) {
                delete index[normalizedConcept];
              }
            }
          }
          
          // Clean up timeline
          const dateKey = removedNode.date;
          if (timeline[dateKey]) {
            timeline[dateKey] = timeline[dateKey].filter(
              id => id !== removedNode.id
            );
            if (timeline[dateKey].length === 0) {
              delete timeline[dateKey];
            }
          }
        }
        
        console.log(`Trimmed ${removedNodes.length} old nodes to maintain storage limit`);
      }
      
      // Save back to storage
      await chrome.storage.local.set({
        [this.STORAGE_KEY]: nodes,
        [this.INDEX_KEY]: index,
        [this.TIMELINE_KEY]: timeline
      });
      
      console.log(`Saved node: ${node.title} with ${node.concepts.length} concepts`);
      return true;
      
    } catch (error) {
      console.error('Error saving knowledge node:', error);
      throw error;
    }
  }

  /**
   * Get recent nodes within specified days
   */
  async getRecentNodes(days) {
    try {
      const data = await chrome.storage.local.get(this.STORAGE_KEY);
      const nodes = data[this.STORAGE_KEY] || [];
      
      const cutoffDate = Date.now() - (days * 24 * 60 * 60 * 1000);
      const recentNodes = nodes.filter(node => node.timestamp > cutoffDate);
      
      console.log(`Retrieved ${recentNodes.length} nodes from last ${days} days`);
      return recentNodes;
      
    } catch (error) {
      console.error('Error getting recent nodes:', error);
      return [];
    }
  }

  /**
   * Get all nodes
   */
  async getAllNodes() {
    try {
      const data = await chrome.storage.local.get(this.STORAGE_KEY);
      return data[this.STORAGE_KEY] || [];
    } catch (error) {
      console.error('Error getting all nodes:', error);
      return [];
    }
  }

  /**
   * Get nodes by concept
   */
  async getNodesByConcept(concept) {
    try {
      const data = await chrome.storage.local.get([this.STORAGE_KEY, this.INDEX_KEY]);
      const nodes = data[this.STORAGE_KEY] || [];
      const index = data[this.INDEX_KEY] || {};
      
      const normalizedConcept = concept.toLowerCase().trim();
      const nodeIds = index[normalizedConcept] || [];
      
      const matchingNodes = nodes.filter(node => nodeIds.includes(node.id));
      console.log(`Found ${matchingNodes.length} nodes for concept: ${concept}`);
      
      return matchingNodes;
      
    } catch (error) {
      console.error('Error getting nodes by concept:', error);
      return [];
    }
  }

  /**
   * Get nodes by date
   */
  async getNodesByDate(date) {
    try {
      const data = await chrome.storage.local.get([this.STORAGE_KEY, this.TIMELINE_KEY]);
      const nodes = data[this.STORAGE_KEY] || [];
      const timeline = data[this.TIMELINE_KEY] || {};
      
      const dateKey = typeof date === 'string' ? date : date.toDateString();
      const nodeIds = timeline[dateKey] || [];
      
      return nodes.filter(node => nodeIds.includes(node.id));
      
    } catch (error) {
      console.error('Error getting nodes by date:', error);
      return [];
    }
  }

  /**
   * Get timeline of learning
   */
  async getTimeline(days = 30) {
    try {
      const data = await chrome.storage.local.get(this.TIMELINE_KEY);
      const timeline = data[this.TIMELINE_KEY] || {};
      
      // Filter to recent days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const recentTimeline = {};
      for (const [date, nodeIds] of Object.entries(timeline)) {
        if (new Date(date) >= cutoffDate) {
          recentTimeline[date] = nodeIds;
        }
      }
      
      return recentTimeline;
      
    } catch (error) {
      console.error('Error getting timeline:', error);
      return {};
    }
  }

  /**
   * Get concept index
   */
  async getConceptIndex() {
    try {
      const data = await chrome.storage.local.get(this.INDEX_KEY);
      return data[this.INDEX_KEY] || {};
    } catch (error) {
      console.error('Error getting concept index:', error);
      return {};
    }
  }

  /**
   * Get storage statistics
   */
  async getStats() {
    try {
      const data = await chrome.storage.local.get([
        this.STORAGE_KEY,
        this.INDEX_KEY,
        this.TIMELINE_KEY
      ]);
      
      const nodes = data[this.STORAGE_KEY] || [];
      const index = data[this.INDEX_KEY] || {};
      const timeline = data[this.TIMELINE_KEY] || {};
      
      // Calculate storage size
      const storageSize = JSON.stringify(data).length;
      
      // Get unique concepts
      const concepts = Object.keys(index);
      
      // Get date range
      const dates = Object.keys(timeline).sort();
      const oldestDate = dates[0] || 'N/A';
      const newestDate = dates[dates.length - 1] || 'N/A';
      
      // Calculate connections
      let totalConnections = 0;
      let strongConnections = 0;
      nodes.forEach(node => {
        totalConnections += node.connections.length;
        strongConnections += node.connections.filter(c => c.strength === 'strong').length;
      });
      
      return {
        nodeCount: nodes.length,
        conceptCount: concepts.length,
        dateCount: dates.length,
        storageSize: storageSize,
        storageSizeKB: (storageSize / 1024).toFixed(2),
        storageSizeMB: (storageSize / 1024 / 1024).toFixed(2),
        oldestNode: oldestDate,
        newestNode: newestDate,
        totalConnections,
        strongConnections,
        averageConceptsPerNode: nodes.length > 0 ? 
          (nodes.reduce((sum, n) => sum + n.concepts.length, 0) / nodes.length).toFixed(1) : 0,
        averageConnectionsPerNode: nodes.length > 0 ? 
          (totalConnections / nodes.length).toFixed(1) : 0
      };
      
    } catch (error) {
      console.error('Error getting storage stats:', error);
      return {
        nodeCount: 0,
        conceptCount: 0,
        storageSize: 0,
        error: error.message
      };
    }
  }

  /**
   * Clear all knowledge graph data
   */
  async clearAll() {
    try {
      await chrome.storage.local.remove([
        this.STORAGE_KEY,
        this.INDEX_KEY,
        this.TIMELINE_KEY
      ]);
      console.log('Knowledge graph data cleared');
      return true;
    } catch (error) {
      console.error('Error clearing knowledge graph:', error);
      return false;
    }
  }

  /**
   * Export knowledge graph data
   */
  async exportData() {
    try {
      const data = await chrome.storage.local.get([
        this.STORAGE_KEY,
        this.INDEX_KEY,
        this.TIMELINE_KEY
      ]);
      
      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        nodes: data[this.STORAGE_KEY] || [],
        index: data[this.INDEX_KEY] || {},
        timeline: data[this.TIMELINE_KEY] || {},
        stats: await this.getStats()
      };
      
      return exportData;
      
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  /**
   * Import knowledge graph data
   */
  async importData(importData) {
    try {
      if (!importData.nodes || !Array.isArray(importData.nodes)) {
        throw new Error('Invalid import data: missing nodes array');
      }
      
      // Validate data structure
      const validNodes = importData.nodes.filter(node => 
        node.id && node.title && node.concepts && Array.isArray(node.concepts)
      );
      
      if (validNodes.length === 0) {
        throw new Error('No valid nodes found in import data');
      }
      
      // Clear existing data
      await this.clearAll();
      
      // Import new data
      await chrome.storage.local.set({
        [this.STORAGE_KEY]: validNodes,
        [this.INDEX_KEY]: importData.index || {},
        [this.TIMELINE_KEY]: importData.timeline || {}
      });
      
      console.log(`Imported ${validNodes.length} knowledge nodes`);
      return {
        success: true,
        nodesImported: validNodes.length
      };
      
    } catch (error) {
      console.error('Error importing data:', error);
      throw error;
    }
  }

  /**
   * Search nodes by text
   */
  async searchNodes(searchText) {
    try {
      const data = await chrome.storage.local.get(this.STORAGE_KEY);
      const nodes = data[this.STORAGE_KEY] || [];
      
      const searchLower = searchText.toLowerCase();
      const results = nodes.filter(node => {
        // Search in title
        if (node.title.toLowerCase().includes(searchLower)) return true;
        
        // Search in concepts
        if (node.concepts.some(c => c.toLowerCase().includes(searchLower))) return true;
        
        // Search in summary
        if (node.summary && node.summary.toLowerCase().includes(searchLower)) return true;
        
        return false;
      });
      
      // Sort by relevance (title matches first, then recent)
      results.sort((a, b) => {
        const aInTitle = a.title.toLowerCase().includes(searchLower);
        const bInTitle = b.title.toLowerCase().includes(searchLower);
        
        if (aInTitle && !bInTitle) return -1;
        if (!aInTitle && bInTitle) return 1;
        
        return b.timestamp - a.timestamp;
      });
      
      return results;
      
    } catch (error) {
      console.error('Error searching nodes:', error);
      return [];
    }
  }
}

// Export singleton instance
let storageInstance = null;

export function getKnowledgeStorage() {
  if (!storageInstance) {
    storageInstance = new KnowledgeStorage();
  }
  return storageInstance;
}
