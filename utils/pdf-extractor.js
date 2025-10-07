// PDF Extractor Module
// Handles extraction of information from PDF URLs, especially academic papers

export class PDFExtractor {
  constructor() {
    this.arxivApiBase = 'https://export.arxiv.org/api/query';
  }

  /**
   * Check if a URL points to a PDF document
   */
  isPDFUrl(url) {
    if (!url) return false;
    
    return url.endsWith('.pdf') || 
           url.includes('/pdf/') || 
           url.includes('arxiv.org/pdf/') ||
           url.includes('arxiv.org/abs/') ||
           url.includes('.pdf?') ||
           (url.includes('pdf') && url.includes('download'));
  }

  /**
   * Extract information from any PDF URL
   */
  async extractPDFInfo(url, tabTitle = '') {
    try {
      // Check if it's a known academic paper service
      if (url.includes('arxiv.org')) {
        return await this.extractArxivInfo(url, tabTitle);
      } else if (url.includes('scholar.google')) {
        return await this.extractScholarInfo(url, tabTitle);
      } else if (url.includes('researchgate.net')) {
        return await this.extractResearchGateInfo(url, tabTitle);
      }
      
      // For general PDFs, try to extract basic metadata
      return await this.extractGeneralPDFInfo(url, tabTitle);
    } catch (error) {
      console.error('Error extracting PDF info:', error);
      // Return basic info as fallback
      return this.createBasicPDFInfo(url, tabTitle);
    }
  }

