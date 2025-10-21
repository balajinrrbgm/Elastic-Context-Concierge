export function createSummarizeTool(vertexClient: any) {
  return {
    async execute(chunks: any[], style: string = 'comprehensive') {
      const context = chunks.map((c, i) => `[${i+1}] ${c.content}`).join('\n\n');
      const prompt = `Summarize the following content. Cite sources using [n].\n\n${context}`;
      const summary = await vertexClient.generateContent(prompt);

      return {
        summary,
        citations: chunks.map((c, i) => ({ index: i+1, source: c.source }))
      };
    }
  };
}
