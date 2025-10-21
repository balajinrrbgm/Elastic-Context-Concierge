import { NextRequest, NextResponse } from 'next/server';

const GATEWAY_URL = process.env.GATEWAY_SERVICE_URL;

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    const searchRes = await fetch(`${GATEWAY_URL}/tool/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: message, topK: 5 })
    });
    const searchResults = await searchRes.json();

    const chunks = searchResults.results.map((r: any) => ({
      content: r.content,
      source: r.title
    }));

    const summaryRes = await fetch(`${GATEWAY_URL}/tool/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chunks })
    });
    const summary = await summaryRes.json();

    return NextResponse.json({
      answer: summary.summary,
      sources: searchResults.results,
      citations: summary.citations
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process' }, { status: 500 });
  }
}
