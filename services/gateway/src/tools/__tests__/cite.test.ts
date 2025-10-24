/**
 * Unit tests for Citation Tool
 */

import { createCiteTool } from '../cite';

describe('Citation Tool', () => {
  describe('extractCitations', () => {
    it('should extract citations from search results and generated text', () => {
      const searchResults = [
        {
          id: 'doc1',
          title: 'Remote Work Policy',
          content: 'Employees can work remotely three days per week according to company guidelines.'
        },
        {
          id: 'doc2',
          title: 'Office Schedule',
          content: 'The office is open Monday through Friday from 9am to 6pm.'
        }
      ];

      const generatedText = 'Employees can work remotely three days per week. The office hours are Monday to Friday.';

      const citeTool = createCiteTool();
      const citations = citeTool.extractCitations(searchResults, generatedText);

      expect(citations.length).toBeGreaterThan(0);
      expect(citations[0]).toHaveProperty('sourceId');
      expect(citations[0]).toHaveProperty('title');
      expect(citations[0]).toHaveProperty('snippet');
      expect(citations[0]).toHaveProperty('relevanceScore');
    });

    it('should rank citations by relevance', () => {
      const searchResults = [
        { id: 'doc1', title: 'Doc 1', content: 'Apple banana cherry' },
        { id: 'doc2', title: 'Doc 2', content: 'Apple apple apple' }
      ];

      const generatedText = 'Apple is mentioned multiple times in the documents.';

      const citeTool = createCiteTool();
      const citations = citeTool.extractCitations(searchResults, generatedText);

      if (citations.length >= 2) {
        expect(citations[0].relevanceScore).toBeGreaterThanOrEqual(citations[1].relevanceScore);
      }
    });
  });

  describe('formatCitations', () => {
    const citations = [
      { sourceId: 'doc1', title: 'Test Doc 1', snippet: 'Test snippet 1', relevanceScore: 0.9 },
      { sourceId: 'doc2', title: 'Test Doc 2', snippet: 'Test snippet 2', relevanceScore: 0.7 }
    ];

    it('should format citations in inline style', () => {
      const citeTool = createCiteTool();
      const formatted = citeTool.formatCitations(citations, 'inline');

      expect(formatted).toContain('[1]');
      expect(formatted).toContain('Test Doc 1');
      expect(formatted).toContain('Test snippet 1');
    });

    it('should format citations in footnote style', () => {
      const citeTool = createCiteTool();
      const formatted = citeTool.formatCitations(citations, 'footnote');

      expect(formatted).toContain('1.');
      expect(formatted).toContain('90.0%');
    });

    it('should format citations in endnote style', () => {
      const citeTool = createCiteTool();
      const formatted = citeTool.formatCitations(citations, 'endnote');

      expect(formatted).toContain('[1]');
      expect(formatted).toContain('[2]');
    });
  });

  describe('injectInlineCitations', () => {
    it('should inject citation marks into text', () => {
      const text = 'This is a test sentence. This is another sentence.';
      const citations = [
        { sourceId: 'doc1', title: 'Test', snippet: 'test sentence', relevanceScore: 0.9 }
      ];

      const citeTool = createCiteTool();
      const cited = citeTool.injectInlineCitations(text, citations);

      expect(cited).toContain('[1]');
      expect(cited).toContain('**Sources:**');
    });
  });

  describe('verifyCitations', () => {
    it('should verify presence of citations', () => {
      const citeTool = createCiteTool();

      const goodText = 'This is cited [1]. Another citation [2]. **Sources:** [1] Doc 1 [2] Doc 2';
      const result1 = citeTool.verifyCitations(goodText, 2);
      expect(result1.isVerified).toBe(true);
      expect(result1.citationCount).toBe(2);

      const badText = 'This has no citations.';
      const result2 = citeTool.verifyCitations(badText, 2);
      expect(result2.isVerified).toBe(false);
      expect(result2.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('extractSnippet', () => {
    it('should extract relevant snippet from content', () => {
      const content = 'The quick brown fox jumps over the lazy dog. This is a test sentence for extraction.';
      const query = 'test sentence extraction';

      const citeTool = createCiteTool();
      const snippet = citeTool.extractSnippet(content, query);

      expect(snippet).toBeTruthy();
      expect(snippet).toContain('test');
    });

    it('should return null if no match found', () => {
      const content = 'Completely unrelated content';
      const query = 'quantum physics relativity';

      const citeTool = createCiteTool();
      const snippet = citeTool.extractSnippet(content, query);

      expect(snippet).toBeNull();
    });
  });
});
