// Todo Categorizer - AI-powered categorization for todos
import { getAIService } from './ai-service.js';

export class TodoCategorizer {
    constructor() {
        this.aiService = getAIService();
        this.categoryCache = new Map(); // Cache for common phrases
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        
        try {
            // Initialize AI service
            await this.aiService.initialize();
            this.initialized = true;
            console.log('Todo categorizer initialized');
        } catch (error) {
            console.error('Failed to initialize categorizer:', error);
            this.initialized = false;
        }
    }

    async categorizeTodo(todoText) {
        if (!todoText || todoText.trim().length === 0) {
            return { category: 'general' };
        }

        // Check cache first
        const cached = this.categoryCache.get(todoText.toLowerCase());
        if (cached) {
            return cached;
        }

        // Try AI categorization
        try {
            const result = await this.categorizeWithAI(todoText);
            // Cache the result
            this.categoryCache.set(todoText.toLowerCase(), result);
            return result;
        } catch (error) {
            console.log('AI categorization not available, using default:', error.message);
            // Simple default when AI is unavailable
            return { category: 'general' };
        }
    }

    async categorizeWithAI(todoText) {
        // Ensure AI is initialized
        if (!this.initialized) {
            await this.initialize();
        }

        const availability = await this.aiService.checkAvailability();
        if (!availability.available) {
            throw new Error('AI service not available');
        }

        // Create open-ended prompt for categorization
        const prompt = `Categorize this task with a short, descriptive label (1-2 words).
        
Task: "${todoText}"

Think about what type of activity this is and give it an appropriate category label.
Examples: Work, Personal, Chores, Family, Health, Finance, Learning, Shopping, Social, Creative, Planning, etc.

Respond with ONLY the category label, nothing else.`;

        try {
            // Use low temperature for consistent categorization
            const response = await this.aiService.generateText(prompt, {
                temperature: 0.5,
                topK: 3
            });

            // Clean the response - capitalize first letter, lowercase rest
            const rawCategory = response.trim();
            const category = rawCategory.charAt(0).toUpperCase() + rawCategory.slice(1).toLowerCase();
            
            return { category: category };
        } catch (error) {
            console.error('AI generation error:', error);
            throw error;
        }
    }

    // Get category display name (now just returns the category as-is)
    getCategoryDisplayName(category) {
        // Category is already properly formatted from AI
        return category || 'General';
    }

    // Get category color based on hash of category name for consistency
    getCategoryColor(category) {
        if (!category) return '#757575';
        
        // Generate a color based on the category string
        let hash = 0;
        for (let i = 0; i < category.length; i++) {
            hash = category.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        // Convert to HSL for better color distribution
        const hue = Math.abs(hash) % 360;
        const saturation = 50 + (Math.abs(hash >> 8) % 30); // 50-80%
        const lightness = 45 + (Math.abs(hash >> 16) % 15); // 45-60%
        
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    // Clear cache (useful when too much memory is used)
    clearCache() {
        this.categoryCache.clear();
    }

    // Pre-warm the AI model for faster first categorization
    async prewarm() {
        try {
            await this.initialize();
            // Do a test categorization to warm up the model
            await this.categorizeWithAI('test task');
            console.log('AI model prewarmed');
        } catch (error) {
            console.log('Prewarm failed, will initialize on first use');
        }
    }
}

// Export singleton instance
let categorizerInstance = null;

export function getTodoCategorizer() {
    if (!categorizerInstance) {
        categorizerInstance = new TodoCategorizer();
    }
    return categorizerInstance;
}
