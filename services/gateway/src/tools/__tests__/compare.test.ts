/**
 * Unit tests for Compare Tool
 */

import { createCompareTool } from '../compare';

describe('Compare Tool', () => {
  let mockVertexClient: any;

  beforeEach(() => {
    mockVertexClient = {
      generateText: jest.fn()
    };
  });

  describe('execute', () => {
    it('should throw error if less than 2 documents provided', async () => {
      const compareTool = createCompareTool(mockVertexClient);
      
      await expect(compareTool.execute([{ id: '1', title: 'Doc 1', content: 'Content 1' }]))
        .rejects
        .toThrow('At least 2 documents required');
    });

    it('should extract key points from documents', async () => {
      const documents = [
        { id: '1', title: 'Doc 1', content: 'Content about AI technology' },
        { id: '2', title: 'Doc 2', content: 'Content about ML models' }
      ];

      mockVertexClient.generateText
        .mockResolvedValueOnce('• Point 1\n• Point 2\n• Point 3')
        .mockResolvedValueOnce('• Point A\n• Point B\n• Point C')
        .mockResolvedValueOnce('Similarities: Both focus on AI\nDifferences: One is about tech, other about models')
        .mockResolvedValueOnce('Both documents discuss AI technologies');

      const compareTool = createCompareTool(mockVertexClient);
      const result = await compareTool.execute(documents, {
        highlightDifferences: true,
        generateSummary: true
      });

      expect(result.documents).toHaveLength(2);
      expect(result.summary).toBeDefined();
    });
  });

  describe('extractKeyPoints', () => {
    it('should extract bullet points from generated text', async () => {
      mockVertexClient.generateText.mockResolvedValue(
        '• First key point\n• Second key point\n- Third key point'
      );

      const compareTool = createCompareTool(mockVertexClient);
      const result = await compareTool.extractKeyPoints(
        { id: '1', title: 'Test', content: 'Test content' },
        mockVertexClient
      );

      expect(result.keyPoints).toHaveLength(3);
      expect(result.keyPoints[0]).toBe('First key point');
    });
  });
});
