/**
 * Citation Tool
 * Ensures all generated content includes proper source attribution
 */

interface Citation {
  sourceId: string;
  title: string;
  snippet: string;
  relevanceScore: number;
  pageNumber?: number;
  section?: string;
}

export function createCiteTool() {
  return {
    /**
     * Extract citations from search results and generated content
     */
    extractCitations(searchResults: any[], generatedText: string): Citation[] {
      const citations: Citation[] = [];

      // Match sentences/phrases in generated text to source documents
      const sentences = generatedText.split(/[.!?]+/).filter(s => s.trim().length > 20);

      searchResults.forEach((result, idx) => {
        const content = result.content || '';
        let relevanceScore = 0;
        const matchedSnippets: string[] = [];

        sentences.forEach(sentence => {
          const cleaned = sentence.trim().toLowerCase();
          if (cleaned.length < 20) return;

          // Check if sentence content appears in source
          const words = cleaned.split(/\s+/);
          const significantWords = words.filter(w => w.length > 4);
          
          let matches = 0;
          significantWords.forEach(word => {
            if (content.toLowerCase().includes(word)) {
              matches++;
            }
          });

          if (matches / significantWords.length > 0.4) {
            relevanceScore += matches / significantWords.length;
            
            // Extract snippet around matched content
            const snippet = this.extractSnippet(content, cleaned.substring(0, 50));
            if (snippet) matchedSnippets.push(snippet);
          }
        });

        if (relevanceScore > 0.3) {
          citations.push({
            sourceId: result.id,
            title: result.title,
            snippet: matchedSnippets[0] || content.substring(0, 150) + '...',
            relevanceScore: Math.min(relevanceScore, 1.0),
            section: result.section
          });
        }
      });

      // Sort by relevance
      return citations.sort((a, b) => b.relevanceScore - a.relevanceScore);
    },

    /**
     * Format citations in academic style
     */
    formatCitations(citations: Citation[], style: 'inline' | 'footnote' | 'endnote' = 'inline'): string {
      if (style === 'inline') {
        return citations.map((c, i) => 
          `[${i + 1}] ${c.title} - "${c.snippet}"`
        ).join('\n');
      } else if (style === 'footnote') {
        return citations.map((c, i) => 
          `${i + 1}. ${c.title}, relevance: ${(c.relevanceScore * 100).toFixed(1)}%`
        ).join('\n');
      } else {
        return citations.map((c, i) => 
          `[${i + 1}] ${c.title}${c.section ? `, Section: ${c.section}` : ''}\n    "${c.snippet}"`
        ).join('\n\n');
      }
    },

    /**
     * Inject inline citations into generated text
     */
    injectInlineCitations(text: string, citations: Citation[]): string {
      if (citations.length === 0) return text;

      let citedText = text;
      const sentences = text.split(/([.!?]+)/);

      // Group citations by relevance to sentences
      citations.forEach((citation, idx) => {
        const citationMark = `[${idx + 1}]`;
        const snippet = citation.snippet.toLowerCase();
        
        for (let i = 0; i < sentences.length; i += 2) {
          const sentence = sentences[i];
          if (!sentence) continue;

          // Check if sentence relates to this citation
          const words = snippet.split(/\s+/).filter(w => w.length > 4);
          let matches = 0;
          words.forEach(word => {
            if (sentence.toLowerCase().includes(word)) matches++;
          });

          if (matches / words.length > 0.3) {
            // Add citation mark if not already present
            if (!sentence.includes(citationMark)) {
              sentences[i] = sentence.trimEnd() + ` ${citationMark}`;
            }
            break;
          }
        }
      });

      citedText = sentences.join('');
      
      // Add citation list at the end
      citedText += '\n\n**Sources:**\n';
      citedText += this.formatCitations(citations, 'endnote');

      return citedText;
    },

    /**
     * Extract relevant snippet from content
     */
    extractSnippet(content: string, query: string, contextLength: number = 150): string | null {
      const lowerContent = content.toLowerCase();
      const lowerQuery = query.toLowerCase().substring(0, 50);
      
      // Find best match position
      let bestMatch = -1;
      let bestScore = 0;

      const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 3);
      
      for (let i = 0; i < lowerContent.length - 50; i++) {
        const window = lowerContent.substring(i, i + 100);
        let score = 0;
        queryWords.forEach(word => {
          if (window.includes(word)) score++;
        });
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = i;
        }
      }

      if (bestMatch === -1 || bestScore === 0) return null;

      // Extract snippet with context
      const start = Math.max(0, bestMatch - 50);
      const end = Math.min(content.length, bestMatch + contextLength);
      let snippet = content.substring(start, end);

      if (start > 0) snippet = '...' + snippet;
      if (end < content.length) snippet = snippet + '...';

      return snippet;
    },

    /**
     * Verify that generated content is properly cited
     */
    verifyCitations(text: string, requiredCitations: number = 2): {
      isVerified: boolean;
      citationCount: number;
      missingCitations: boolean;
      warnings: string[];
    } {
      const citationPattern = /\[\d+\]/g;
      const citations = text.match(citationPattern) || [];
      const warnings: string[] = [];

      if (citations.length < requiredCitations) {
        warnings.push(`Only ${citations.length} citations found, expected at least ${requiredCitations}`);
      }

      // Check for citation list
      const hasCitationList = text.includes('Sources:') || text.includes('References:');
      if (!hasCitationList && citations.length > 0) {
        warnings.push('Citation marks found but no citation list');
      }

      return {
        isVerified: citations.length >= requiredCitations && hasCitationList,
        citationCount: citations.length,
        missingCitations: citations.length < requiredCitations,
        warnings
      };
    }
  };
}
