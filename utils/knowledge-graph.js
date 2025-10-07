/**
 * Knowledge Graph Module
 * Extracts concepts from browsed content and builds connections over time
 */

import { getAIService } from './ai-service.js';
import { KnowledgeStorage } from './knowledge-storage.js';

export class KnowledgeGraph {
  constructor() {
    this.aiService = getAIService();
    this.storage = new KnowledgeStorage();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return true;
    
    try {
      await this.aiService.initialize();
      this.initialized = true;
      console.log('Knowledge Graph initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize Knowledge Graph:', error);
      return false;
    }
  }

  /**
   * Process a page and extract knowledge
   */
  async processPage(pageData, summary) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // 1. Extract concepts from full content
      const concepts = await this.extractConcepts(pageData, summary);
      
      // 2. Find connections to past learning
      const connections = await this.findConnections(summary, concepts);
      
      // 3. Create knowledge node
      const node = {
        id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        url: pageData.url,
        title: pageData.title,
        summary: summary.text || summary, // Handle both object and string
        concepts: concepts,
        connections: connections,
        timestamp: Date.now(),
        date: new Date().toDateString(),
        timeSpent: pageData.timeSpent || 0,
        category: pageData.category || 'General'
      };
      
      // 4. Store node
      await this.storage.saveNode(node);
      
      console.log('Knowledge node created:', {
        title: node.title,
        concepts: node.concepts,
        connections: node.connections.length
      });
      
