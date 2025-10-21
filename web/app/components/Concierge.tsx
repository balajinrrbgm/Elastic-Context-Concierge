"use client";
import React, { useEffect, useRef, useState } from 'react';

type Source = { id?: string; title?: string; content?: string; score?: number };

export default function Concierge({ examples }: { examples?: string[] }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; id?: string }>>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendQuery = async (query: string) => {
    if (!query || !query.trim()) return;
    const id = String(Date.now());
    setMessages((m) => [...m, { role: 'user', content: query, id }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query })
      });
      const data = await res.json();

      const assistantId = String(Date.now() + 1);
      setMessages((m) => [...m, { role: 'assistant', content: data.answer ?? 'No response', id: assistantId }]);
      setSources(data.sources ?? []);
    } catch (err) {
      console.error(err);
      setMessages((m) => [...m, { role: 'assistant', content: 'Sorry, something went wrong.' }]);
    } finally {
      setLoading(false);
      setInput('');
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;
    sendQuery(input.trim());
  };

  const handleExample = (ex: string) => {
    setInput(ex);
    // slight delay so user sees the input set before sending
    setTimeout(() => sendQuery(ex), 150);
  };

  const toggleExpand = (id?: string, idx?: number) => {
    const key = id ?? String(idx ?? 0);
    setExpanded((s) => ({ ...s, [key]: !s[key] }));
  };

  const copyToClipboard = async (text?: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      // simple feedback could be added
    } catch (err) {
      console.warn('Copy failed', err);
    }
  };

  return (
    <div className="container">
      <div className="hero">
        <h2 className="lead">Intelligent, contextual search powered by Elastic + Google Cloud</h2>
        <p className="sub">Hybrid semantic + keyword search combined with generative AI summarization. Ask questions and get concise answers with source citations.</p>
        <div className="examples">
          {(examples ?? ['Summarize the product release notes', 'What is the remote work policy?', 'Show hybrid work schedule']).map((ex, i) => (
            <div key={i} className="chip" onClick={() => handleExample(ex)} role="button" tabIndex={0}>
              {ex}
            </div>
          ))}
        </div>
      </div>

      <section id="demo" className="app-grid" aria-label="Chat and sources">
        <div className="chat-panel">
          <div className="messages" role="log" aria-live="polite">
            {messages.length === 0 && (
              <div className="helper-muted">Try an example above or ask a question about the sample documents.</div>
            )}
            {messages.map((m, i) => (
              <div key={m.id ?? `${m.role}-${i}`} className={`message ${m.role}`}>
                <div>{m.content}</div>
                <div className="meta">{m.role === 'assistant' ? 'Answer generated from Elastic + Vertex.' : 'You'}</div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="input-row" aria-label="Ask a question">
            <input className="input" placeholder="Ask anything about the documents..." value={input} onChange={(e) => setInput(e.target.value)} disabled={loading} />
            <button className="btn" type="submit" disabled={loading}>
              {loading ? <span className="spinner" aria-hidden /> : 'Send'}
            </button>
          </form>
        </div>

        <aside className="sources-panel" aria-label="Search results and sources">
          <h3>Sources <span className="badge">{sources.length}</span></h3>
          {sources.length === 0 && <div className="helper-muted">Search results will appear here with scores and snippets.</div>}
          <div className="source-list-wrap">
            {sources.map((s, idx) => {
              const key = s.id ?? String(idx);
              const isExpanded = !!expanded[key];
              return (
                <div key={key} className="source-card">
                  <div className="meta-row">
                    <h4>{s.title ?? `Source ${idx + 1}`}</h4>
                    <div className="meta-controls">
                      <div className="badge">Score: {typeof s.score === 'number' ? s.score.toFixed(2) : '-'}</div>
                      <button className="chip" onClick={() => toggleExpand(s.id, idx)}>{isExpanded ? 'Collapse' : 'View'}</button>
                    </div>
                  </div>
                  <div className={`snippet ${isExpanded ? 'expanded' : ''}`}>
                    {isExpanded ? s.content : (s.content ? s.content.slice(0, 260) + (s.content.length > 260 ? '…' : '') : '')}
                  </div>
                  <div className="source-actions">
                    <button className="chip" onClick={() => copyToClipboard(s.content)}>Copy</button>
                    <a className="chip" href={`#`} onClick={(e) => { e.preventDefault(); /* placeholder for open */ }}>Open</a>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </section>
      <section id="how" className="how-section">
        <div className="container">
          <h3>How it works</h3>
          <ol className="muted-list">
            <li>Embed the user query using Google Vertex embeddings.</li>
            <li>Run a hybrid Elastic search combining keyword and vector search to retrieve relevant documents.</li>
            <li>Summarize retrieved chunks with a Vertex generative model and return concise answers with citations.</li>
          </ol>
        </div>
      </section>
    </div>
  );
}