  /**
   * Extract information from ArXiv papers using tab title
   */
  async extractArxivInfo(pdfUrl, tabTitle) {
    // Extract paper ID from URL for reference
    let paperId = null;
    let match = pdfUrl.match(/arxiv\.org\/(?:pdf|abs)\/(\d+\.\d+(?:v\d+)?)/);
    if (!match) {
      match = pdfUrl.match(/arxiv\.org\/(?:pdf|abs)\/([a-z-]+\/\d+)/);
    }
    
    if (match) {
      paperId = match[1];
    }
    
    console.log('Processing ArXiv PDF:', paperId || 'unknown', 'Title:', tabTitle);
    
    // Use the tab title as the primary source of information
    const title = tabTitle || this.extractTitleFromUrl(pdfUrl);
    
    // Extract concepts from the title
    const concepts = this.extractConcepts(title);
    
    // Add ArXiv-specific concepts
    if (paperId) {
      // Extract subject area from paper ID if available
      const subjectMatch = paperId.match(/^([a-z-]+)\//);
      if (subjectMatch) {
        const subject = this.mapArxivSubjectToConcept(subjectMatch[1]);
        if (subject && !concepts.includes(subject)) {
          concepts.push(subject);
        }
      }
      
      // Year from paper ID (first 2 digits often indicate year)
      const yearMatch = paperId.match(/^(\d{2})/);
      if (yearMatch) {
        const year = parseInt('20' + yearMatch[1]);
        if (year >= 2000 && year <= new Date().getFullYear()) {
          concepts.push(`${year} research`);
        }
      }
    }
    
    // Always add 'research paper' and 'arxiv' as concepts for ArXiv papers
    if (!concepts.includes('research paper')) {
      concepts.push('research paper');
    }
    if (!concepts.includes('arxiv')) {
      concepts.push('arxiv');
    }
    
    return {
      type: 'research_paper',
      source: 'arxiv',
      title: title,
      url: pdfUrl,
      paperId: paperId,
      concepts: concepts.slice(0, 10), // Limit to 10 concepts
      category: 'Research',
      content: title, // Use title as content for knowledge graph
      metadata: {
        arxivId: paperId,
        extractedFromTitle: true
      }
    };
  }

  /**
   * Map ArXiv subject codes to concepts
   */
  mapArxivSubjectToConcept(subject) {
    const subjectMap = {
      'cs': 'computer science',
      'math': 'mathematics',
      'physics': 'physics',
      'q-bio': 'quantitative biology',
      'q-fin': 'quantitative finance',
      'stat': 'statistics',
      'eess': 'electrical engineering',
      'econ': 'economics',
      'astro-ph': 'astrophysics',
      'cond-mat': 'condensed matter',
      'gr-qc': 'general relativity',
      'hep': 'high energy physics',
      'nlin': 'nonlinear sciences',
      'nucl': 'nuclear physics',
      'quant-ph': 'quantum physics'
    };
    
    return subjectMap[subject] || null;
  }

  /**
   * Helper function to extract content from XML tags
   * Note: This is kept for potential future use but not currently needed
   */
  extractXMLContent(xml, tagName) {
    const regex = new RegExp(`<${tagName}>([\\s\\S]*?)<\/${tagName}>`, 'i');
    const match = xml.match(regex);
    if (match && match[1]) {
      // Clean up the content - remove CDATA, trim whitespace, decode entities
      return match[1]
        .replace(/<!\[CDATA\[|\]\]>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
    }
    return null;
  }

  /**
   * Extract information from Google Scholar (basic implementation)
   */
  async extractScholarInfo(url, tabTitle) {
    // Google Scholar doesn't have a public API, so we'll extract what we can
    const concepts = this.extractConcepts(tabTitle);
    
    return {
      type: 'research_paper',
      source: 'google_scholar',
      title: tabTitle || 'Google Scholar Paper',
      url: url,
      concepts: concepts,
      category: 'Research',
      metadata: {
        source: 'google_scholar'
      }
    };
  }

  /**
   * Extract information from ResearchGate (basic implementation)
   */
  async extractResearchGateInfo(url, tabTitle) {
    const concepts = this.extractConcepts(tabTitle);
    
    return {
      type: 'research_paper',
      source: 'researchgate',
      title: tabTitle || 'ResearchGate Paper',
      url: url,
      concepts: concepts,
      category: 'Research',
      metadata: {
        source: 'researchgate'
      }
    };
  }

  /**
   * Extract basic information from general PDF URLs
   */
  async extractGeneralPDFInfo(url, tabTitle) {
    try {
      // Try to extract metadata from PDF headers (if CORS allows)
      // Note: This might fail due to CORS restrictions
      const metadata = await this.tryExtractPDFMetadata(url);
      
      const title = metadata?.title || tabTitle || this.extractTitleFromUrl(url);
      const concepts = this.extractConcepts(title);
      
      return {
        type: 'pdf_document',
        source: 'general',
        title: title,
        url: url,
        author: metadata?.author,
        subject: metadata?.subject,
        keywords: metadata?.keywords,
        concepts: concepts,
        category: this.categorizePDF(url, title),
        metadata: metadata || {}
      };
    } catch (error) {
      console.log('Could not extract PDF metadata:', error.message);
      return this.createBasicPDFInfo(url, tabTitle);
    }
  }

  /**
   * Try to extract metadata from PDF file headers
   */
  async tryExtractPDFMetadata(url) {
    try {
      // Attempt to fetch first 10KB of PDF for metadata
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Range': 'bytes=0-10240'
        },
        mode: 'no-cors' // This might limit what we can access
      });
      
      if (response.type === 'opaque') {
        // CORS blocked, can't read the response
        return null;
      }
      
      const buffer = await response.arrayBuffer();
      const text = new TextDecoder('latin1').decode(buffer);
      
      // Extract PDF metadata using simple pattern matching
      const metadata = {};
      
      // Try to find title
      const titleMatch = text.match(/\/Title\s*\(([^)]+)\)/);
      if (titleMatch) metadata.title = this.decodePDFString(titleMatch[1]);
      
