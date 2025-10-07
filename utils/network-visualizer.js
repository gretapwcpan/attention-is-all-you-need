// Network Visualizer - Interactive Knowledge Graph with Professional Colors

import { ensureVisLoaded, loadVisLibrary } from './vis-loader.js';

export class NetworkVisualizer {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = null;
    this.network = null;
    this.nodes = null;
    this.edges = null;
    this.physicsEnabled = true;
    this.currentFilter = 'all';
    
    // Simplified, professional color schemes
    this.colorSchemes = {
      // Time-based colors (more subtle)
      timeGradients: {
        today: { center: '#4A90E2', edge: '#357ABD', glow: '#6BA3E5' },
        week: { center: '#5E72E4', edge: '#4C63D2', glow: '#7B8CE8' },
        month: { center: '#6C757D', edge: '#5A6268', glow: '#868E96' },
        older: { center: '#ADB5BD', edge: '#9A9FA5', glow: '#C3C8CD' }
      },
      
      // Category-based colors (professional palette)
      categoryGradients: {
        'Development': { center: '#4A90E2', edge: '#357ABD', glow: '#6BA3E5' },
        'AI/ML': { center: '#9B59B6', edge: '#8E44AD', glow: '#A569BD' },
        'Learning': { center: '#27AE60', edge: '#229954', glow: '#52BE80' },
        'Research': { center: '#E67E22', edge: '#D68910', glow: '#EB984E' },
        'Reading': { center: '#E74C3C', edge: '#CB4335', glow: '#EC7063' },
        'News': { center: '#F39C12', edge: '#D68910', glow: '#F5B041' },
        'Social': { center: '#3498DB', edge: '#2E86C1', glow: '#5DADE2' },
        'Reference': { center: '#8E44AD', edge: '#7D3C98', glow: '#A569BD' },
        'Exploring': { center: '#95A5A6', edge: '#7F8C8D', glow: '#AAB7B8' },
        'General': { center: '#7F8C8D', edge: '#707B7C', glow: '#95A5A6' }
      }
    };
  }
  
  async initialize() {
    this.container = document.getElementById(this.containerId);
    if (!this.container) {
      console.error('Container not found:', this.containerId);
      return;
    }
    
    try {
      // Ensure Vis.js is loaded first
      await loadVisLibrary(); // Try dynamic loading first
      await ensureVisLoaded(); // Then wait for it to be ready
      
      // Clear any existing content
      this.container.innerHTML = '';
      
      // Check if vis is available
      if (typeof vis === 'undefined' || !vis.DataSet || !vis.Network) {
        throw new Error('Vis.js library not available after loading attempts');
      }
      
      // Initialize data structures
      this.nodes = new vis.DataSet();
      this.edges = new vis.DataSet();
      
      // Create the network
      this.createNetwork();
      
      // Load and display knowledge data
      await this.loadKnowledgeData();
    } catch (error) {
      console.error('Failed to initialize NetworkVisualizer:', error);
      this.showErrorState('Failed to load visualization. Please refresh the page.');
    }
  }
  
  createNetwork() {
    const options = {
      nodes: {
        shape: 'dot',
        font: {
          size: 11,
          color: '#2C3E50',
          face: 'Arial'
        },
        borderWidth: 1.5,
        shadow: {
          enabled: true,
          color: 'rgba(0, 0, 0, 0.2)',
          size: 5,
          x: 2,
          y: 2
        },
        scaling: {
          min: 10,
          max: 40,
          label: {
            enabled: true,
            min: 10,
            max: 14
          }
        }
      },
      edges: {
        width: 0.5,
        smooth: {
          type: 'continuous',
          roundness: 0.5
        },
        arrows: {
          to: {
            enabled: false
          }
        },
        shadow: false
      },
      physics: {
        enabled: this.physicsEnabled,
        forceAtlas2Based: {
          gravitationalConstant: -50,
          centralGravity: 0.01,
          springLength: 100,
          springConstant: 0.08,
          damping: 0.4,
          avoidOverlap: 0.5
        },
        maxVelocity: 50,
        minVelocity: 0.1,
        solver: 'forceAtlas2Based',
        timestep: 0.35,
        stabilization: {
          enabled: true,
          iterations: 1000,
          updateInterval: 10
        }
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
        zoomView: true,
        dragView: true,
        dragNodes: true
      }
    };
    
    const data = {
      nodes: this.nodes,
      edges: this.edges
    };
    
    this.network = new vis.Network(this.container, data, options);
    
    // Add event listeners
    this.setupEventListeners();
  }
  
  async loadKnowledgeData() {
    try {
      console.log('NetworkVisualizer: Starting to load knowledge data...');
      
      // Try multiple storage keys to find nodes
      const storageKeys = ['knowledge_nodes', 'knowledgeNodes', 'knowledgeGraph'];
      let allNodes = [];
      
      for (const key of storageKeys) {
        const result = await chrome.storage.local.get([key]);
        console.log(`NetworkVisualizer: Checking key '${key}':`, result[key] ? 'Found data' : 'No data');
        
        if (result[key]) {
          if (Array.isArray(result[key])) {
            allNodes = result[key];
          } else if (result[key].nodes && Array.isArray(result[key].nodes)) {
            allNodes = result[key].nodes;
          }
          
          if (allNodes.length > 0) {
            console.log(`NetworkVisualizer: Found ${allNodes.length} nodes in '${key}'`);
            break;
          }
        }
      }
      
      // Also check for sessions that could be converted to nodes
      if (allNodes.length === 0) {
        console.log('NetworkVisualizer: No nodes found, checking for sessions...');
        
        // Get all storage keys
        const allStorage = await chrome.storage.local.get(null);
        const sessionKeys = Object.keys(allStorage).filter(key => key.startsWith('sessions_'));
        
        if (sessionKeys.length > 0) {
          // Get the most recent sessions
          const recentSessions = [];
          for (const key of sessionKeys.slice(-7)) { // Last 7 days
            if (allStorage[key] && Array.isArray(allStorage[key])) {
              recentSessions.push(...allStorage[key]);
            }
          }
          
          if (recentSessions.length > 0) {
            console.log(`NetworkVisualizer: Found ${recentSessions.length} sessions, converting to nodes...`);
            allNodes = this.convertSessionsToNodes(recentSessions);
          }
        }
      }
      
      if (allNodes.length === 0) {
        console.log('NetworkVisualizer: No data found anywhere, showing empty state');
        this.showEmptyState();
        return;
      }
      
      console.log(`NetworkVisualizer: Processing ${allNodes.length} nodes for visualization...`);
      
      // Process and add nodes
      const processedNodes = [];
      const nodeMap = new Map();
      
      allNodes.forEach((node, index) => {
        // Ensure node has required fields
        if (!node.title && !node.url) {
          console.log('NetworkVisualizer: Skipping invalid node:', node);
          return;
        }
        
        // Generate concepts if missing
        if (!node.concepts || node.concepts.length === 0) {
          node.concepts = this.generateConceptsFromNode(node);
        }
        
        const colors = this.getNodeColors(node);
        const size = this.calculateNodeSize(node);
        
        const visNode = {
          id: node.id || `node_${index}`,
          label: this.truncateLabel(node.title || node.url || 'Unknown'),
          title: this.createTooltip(node),
          value: size,
          color: {
            background: colors.center,
            border: colors.edge,
            highlight: {
              background: colors.glow,
              border: colors.center
            },
            hover: {
              background: colors.glow,
              border: colors.center
            }
          },
          borderWidth: 1.5,
          borderWidthSelected: 2,
          font: {
            color: '#2C3E50',
            size: 11,
            face: 'Arial'
          },
          shadow: {
            enabled: true,
            color: 'rgba(0, 0, 0, 0.2)',
            size: 5,
            x: 2,
            y: 2
          },
          // Store original node data
          originalNode: node,
          // Custom properties for filtering
          category: node.category || 'General',
          timestamp: node.timestamp || Date.now(),
          timeSpent: node.timeSpent || node.duration || 0
        };
        
        processedNodes.push(visNode);
        nodeMap.set(node.id || index, node);
      });
      
      // Add nodes to the network
      this.nodes.add(processedNodes);
      
      console.log(`NetworkVisualizer: Added ${processedNodes.length} nodes to network`);
      
      // Create edges based on similarity
      const edges = this.createSimilarityBasedEdges(processedNodes);
      this.edges.add(edges);
      
      console.log(`NetworkVisualizer: Created ${edges.length} edges`);
      
      // Fit network to viewport
      setTimeout(() => {
        this.network.fit({
          animation: {
            duration: 1000,
            easingFunction: 'easeInOutQuad'
          }
        });
      }, 500);
      
    } catch (error) {
      console.error('Error loading knowledge data:', error);
      this.showEmptyState();
    }
  }
  
  getNodeColors(node) {
    // Use category colors primarily for cleaner look
    const category = node.category || 'General';
    const categoryColors = this.colorSchemes.categoryGradients[category];
    
    if (categoryColors) {
      return categoryColors;
    }
    
    // Fallback to time-based colors
    const now = Date.now();
    const age = now - (node.timestamp || now);
    const dayInMs = 24 * 60 * 60 * 1000;
    
    if (age < dayInMs) {
      return this.colorSchemes.timeGradients.today;
    } else if (age < 7 * dayInMs) {
      return this.colorSchemes.timeGradients.week;
    } else if (age < 30 * dayInMs) {
      return this.colorSchemes.timeGradients.month;
    } else {
      return this.colorSchemes.timeGradients.older;
    }
  }
  
  calculateNodeSize(node) {
    // Size based on time spent (in milliseconds)
    const minutes = (node.timeSpent || node.duration || 0) / 60000;
    
    // More subtle sizing - smaller range
    let size;
    if (minutes < 1) {
      size = 15;
    } else if (minutes < 5) {
      size = 20;
    } else if (minutes < 15) {
      size = 25;
    } else if (minutes < 30) {
      size = 30;
    } else {
      size = 35;
    }
    
    return size;
  }
  
  truncateLabel(text, maxLength = 20) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }
  
  createTooltip(node) {
    const timeSpent = Math.round((node.timeSpent || 0) / 60000);
    const date = new Date(node.timestamp).toLocaleDateString();
    const concepts = (node.concepts || []).slice(0, 5).join(', ');
    
    return `
      <div style="padding: 10px; max-width: 300px;">
        <h4 style="margin: 0 0 8px 0; color: #4A90E2;">${node.title}</h4>
        <p style="margin: 4px 0; font-size: 12px;">
          <strong>Category:</strong> ${node.category}<br>
          <strong>Time Spent:</strong> ${timeSpent} minutes<br>
          <strong>Date:</strong> ${date}<br>
          ${concepts ? `<strong>Concepts:</strong> ${concepts}` : ''}
        </p>
      </div>
    `;
  }
  
  convertSessionsToNodes(sessions) {
    return sessions.map((session, index) => ({
      id: `session_${index}_${Date.now()}`,
      title: session.title || session.url,
      url: session.url,
      category: session.category || 'General',
      concepts: this.extractConceptsFromTitle(session.title || ''),
      timestamp: session.timestamp || session.startTime || Date.now(),
      timeSpent: session.duration || 0,
      domain: session.domain,
      connections: []
    }));
  }
  
  generateConceptsFromNode(node) {
    const concepts = [];
    
    // Extract from title
    if (node.title) {
      concepts.push(...this.extractConceptsFromTitle(node.title));
    }
    
    // Add category as concept
    if (node.category && node.category !== 'General') {
      concepts.push(node.category);
    }
    
    // Extract from domain
    if (node.domain) {
      const domainParts = node.domain.split('.').filter(p => p.length > 3 && p !== 'www' && p !== 'com');
      concepts.push(...domainParts);
    }
    
    return [...new Set(concepts)]; // Remove duplicates
  }
  
  extractConceptsFromTitle(title) {
    if (!title) return [];
    
    // Remove common words and extract meaningful terms
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were'];
    
    const words = title.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word));
    
    // Return top 5 most relevant words
    return words.slice(0, 5);
  }
  
  createSimilarityBasedEdges(visNodes) {
    const edges = [];
    
    // Create edges based on multiple similarity factors
    for (let i = 0; i < visNodes.length; i++) {
      for (let j = i + 1; j < visNodes.length; j++) {
        const node1 = visNodes[i].originalNode;
        const node2 = visNodes[j].originalNode;
        
        // Calculate similarity score
        const similarity = this.calculateSimilarity(node1, node2);
        
        if (similarity > 0.2) { // Threshold for creating an edge
          const edgeId = `edge_${visNodes[i].id}_${visNodes[j].id}`;
          
          // Much thinner edges with subtle colors
          let edgeColor, width;
          if (similarity > 0.7) {
            edgeColor = { color: 'rgba(74, 144, 226, 0.6)', highlight: 'rgba(74, 144, 226, 0.8)', hover: 'rgba(74, 144, 226, 1)' };
            width = 1.5;
          } else if (similarity > 0.4) {
            edgeColor = { color: 'rgba(149, 165, 166, 0.5)', highlight: 'rgba(149, 165, 166, 0.7)', hover: 'rgba(149, 165, 166, 0.9)' };
            width = 1;
          } else {
            edgeColor = { color: 'rgba(189, 195, 199, 0.4)', highlight: 'rgba(189, 195, 199, 0.6)', hover: 'rgba(189, 195, 199, 0.8)' };
            width = 0.5;
          }
          
          edges.push({
            id: edgeId,
            from: visNodes[i].id,
            to: visNodes[j].id,
            value: similarity,
            title: `Similarity: ${Math.round(similarity * 100)}%`,
            color: edgeColor,
            width: width,
            smooth: {
              type: 'curvedCW',
              roundness: 0.2
            }
          });
        }
      }
    }
    
    return edges;
  }
  
  calculateSimilarity(node1, node2) {
    let score = 0;
    let factors = 0;
    
    // Concept similarity (most important)
    if (node1.concepts && node2.concepts) {
      const shared = this.findSharedConcepts(node1, node2);
      const total = new Set([...node1.concepts, ...node2.concepts]).size;
      if (total > 0) {
        score += (shared.length / total) * 0.5;
        factors += 0.5;
      }
    }
    
    // Category similarity
    if (node1.category === node2.category && node1.category !== 'General') {
      score += 0.2;
      factors += 0.2;
    }
    
    // Domain similarity
    if (node1.domain && node2.domain && node1.domain === node2.domain) {
      score += 0.15;
      factors += 0.15;
    }
    
    // Temporal proximity (visited close in time)
    if (node1.timestamp && node2.timestamp) {
      const timeDiff = Math.abs(node1.timestamp - node2.timestamp);
      const hourInMs = 3600000;
      if (timeDiff < hourInMs) {
        score += 0.15 * (1 - timeDiff / hourInMs);
        factors += 0.15;
      }
    }
    
    return factors > 0 ? score / factors : 0;
  }
  
  findSharedConcepts(node1, node2) {
    if (!node1.concepts || !node2.concepts) return [];
    
    const concepts1 = new Set(node1.concepts.map(c => c.toLowerCase()));
    const concepts2 = new Set(node2.concepts.map(c => c.toLowerCase()));
    
    const shared = [];
    for (const concept of concepts1) {
      if (concepts2.has(concept)) {
        shared.push(concept);
      }
    }
    
    return shared;
  }
  
  setupEventListeners() {
    // Node click event
    this.network.on('click', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        this.handleNodeClick(nodeId);
      }
    });
    
    // Node hover event
    this.network.on('hoverNode', (params) => {
      this.container.style.cursor = 'pointer';
    });
    
    this.network.on('blurNode', (params) => {
      this.container.style.cursor = 'default';
    });
    
    // Double click for focus
    this.network.on('doubleClick', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        this.focusOnNode(nodeId);
      }
    });
  }
  
  handleNodeClick(nodeId) {
    // Get connected nodes
    const connectedNodes = this.network.getConnectedNodes(nodeId);
    const connectedEdges = this.network.getConnectedEdges(nodeId);
    
    // Highlight connected nodes and edges
    const updateArray = [];
    
    // Dim all nodes except selected and connected
    this.nodes.forEach((node) => {
      if (node.id === nodeId) {
        updateArray.push({
          id: node.id,
          opacity: 1,
          borderWidth: 4
        });
      } else if (connectedNodes.includes(node.id)) {
        updateArray.push({
          id: node.id,
          opacity: 0.9,
          borderWidth: 3
        });
      } else {
        updateArray.push({
          id: node.id,
          opacity: 0.3,
          borderWidth: 1
        });
      }
    });
    
    this.nodes.update(updateArray);
    
    // Reset on next click
    setTimeout(() => {
      this.resetHighlight();
    }, 3000);
  }
  
  focusOnNode(nodeId) {
    this.network.focus(nodeId, {
      scale: 1.5,
      animation: {
        duration: 1000,
        easingFunction: 'easeInOutQuad'
      }
    });
  }
  
  resetHighlight() {
    const updateArray = [];
    this.nodes.forEach((node) => {
      updateArray.push({
        id: node.id,
        opacity: 1,
        borderWidth: 2
      });
    });
    this.nodes.update(updateArray);
  }
  
  showEmptyState() {
    this.container.innerHTML = `
      <div class="empty-state" style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #666;
        font-family: 'Share Tech Mono', monospace;
      ">
        <div style="font-size: 18px; margin-bottom: 10px;">No Knowledge Nodes Yet</div>
        <div style="font-size: 14px; opacity: 0.8;">Browse the web for at least 5 seconds to start building your knowledge graph</div>
      </div>
    `;
  }
  
  showErrorState(message) {
    this.container.innerHTML = `
      <div class="empty-state" style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #ff6b6b;
        font-family: 'Share Tech Mono', monospace;
      ">
        <div style="font-size: 18px; margin-bottom: 10px;">Error Loading Graph</div>
        <div style="font-size: 14px; opacity: 0.8;">${message}</div>
        <button onclick="location.reload()" style="
          margin-top: 20px;
          padding: 10px 20px;
          background: #0066ff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-family: 'Share Tech Mono', monospace;
        ">Refresh Page</button>
      </div>
    `;
  }
  
  // Public methods for external control
  togglePhysics() {
    this.physicsEnabled = !this.physicsEnabled;
    this.network.setOptions({
      physics: { enabled: this.physicsEnabled }
    });
  }
  
  resetView() {
    this.network.fit({
      animation: {
        duration: 1000,
        easingFunction: 'easeInOutQuad'
      }
    });
    this.resetHighlight();
  }
  
  filterByTime(filter) {
    this.currentFilter = filter;
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;
    
    let cutoffTime;
    switch (filter) {
      case 'today':
        cutoffTime = now - dayInMs;
        break;
      case 'week':
        cutoffTime = now - 7 * dayInMs;
        break;
      case 'month':
        cutoffTime = now - 30 * dayInMs;
        break;
      default:
        cutoffTime = 0;
    }
    
    // Update node visibility
    const updateArray = [];
    this.nodes.forEach((node) => {
      const visible = node.timestamp >= cutoffTime;
      updateArray.push({
        id: node.id,
        hidden: !visible
      });
    });
    
    this.nodes.update(updateArray);
    
    // Update edge visibility
    const edgeUpdateArray = [];
    this.edges.forEach((edge) => {
      const fromNode = this.nodes.get(edge.from);
      const toNode = this.nodes.get(edge.to);
      const visible = !fromNode.hidden && !toNode.hidden;
      edgeUpdateArray.push({
        id: edge.id,
        hidden: !visible
      });
    });
    
    this.edges.update(edgeUpdateArray);
    
    // Refit the view
    setTimeout(() => {
      this.network.fit({
        animation: {
          duration: 500,
          easingFunction: 'easeInOutQuad'
        }
      });
    }, 100);
  }
  
  async refresh() {
    // Clear existing data
    this.nodes.clear();
    this.edges.clear();
    
    // Reload data
    await this.loadKnowledgeData();
  }
}
