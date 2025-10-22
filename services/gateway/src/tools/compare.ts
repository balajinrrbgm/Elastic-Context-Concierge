/**
 * Document Comparison Tool
 * Performs side-by-side comparison of multiple documents
 */

interface CompareOptions {
  includeMetadata?: boolean;
  highlightDifferences?: boolean;
  generateSummary?: boolean;
}

export function createCompareTool(vertexClient: any) {
  return {
    async execute(documents: any[], options: CompareOptions = {}) {
      const {
        includeMetadata = true,
        highlightDifferences = true,
        generateSummary = true
      } = options;

      if (documents.length < 2) {
        throw new Error('At least 2 documents required for comparison');
      }

      // Extract key information from each document
      const documentSummaries = await Promise.all(
        documents.map(async (doc) => {
          const summary = await this.extractKeyPoints(doc, vertexClient);
          return {
            id: doc.id,
            title: doc.title,
            keyPoints: summary.keyPoints,
            metadata: includeMetadata ? {
              category: doc.category,
              department: doc.department,
              date: doc.date,
              author: doc.author
            } : undefined
          };
        })
      );

      // Find similarities and differences
      let comparison: any = {
        documents: documentSummaries,
        similarities: [],
        differences: []
      };

      if (highlightDifferences) {
        comparison = await this.analyzeDifferences(documentSummaries, vertexClient);
      }

      // Generate natural language summary
      if (generateSummary) {
        comparison.summary = await this.generateComparisonSummary(comparison, vertexClient);
      }

      return comparison;
    },

    async extractKeyPoints(document: any, vertexClient: any) {
      const prompt = `Extract 5-7 key points from this document:
Title: ${document.title}
Content: ${document.content}

Format as a bulleted list.`;

      const response = await vertexClient.generateText(prompt);
      const keyPoints = response.split('\n')
        .filter((line: string) => line.trim().startsWith('•') || line.trim().startsWith('-'))
        .map((line: string) => line.replace(/^[•\-]\s*/, '').trim());

      return { keyPoints };
    },

    async analyzeDifferences(summaries: any[], vertexClient: any) {
      const prompt = `Compare these documents and identify similarities and differences:

${summaries.map((s, i) => `Document ${i + 1}: ${s.title}
Key Points:
${s.keyPoints.map((p: string) => `- ${p}`).join('\n')}
`).join('\n')}

Provide:
1. Common themes (similarities)
2. Key differences
3. Unique aspects of each document`;

      const analysis = await vertexClient.generateText(prompt);

      // Parse the analysis (simplified)
      return {
        documents: summaries,
        similarities: this.extractSection(analysis, 'similarities'),
        differences: this.extractSection(analysis, 'differences'),
        uniqueAspects: this.extractSection(analysis, 'unique')
      };
    },

    async generateComparisonSummary(comparison: any, vertexClient: any) {
      const prompt = `Generate a concise comparison summary for these documents:
${JSON.stringify(comparison, null, 2)}

Provide a 2-3 sentence executive summary.`;

      return await vertexClient.generateText(prompt);
    },

    extractSection(text: string, keyword: string): string[] {
      // Simple extraction logic (can be enhanced)
      const lines = text.split('\n');
      const result: string[] = [];
      let capturing = false;

      for (const line of lines) {
        if (line.toLowerCase().includes(keyword)) {
          capturing = true;
          continue;
        }
        if (capturing && (line.trim().startsWith('-') || line.trim().startsWith('•'))) {
          result.push(line.replace(/^[•\-]\s*/, '').trim());
        } else if (capturing && line.trim() === '') {
          break;
        }
      }

      return result;
    }
  };
}