      return node;
    } catch (error) {
      console.error('Error processing page for knowledge graph:', error);
      throw error;
    }
  }

  /**
   * Extract key concepts from page content
   */
  async extractConcepts(pageData, summary) {
    // Check if AI service is healthy before attempting
    if (!this.aiService.isHealthy || !this.aiService.isHealthy()) {
      console.log('AI service not healthy, using fallback concept extraction');
      return this.extractFallbackConcepts(pageData);
    }
    
    try {
      const summaryText = typeof summary === 'string' ? summary : summary.text;
      
      const prompt = `Based on this article, extract 3-7 key concepts or topics.

Title: ${pageData.title}
Summary: ${summaryText}
Category: ${pageData.category || 'General'}

Return ONLY a JSON array of concept strings, nothing else:
["concept1", "concept2", "concept3"]

Focus on:
- Main topics and technologies mentioned
- Key terms that define the content
- Concepts that could connect to other learning

Example output: ["React Hooks", "State Management", "useEffect", "Component Lifecycle"]`;

      const options = {
        systemPrompt: "You are a knowledge extraction assistant. Extract key concepts from articles. Always respond with valid JSON array in English.",
        temperature: 0.7
      };

      const response = await this.aiService.generateText(prompt, options);
      
      // Try to parse the response
      try {
        // Extract JSON array from response
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const concepts = JSON.parse(jsonMatch[0]);
          // Validate and clean concepts
          return concepts
            .filter(c => typeof c === 'string' && c.length > 0)
            .slice(0, 7); // Max 7 concepts
        }
      } catch (parseError) {
        console.error('Failed to parse concepts:', parseError);
      }
      
      // Fallback: extract from title and category
      return this.extractFallbackConcepts(pageData);
      
    } catch (error) {
      console.error('Error extracting concepts:', error);
      return this.extractFallbackConcepts(pageData);
    }
  }

  /**
   * Fallback concept extraction without AI
   */
  extractFallbackConcepts(pageData) {
    const concepts = [];
    
    // Extract from title
    const titleWords = pageData.title
      .split(/[\s\-–—:|]+/)
      .filter(word => word.length > 3 && !['with', 'from', 'about', 'using'].includes(word.toLowerCase()));
    
    concepts.push(...titleWords.slice(0, 3));
    
    // Add category
    if (pageData.category) {
      concepts.push(pageData.category);
    }
    
    return [...new Set(concepts)].slice(0, 5);
  }

  /**
   * Find connections to previously learned content
   */
  async findConnections(currentSummary, currentConcepts) {
    try {
      // Get recent nodes (last 30 days)
      const recentNodes = await this.storage.getRecentNodes(30);
      
      if (recentNodes.length === 0) {
        return [];
      }
      
      // Select nodes for comparison (avoid too many AI calls)
      const nodesToCheck = this.selectNodesForComparison(recentNodes, currentConcepts);
      
      const connections = [];
      for (const node of nodesToCheck) {
        try {
          const connection = await this.analyzeConnection(node, currentSummary, currentConcepts);
          if (connection && connection.strength !== 'none') {
            connections.push(connection);
          }
        } catch (error) {
          console.error('Error analyzing connection:', error);
        }
      }
      
      // Sort by strength
      return connections.sort((a, b) => {
        const strengthOrder = { strong: 3, medium: 2, weak: 1, none: 0 };
        return strengthOrder[b.strength] - strengthOrder[a.strength];
      });
      
    } catch (error) {
      console.error('Error finding connections:', error);
      return [];
    }
  }

  /**
   * Select most relevant nodes for connection analysis
   */
  selectNodesForComparison(recentNodes, currentConcepts) {
    // Score nodes by concept overlap
    const scoredNodes = recentNodes.map(node => {
      const conceptOverlap = node.concepts.filter(c => 
        currentConcepts.some(cc => 
          cc.toLowerCase().includes(c.toLowerCase()) || 
          c.toLowerCase().includes(cc.toLowerCase())
        )
      ).length;
      
      return { node, score: conceptOverlap };
    });
    
    // Sort by score and recency
    scoredNodes.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.node.timestamp - a.node.timestamp;
    });
    
    // Take top 5 most relevant + 2 most recent
    const relevant = scoredNodes.slice(0, 5).map(s => s.node);
    const recent = recentNodes.slice(0, 2);
    
    // Combine and deduplicate
    const combined = [...relevant];
    recent.forEach(node => {
      if (!combined.find(n => n.id === node.id)) {
        combined.push(node);
      }
    });
    
    return combined.slice(0, 7); // Max 7 nodes to check
  }

  /**
   * Analyze connection between two knowledge nodes
   */
  async analyzeConnection(previousNode, currentSummary, currentConcepts) {
    // Check if AI service is healthy before attempting
    if (!this.aiService.isHealthy || !this.aiService.isHealthy()) {
      console.log('AI service not healthy, using fallback connection analysis');
      return this.analyzeFallbackConnection(previousNode, currentConcepts);
    }
    
    try {
      const summaryText = typeof currentSummary === 'string' ? currentSummary : currentSummary.text;
      
      const prompt = `Analyze the connection between these two learning sessions:

PREVIOUS (${previousNode.date}):
Title: ${previousNode.title}
Summary: ${previousNode.summary}
Concepts: ${previousNode.concepts.join(', ')}

CURRENT:
Summary: ${summaryText}
Concepts: ${currentConcepts.join(', ')}

Determine if and how they connect. Return ONLY valid JSON:
{
  "nodeId": "${previousNode.id}",
  "strength": "strong|medium|weak|none",
  "type": "builds_on|relates_to|contrasts|deepens|applies",
  "insight": "Brief explanation of connection (max 100 chars)"
}

Criteria:
- strong: Direct continuation or prerequisite
- medium: Same domain or shared concepts
- weak: Loosely related topics
- none: No meaningful connection`;

      const options = {
        systemPrompt: "You are analyzing connections between learning sessions. Always respond with valid JSON in English.",
        temperature: 0.6
      };

      const response = await this.aiService.generateText(prompt, options);
      
      // Parse response
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const connection = JSON.parse(jsonMatch[0]);
          // Validate connection object
          if (connection.nodeId && connection.strength && connection.type) {
            return connection;
          }
        }
      } catch (parseError) {
        console.error('Failed to parse connection:', parseError);
      }
      
      // Fallback: simple concept matching
      return this.analyzeFallbackConnection(previousNode, currentConcepts);
      
    } catch (error) {
      console.error('Error in connection analysis:', error);
      return this.analyzeFallbackConnection(previousNode, currentConcepts);
    }
  }

  /**
   * Fallback connection analysis without AI
   */
  analyzeFallbackConnection(previousNode, currentConcepts) {
    const conceptOverlap = previousNode.concepts.filter(c => 
      currentConcepts.some(cc => 
        cc.toLowerCase().includes(c.toLowerCase()) || 
        c.toLowerCase().includes(cc.toLowerCase())
      )
    ).length;
    
    if (conceptOverlap === 0) {
      return { nodeId: previousNode.id, strength: 'none', type: 'none', insight: '' };
    }
    
    const strength = conceptOverlap >= 3 ? 'strong' : conceptOverlap >= 2 ? 'medium' : 'weak';
    const type = conceptOverlap >= 3 ? 'builds_on' : 'relates_to';
    const insight = `Shares ${conceptOverlap} concept${conceptOverlap > 1 ? 's' : ''}: ${previousNode.concepts.filter(c => 
      currentConcepts.some(cc => cc.toLowerCase().includes(c.toLowerCase()))
    ).join(', ')}`;
    
    return {
      nodeId: previousNode.id,
      strength,
      type,
      insight: insight.substring(0, 100)
    };
  }

  /**
   * Get insights about learning journey
   */
  async generateLearningInsights() {
    try {
      const nodes = await this.storage.getAllNodes();
      const recentNodes = nodes.slice(-20); // Last 20 nodes
      
      if (recentNodes.length < 5) {
        return {
          summary: "Keep reading to build your knowledge graph!",
          topConcepts: [],
          learningPath: [],
          suggestions: ["Read more articles to generate insights"]
        };
      }
      
      // Analyze concepts frequency
      const conceptFreq = {};
      recentNodes.forEach(node => {
        node.concepts.forEach(concept => {
          conceptFreq[concept] = (conceptFreq[concept] || 0) + 1;
        });
      });
      
      // Get top concepts
      const topConcepts = Object.entries(conceptFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([concept, count]) => ({ concept, count }));
      
      // Identify learning path
      const learningPath = this.identifyLearningPath(recentNodes);
      
      // Generate AI insights if available
      let aiInsights = null;
      if (this.aiService.available) {
        aiInsights = await this.generateAIInsights(recentNodes, topConcepts);
      }
      
      return {
        summary: aiInsights || `You've explored ${Object.keys(conceptFreq).length} concepts across ${recentNodes.length} articles`,
        topConcepts,
        learningPath,
        totalNodes: nodes.length,
        recentFocus: topConcepts[0]?.concept || 'Various topics'
      };
      
    } catch (error) {
      console.error('Error generating insights:', error);
      return {
        summary: "Unable to generate insights",
        topConcepts: [],
        learningPath: [],
        suggestions: []
      };
    }
  }

  /**
   * Identify learning path from nodes
   */
  identifyLearningPath(nodes) {
    const path = [];
    let currentTheme = null;
    
    nodes.forEach(node => {
      // Check if this continues a theme
      const connectsToPrevious = node.connections.some(c => 
        c.strength === 'strong' || c.type === 'builds_on'
      );
      
      if (connectsToPrevious && currentTheme) {
        currentTheme.nodes.push(node.id);
        currentTheme.endDate = node.date;
      } else {
        // Start new theme
        currentTheme = {
          mainConcept: node.concepts[0],
          startDate: node.date,
          endDate: node.date,
          nodes: [node.id]
        };
        path.push(currentTheme);
      }
    });
    
    return path;
  }

  /**
   * Generate AI insights about learning
   */
  async generateAIInsights(nodes, topConcepts) {
    try {
      const prompt = `Analyze this learning journey and provide a brief insight:

Topics explored: ${topConcepts.map(t => t.concept).join(', ')}
Number of articles: ${nodes.length}
Time span: ${nodes[0].date} to ${nodes[nodes.length - 1].date}

Provide a 1-2 sentence encouraging insight about the learning progress and patterns.`;

      const options = {
        systemPrompt: "You are a learning coach providing insights. Be encouraging and specific. Respond in English.",
        temperature: 0.8
      };

      const response = await this.aiService.generateText(prompt, options);
      return response;
      
    } catch (error) {
      console.error('Error generating AI insights:', error);
      return null;
    }
  }
}

// Export singleton instance
let knowledgeGraphInstance = null;

export function getKnowledgeGraph() {
  if (!knowledgeGraphInstance) {
    knowledgeGraphInstance = new KnowledgeGraph();
  }
  return knowledgeGraphInstance;
}
