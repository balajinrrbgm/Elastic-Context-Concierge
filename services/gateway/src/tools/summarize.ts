import { VertexAIClient } from '../vertex/client.js';

interface SourceDocument {
  id: string;
  title: string;
  content: string;
  summary?: string;
  category: string;
  department: string;
  author: string;
  source_url: string;
  date: string;
  score?: number;
  confidence_score?: number;
}

interface SummarizeOptions {
  style?: 'brief' | 'comprehensive' | 'technical' | 'executive';
  includeQuotes?: boolean;
  maxLength?: number;
  focusAreas?: string[];
  tone?: 'formal' | 'casual' | 'professional';
}

export function createSummarizeTool(vertexClient: VertexAIClient) {
  return {
    async execute(
      query: string,
      documents: SourceDocument[], 
      options: SummarizeOptions = {}
    ) {
      const {
        style = 'comprehensive',
        includeQuotes = true,
        maxLength = 500,
        focusAreas = [],
        tone = 'professional'
      } = options;

      try {
        // Prepare context with source attribution
        const contextParts = documents.map((doc, index) => {
          const sourceInfo = `[Source ${index + 1}: ${doc.title} - ${doc.category} | ${doc.author} | ${doc.source_url}]`;
          const content = doc.summary || doc.content.substring(0, 800);
          return `${sourceInfo}\n${content}`;
        });

        const context = contextParts.join('\n\n---\n\n');

        // Build enhanced prompt based on style and options
        const prompt = this.buildPrompt(query, context, documents.length, {
          style,
          includeQuotes,
          maxLength,
          focusAreas,
          tone
        });

        // Generate response with optimized parameters
        const response = await vertexClient.generateText(prompt, {
          temperature: style === 'technical' ? 0.3 : 0.7,
          maxTokens: Math.min(maxLength * 3, 2048)
        });

        // Extract citations and validate sources
        const citations = this.extractCitations(response, documents);
        const validatedResponse = this.validateSourceReferences(response, documents);

        return {
          summary: validatedResponse,
          citations,
          sourceDocuments: documents.map((doc, index) => ({
            index: index + 1,
            title: doc.title,
            category: doc.category,
            department: doc.department,
            author: doc.author,
            url: doc.source_url,
            relevanceScore: doc.score || 0,
            confidenceScore: doc.confidence_score || 0
          })),
          metadata: {
            queryProcessed: query,
            documentsAnalyzed: documents.length,
            style,
            generatedAt: new Date().toISOString(),
            processingTime: Date.now()
          }
        };
      } catch (error: any) {
        console.error('Summarization failed:', error);
        throw new Error(`Summarization failed: ${error?.message || 'Unknown error'}`);
      }
    },

    buildPrompt(
      query: string,
      context: string,
      sourceCount: number,
      options: SummarizeOptions
    ): string {
      const styleInstructions = this.getStyleInstructions(options.style);
      const toneInstructions = this.getToneInstructions(options.tone);
      
      let focusInstruction = '';
      if (options.focusAreas && options.focusAreas.length > 0) {
        focusInstruction = `\n\nPay special attention to these areas: ${options.focusAreas.join(', ')}.`;
      }

      const citationInstruction = options.includeQuotes 
        ? '\n\nInclude relevant direct quotes when they strengthen your points. Use quotation marks and cite as [Source X].'
        : '\n\nParaphrase information without direct quotes, but always cite sources as [Source X].';

      return `You are an expert knowledge assistant helping users understand enterprise documents. 

**Task**: Answer the user's question: "${query}"

**Instructions**:
${styleInstructions}
${toneInstructions}
- Maximum length: ~${options.maxLength} words
- ALWAYS cite sources using [Source X] format where X is the source number
- Only use information from the provided sources
- If sources conflict, acknowledge the differences
- Be accurate and avoid speculation${focusInstruction}${citationInstruction}

**Available Sources** (${sourceCount} documents):

${context}

**Response**:
Based on the provided sources, here's what I found regarding "${query}":`;
    },

    getStyleInstructions(style?: string): string {
      switch (style) {
        case 'brief':
          return '- Provide a concise, bullet-point summary focusing on key facts\n- Use clear, direct language without unnecessary detail';
        case 'technical':
          return '- Include technical details, specific metrics, and implementation details\n- Use precise terminology and explain technical concepts';
        case 'executive':
          return '- Focus on strategic insights, business impact, and high-level implications\n- Emphasize actionable recommendations and key decisions';
        case 'comprehensive':
        default:
          return '- Provide a thorough analysis covering multiple perspectives\n- Include context, details, and implications of the information';
      }
    },

    getToneInstructions(tone?: string): string {
      switch (tone) {
        case 'formal':
          return '- Use formal, academic language with complete sentences\n- Maintain objective, third-person perspective';
        case 'casual':
          return '- Use conversational, accessible language\n- Write as if explaining to a colleague';
        case 'professional':
        default:
          return '- Use clear, professional language that is accessible but authoritative\n- Balance formality with readability';
      }
    },

    extractCitations(response: string, documents: SourceDocument[]) {
      const citationRegex = /\[Source (\d+)\]/g;
      const citations: Array<{
        sourceNumber: number;
        document: SourceDocument;
        contextSnippet: string;
      }> = [];

      let match;
      while ((match = citationRegex.exec(response)) !== null) {
        const sourceNumber = parseInt(match[1]);
        const document = documents[sourceNumber - 1];
        
        if (document) {
          // Extract context around the citation
          const citationIndex = match.index;
          const start = Math.max(0, citationIndex - 100);
          const end = Math.min(response.length, citationIndex + 100);
          const contextSnippet = response.substring(start, end).trim();

          citations.push({
            sourceNumber,
            document,
            contextSnippet
          });
        }
      }

      return citations;
    },

    validateSourceReferences(response: string, documents: SourceDocument[]): string {
      // Check for valid source references and fix any issues
      const citationRegex = /\[Source (\d+)\]/g;
      
      return response.replace(citationRegex, (match, sourceNum) => {
        const num = parseInt(sourceNum);
        if (num > 0 && num <= documents.length) {
          return match; // Valid reference
        } else {
          console.warn(`Invalid source reference: ${match}`);
          return '[Source: Invalid Reference]';
        }
      });
    },

    // Quick summarization for simple queries
    async quickSummarize(
      query: string, 
      documents: SourceDocument[], 
      maxWords: number = 150
    ) {
      if (documents.length === 0) {
        return {
          summary: 'No relevant documents found for your query.',
          citations: [],
          sourceDocuments: []
        };
      }

      const topDocs = documents.slice(0, 3); // Use top 3 most relevant
      
      return this.execute(query, topDocs, {
        style: 'brief',
        maxLength: maxWords,
        includeQuotes: false,
        tone: 'professional'
      });
    },

    // Generate contextual follow-up questions
    async generateFollowUpQuestions(
      originalQuery: string,
      summary: string,
      documents: SourceDocument[]
    ): Promise<string[]> {
      try {
        const categories = [...new Set(documents.map(d => d.category))];
        const departments = [...new Set(documents.map(d => d.department))];

        const prompt = `Based on this query: "${originalQuery}"
And this summary: "${summary}"

Available document categories: ${categories.join(', ')}
Available departments: ${departments.join(', ')}

Generate 3-5 relevant follow-up questions a user might ask. Focus on:
- Deeper exploration of mentioned topics
- Related concepts from available categories
- Implementation or practical aspects
- Comparisons or alternatives

Format as a simple list, one question per line:`;

        const response = await vertexClient.generateText(prompt, {
          temperature: 0.8,
          maxTokens: 300
        });

        return response
          .split('\n')
          .filter(line => line.trim().length > 0)
          .map(line => line.replace(/^[-•*]\s*/, '').trim())
          .filter(question => question.length > 10)
          .slice(0, 5);
      } catch (error) {
        console.warn('Failed to generate follow-up questions:', error);
        return [];
      }
    }
  };
}
