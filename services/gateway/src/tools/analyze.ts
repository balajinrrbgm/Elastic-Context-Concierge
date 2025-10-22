/**
 * Document Analysis Tool
 * Performs deep analysis including sentiment, entities, topics, and insights
 */

interface AnalysisOptions {
  includeSentiment?: boolean;
  includeEntities?: boolean;
  includeTopics?: boolean;
  includeInsights?: boolean;
}

export function createAnalyzeTool(vertexClient: any) {
  return {
    async execute(documents: any[], options: AnalysisOptions = {}) {
      const {
        includeSentiment = true,
        includeEntities = true,
        includeTopics = true,
        includeInsights = true
      } = options;

      const analyses = await Promise.all(
        documents.map(async (doc) => {
          const analysis: any = {
            id: doc.id,
            title: doc.title
          };

          const tasks = [];

          if (includeSentiment) {
            tasks.push(this.analyzeSentiment(doc, vertexClient));
          }
          if (includeEntities) {
            tasks.push(this.extractEntities(doc, vertexClient));
          }
          if (includeTopics) {
            tasks.push(this.extractTopics(doc, vertexClient));
          }
          if (includeInsights) {
            tasks.push(this.generateInsights(doc, vertexClient));
          }

          const results = await Promise.all(tasks);
          let idx = 0;

          if (includeSentiment) analysis.sentiment = results[idx++];
          if (includeEntities) analysis.entities = results[idx++];
          if (includeTopics) analysis.topics = results[idx++];
          if (includeInsights) analysis.insights = results[idx++];

          return analysis;
        })
      );

      // Aggregate insights across all documents
      const aggregate = this.aggregateAnalyses(analyses);

      return {
        documents: analyses,
        aggregate,
        timestamp: new Date().toISOString()
      };
    },

    async analyzeSentiment(document: any, vertexClient: any) {
      const prompt = `Analyze the sentiment of this document and provide a score from -1 (very negative) to 1 (very positive):
      
Title: ${document.title}
Content: ${document.content.substring(0, 1000)}

Respond with:
1. Sentiment score (number between -1 and 1)
2. Sentiment label (positive/negative/neutral)
3. Brief explanation`;

      const response = await vertexClient.generateText(prompt);
      
      // Parse response (simplified)
      const scoreMatch = response.match(/score[:\s]+(-?\d+\.?\d*)/i);
      const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
      
      let label = 'neutral';
      if (score > 0.3) label = 'positive';
      else if (score < -0.3) label = 'negative';

      return { score, label, explanation: response };
    },

    async extractEntities(document: any, vertexClient: any) {
      const prompt = `Extract key entities from this document:
      
Title: ${document.title}
Content: ${document.content.substring(0, 1000)}

List entities in these categories:
- People
- Organizations
- Locations
- Technologies
- Products`;

      const response = await vertexClient.generateText(prompt);

      // Parse entities by category
      return {
        people: this.extractCategory(response, 'people'),
        organizations: this.extractCategory(response, 'organizations'),
        locations: this.extractCategory(response, 'locations'),
        technologies: this.extractCategory(response, 'technologies'),
        products: this.extractCategory(response, 'products')
      };
    },

    async extractTopics(document: any, vertexClient: any) {
      const prompt = `Identify the main topics and themes in this document:
      
Title: ${document.title}
Content: ${document.content.substring(0, 1000)}

List 5-7 main topics with confidence scores.`;

      const response = await vertexClient.generateText(prompt);

      // Parse topics (simplified)
      const topics = response.split('\n')
        .filter((line: string) => line.trim().match(/^[\d•\-]/))
        .map((line: string) => {
          const cleaned = line.replace(/^[\d•\-.\s]+/, '').trim();
          return { topic: cleaned, confidence: 0.8 }; // Placeholder confidence
        });

      return topics;
    },

    async generateInsights(document: any, vertexClient: any) {
      const prompt = `Generate actionable insights from this document:
      
Title: ${document.title}
Content: ${document.content.substring(0, 1000)}

Provide:
1. Key takeaways (3-5 points)
2. Actionable recommendations
3. Potential implications`;

      const response = await vertexClient.generateText(prompt);

      return {
        keyTakeaways: this.extractCategory(response, 'takeaways'),
        recommendations: this.extractCategory(response, 'recommendations'),
        implications: this.extractCategory(response, 'implications'),
        fullAnalysis: response
      };
    },

    extractCategory(text: string, keyword: string): string[] {
      const lines = text.split('\n');
      const result: string[] = [];
      let capturing = false;

      for (const line of lines) {
        if (line.toLowerCase().includes(keyword)) {
          capturing = true;
          continue;
        }
        if (capturing && (line.trim().match(/^[\d•\-]/))) {
          result.push(line.replace(/^[\d•\-.\s]+/, '').trim());
        } else if (capturing && result.length > 0 && line.trim() === '') {
          break;
        }
      }

      return result.filter(r => r.length > 0);
    },

    aggregateAnalyses(analyses: any[]) {
      // Aggregate sentiment
      const sentiments = analyses
        .filter(a => a.sentiment)
        .map(a => a.sentiment.score);
      const avgSentiment = sentiments.length > 0
        ? sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length
        : 0;

      // Aggregate topics
      const allTopics = analyses
        .flatMap(a => a.topics || [])
        .map(t => t.topic);
      const topicCounts = new Map<string, number>();
      allTopics.forEach(t => topicCounts.set(t, (topicCounts.get(t) || 0) + 1));
      const topTopics = Array.from(topicCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([topic, count]) => ({ topic, frequency: count }));

      return {
        totalDocuments: analyses.length,
        averageSentiment: avgSentiment,
        topTopics,
        sentimentDistribution: {
          positive: sentiments.filter(s => s > 0.3).length,
          neutral: sentiments.filter(s => s >= -0.3 && s <= 0.3).length,
          negative: sentiments.filter(s => s < -0.3).length
        }
      };
    }
  };
}