      // Try to find author
      const authorMatch = text.match(/\/Author\s*\(([^)]+)\)/);
      if (authorMatch) metadata.author = this.decodePDFString(authorMatch[1]);
      
      // Try to find subject
      const subjectMatch = text.match(/\/Subject\s*\(([^)]+)\)/);
      if (subjectMatch) metadata.subject = this.decodePDFString(subjectMatch[1]);
      
      // Try to find keywords
      const keywordsMatch = text.match(/\/Keywords\s*\(([^)]+)\)/);
      if (keywordsMatch) metadata.keywords = this.decodePDFString(keywordsMatch[1]);
      
      return Object.keys(metadata).length > 0 ? metadata : null;
    } catch (error) {
      // Expected to fail for most PDFs due to CORS
      return null;
    }
  }

  /**
   * Decode PDF string (basic implementation)
   */
  decodePDFString(str) {
    // Remove PDF escape sequences
    return str.replace(/\\(\d{3})/g, (match, octal) => 
      String.fromCharCode(parseInt(octal, 8))
    ).replace(/\\/g, '');
  }

  /**
   * Create basic PDF info when extraction fails
   */
  createBasicPDFInfo(url, tabTitle) {
    const title = tabTitle || this.extractTitleFromUrl(url);
    const concepts = this.extractConcepts(title);
    
    return {
      type: 'pdf_document',
      source: 'unknown',
      title: title,
      url: url,
      concepts: concepts,
      category: this.categorizePDF(url, title),
      metadata: {
        extractionFailed: true
      }
    };
  }

  /**
   * Extract a reasonable title from URL
   */
  extractTitleFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop();
      
      // Remove .pdf extension and clean up
      return filename
        .replace(/\.pdf$/i, '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
    } catch {
      return 'PDF Document';
    }
  }

  /**
   * Extract concepts from text
   */
  extractConcepts(text) {
    if (!text) return [];
    
    const concepts = [];
    const lowerText = text.toLowerCase();
    
    // Common academic/technical concepts
    const conceptPatterns = {
      'machine learning': /machine learning|ml|neural network|deep learning/i,
      'artificial intelligence': /artificial intelligence|ai\b/i,
      'natural language': /natural language|nlp|language model/i,
      'computer vision': /computer vision|image recognition|object detection/i,
      'data science': /data science|data analysis|statistics/i,
      'algorithm': /algorithm|optimization|complexity/i,
      'transformer': /transformer|attention mechanism|bert|gpt/i,
      'blockchain': /blockchain|cryptocurrency|distributed ledger/i,
      'quantum': /quantum computing|quantum mechanics/i,
      'security': /security|encryption|cryptography/i,
      'cloud computing': /cloud computing|aws|azure|gcp/i,
      'database': /database|sql|nosql|data storage/i,
      'networking': /networking|tcp|ip|protocol/i,
      'software engineering': /software engineering|agile|devops/i,
      'mathematics': /mathematics|calculus|algebra|geometry/i,
      'physics': /physics|mechanics|thermodynamics/i,
      'biology': /biology|genetics|molecular/i,
      'chemistry': /chemistry|chemical|reaction/i,
      'economics': /economics|finance|market/i,
      'psychology': /psychology|cognitive|behavioral/i
    };
    
    for (const [concept, pattern] of Object.entries(conceptPatterns)) {
      if (pattern.test(text)) {
        concepts.push(concept);
      }
    }
    
    // Extract potential concepts from title words (nouns/technical terms)
    const words = text.split(/\s+/);
    const technicalTerms = words.filter(word => {
      const cleaned = word.toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleaned.length > 4 && 
             !['about', 'their', 'which', 'would', 'could', 'should', 'these', 'those', 'through'].includes(cleaned);
    });
    
    // Add up to 5 technical terms as concepts
    technicalTerms.slice(0, 5).forEach(term => {
      const cleaned = term.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleaned && !concepts.some(c => c.toLowerCase().includes(cleaned))) {
        concepts.push(cleaned);
      }
    });
    
    return [...new Set(concepts)].slice(0, 10); // Return unique concepts, max 10
  }

  /**
   * Map ArXiv category to local category
   */
  mapArxivCategoryToLocal(arxivCategory) {
    const categoryMap = {
      'cs': 'Development',
      'math': 'Research',
      'physics': 'Research',
      'q-bio': 'Research',
      'q-fin': 'Research',
      'stat': 'Research',
      'eess': 'Development',
      'econ': 'Research'
    };
    
    const prefix = arxivCategory.split('.')[0];
    return categoryMap[prefix] || 'Research';
  }

  /**
   * Categorize PDF based on URL and title
   */
  categorizePDF(url, title) {
    const urlLower = url.toLowerCase();
    const titleLower = (title || '').toLowerCase();
    const combined = urlLower + ' ' + titleLower;
    
    if (combined.includes('research') || combined.includes('paper') || combined.includes('journal')) {
      return 'Research';
    }
    if (combined.includes('documentation') || combined.includes('manual') || combined.includes('guide')) {
      return 'Documentation';
    }
    if (combined.includes('tutorial') || combined.includes('course') || combined.includes('lecture')) {
      return 'Learning';
    }
    if (combined.includes('report') || combined.includes('analysis') || combined.includes('study')) {
      return 'Research';
    }
    
    return 'Reading';
  }
}
