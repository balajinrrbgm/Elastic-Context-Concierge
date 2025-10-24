import { NextRequest, NextResponse } from 'next/server';

const GATEWAY_URL = process.env.GATEWAY_SERVICE_URL || process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:8080';

export async function POST(req: NextRequest) {
  try {
    const { message, filters, history, mode = 'search' } = await req.json();

    // Enhanced search with filters and options
    const searchRes = await fetch(`${GATEWAY_URL}/tool/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        query: message, 
        topK: 5,
        filters: filters || {},
        options: {
          enableReranking: true,
          includeAggregations: true,
          rrfRankConstant: 60,
          rrfWindowSize: 100
        }
      })
    });
    
    if (!searchRes.ok) {
      throw new Error(`Search failed: ${searchRes.statusText}`);
    }
    
    const searchResults = await searchRes.json();

    // Convert search results to the format expected by summarize tool
    const documents = searchResults.results.map((r: any) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      summary: r.summary || r.content.substring(0, 300) + '...',
      category: r.category || 'general',
      department: r.department || 'unknown',
      author: r.author || 'Unknown',
      source_url: r.source_url || '#',
      date: r.date || new Date().toISOString(),
      score: r.score,
      confidence_score: r.confidence_score
    }));

    const summaryRes = await fetch(`${GATEWAY_URL}/tool/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: message, documents, options: { style: 'comprehensive' } })
    });
    
    if (!summaryRes.ok) {
      throw new Error(`Summarization failed: ${summaryRes.statusText}`);
    }
    
    const summary = await summaryRes.json();

    // Add citations
    const citeRes = await fetch(`${GATEWAY_URL}/tool/cite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        searchResults: searchResults.results,
        generatedText: summary.summary,
        style: 'inline'
      })
    });

    let citations = [];
    let citedText = summary.summary;
    
    if (citeRes.ok) {
      const citeData = await citeRes.json();
      citations = citeData.citations || [];
      citedText = citeData.citedText || summary.summary;
    }

    return NextResponse.json({
      answer: citedText,
      sources: searchResults.results,
      citations,
      aggregations: searchResults.aggregations,
      metrics: {
        totalHits: searchResults.totalHits,
        queryTime: searchResults.searchMetrics?.queryTime,
        usedHybrid: searchResults.usedHybrid,
        usedReranking: searchResults.usedReranking
      }
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ 
      error: 'Failed to process request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

