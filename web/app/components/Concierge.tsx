"use client";
import React, { useEffect, useRef, useState } from 'react';

type Source = { 
  id?: string; 
  title?: string; 
  content?: string; 
  score?: number;
  category?: string;
  department?: string;
  date?: string;
  tags?: string[];
};

type Message = {
  role: 'user' | 'assistant';
  content: string;
  id?: string;
  metrics?: any;
};

type Filters = {
  categories?: string[];
  departments?: string[];
  dateRange?: { start?: string; end?: string };
  tags?: string[];
};

type Aggregations = {
  categories?: Array<{ key: string; doc_count: number }>;
  departments?: Array<{ key: string; doc_count: number }>;
  tags?: Array<{ key: string; doc_count: number }>;
};

export default function Concierge({ examples }: { examples?: string[] }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filters, setFilters] = useState<Filters>({});
  const [aggregations, setAggregations] = useState<Aggregations>({});
  const [showFilters, setShowFilters] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);
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
        body: JSON.stringify({ 
          message: query,
          filters: Object.keys(filters).length > 0 ? filters : undefined
        })
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const assistantId = String(Date.now() + 1);
      setMessages((m) => [...m, { 
        role: 'assistant', 
        content: data.answer ?? 'No response', 
        id: assistantId,
        metrics: data.metrics
      }]);
      setSources(data.sources ?? []);
      setAggregations(data.aggregations ?? {});
      setMetrics(data.metrics);
    } catch (err) {
      console.error('Query error:', err);
      setMessages((m) => [...m, { 
        role: 'assistant', 
        content: `Sorry, something went wrong: ${err instanceof Error ? err.message : 'Unknown error'}`
      }]);
    } finally {
      setLoading(false);
      setInput('');
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;
    sendQuery(input.trim());
  };

  const handleExample = (ex: string) => {
    setInput(ex);
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
    } catch (err) {
      console.warn('Copy failed', err);
    }
  };

  const toggleCategory = (category: string) => {
    setFilters(prev => {
      const categories = prev.categories || [];
      const updated = categories.includes(category)
        ? categories.filter(c => c !== category)
        : [...categories, category];
      return { ...prev, categories: updated.length > 0 ? updated : undefined };
    });
  };

  const toggleDepartment = (dept: string) => {
    setFilters(prev => {
      const departments = prev.departments || [];
      const updated = departments.includes(dept)
        ? departments.filter(d => d !== dept)
        : [...departments, dept];
      return { ...prev, departments: updated.length > 0 ? updated : undefined };
    });
  };

  const clearFilters = () => {
    setFilters({});
  };

  return (
    <div className="container">
      <div className="hero">
        <h2 className="lead">Intelligent, contextual search powered by Elastic + Google Cloud</h2>
        <p className="sub">Advanced hybrid search (BM25 + Vector + RRF) with semantic reranking, faceted filtering, and AI-powered summarization with citations.</p>
        <div className="examples">
          {(examples ?? [
            'Summarize the product release notes',
            'What is the remote work policy?',
            'Compare Q1 and Q2 performance reports',
            'Analyze customer feedback sentiment'
          ]).map((ex, i) => (
            <div key={i} className="chip" onClick={() => handleExample(ex)} role="button" tabIndex={0}>
              {ex}
            </div>
          ))}
        </div>
        
        {/* Metrics Display */}
        {metrics && (
          <div className="metrics-bar">
            <span className="metric">
              <strong>{metrics.totalHits}</strong> results
            </span>
            <span className="metric">
              <strong>{metrics.queryTime}ms</strong> search time
            </span>
            {metrics.usedHybrid && <span className="badge">Hybrid Search</span>}
            {metrics.usedReranking && <span className="badge">Reranked</span>}
          </div>
        )}
      </div>

      <section id="demo" className="app-grid" aria-label="Chat and sources">
        <div className="chat-panel">
          {/* Filter Toggle */}
          <div className="filter-controls">
            <button 
              className="chip" 
              onClick={() => setShowFilters(!showFilters)}
              aria-expanded={showFilters}
            >
              {showFilters ? '✕ Hide' : '⚙ Filters'}
              {Object.keys(filters).length > 0 && (
                <span className="badge">{Object.values(filters).flat().length}</span>
              )}
            </button>
            {Object.keys(filters).length > 0 && (
              <button className="chip" onClick={clearFilters}>
                Clear All
              </button>
            )}
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="filters-panel">
              <h4>Filter by Category</h4>
              <div className="filter-group">
                {(aggregations.categories || []).map(cat => (
                  <label key={cat.key} className="filter-item">
                    <input
                      type="checkbox"
                      checked={filters.categories?.includes(cat.key) || false}
                      onChange={() => toggleCategory(cat.key)}
                    />
                    <span>{cat.key} ({cat.doc_count})</span>
                  </label>
                ))}
              </div>

              <h4>Filter by Department</h4>
              <div className="filter-group">
                {(aggregations.departments || []).map(dept => (
                  <label key={dept.key} className="filter-item">
                    <input
                      type="checkbox"
                      checked={filters.departments?.includes(dept.key) || false}
                      onChange={() => toggleDepartment(dept.key)}
                    />
                    <span>{dept.key} ({dept.doc_count})</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="messages" role="log" aria-live="polite">
            {messages.length === 0 && (
              <div className="helper-muted">Try an example above or ask a question about the sample documents.</div>
            )}
            {messages.map((m, i) => (
              <div key={m.id ?? `${m.role}-${i}`} className={`message ${m.role}`}>
                <div className="message-content">{m.content}</div>
                <div className="meta">
                  {m.role === 'assistant' ? 'AI Assistant' : 'You'}
                  {m.metrics && (
                    <span className="metrics-inline">
                      • {m.metrics.totalHits} hits • {m.metrics.queryTime}ms
                    </span>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="message assistant">
                <div className="typing-indicator">
                  <span></span><span></span><span></span>
                </div>
                <div className="meta">AI is thinking...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="input-row" aria-label="Ask a question">
            <input 
              className="input" 
              placeholder="Ask anything about the documents..." 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              disabled={loading} 
            />
            <button className="btn" type="submit" disabled={loading || !input.trim()}>
              {loading ? <span className="spinner" aria-hidden /> : '→ Send'}
            </button>
          </form>
        </div>

        <aside className="sources-panel" aria-label="Search results and sources">
          <h3>
            Sources 
            <span className="badge">{sources.length}</span>
          </h3>
          {sources.length === 0 && (
            <div className="helper-muted">Search results will appear here with relevance scores and metadata.</div>
          )}
          <div className="source-list-wrap">
            {sources.map((s, idx) => {
              const key = s.id ?? String(idx);
              const isExpanded = !!expanded[key];
              return (
                <div key={key} className="source-card">
                  <div className="meta-row">
                    <h4>{s.title ?? `Source ${idx + 1}`}</h4>
                    <div className="meta-controls">
                      <div className="badge">
                        Score: {typeof s.score === 'number' ? s.score.toFixed(2) : '-'}
                      </div>
                      <button className="chip" onClick={() => toggleExpand(s.id, idx)}>
                        {isExpanded ? '▲ Collapse' : '▼ View'}
                      </button>
                    </div>
                  </div>

                  {/* Metadata */}
                  {(s.category || s.department || s.date) && (
                    <div className="metadata-row">
                      {s.category && <span className="tag">{s.category}</span>}
                      {s.department && <span className="tag">{s.department}</span>}
                      {s.date && <span className="tag">{new Date(s.date).toLocaleDateString()}</span>}
                    </div>
                  )}

                  {s.tags && s.tags.length > 0 && (
                    <div className="tags-row">
                      {s.tags.map((tag, i) => (
                        <span key={i} className="tag-small">{tag}</span>
                      ))}
                    </div>
                  )}

                  <div className={`snippet ${isExpanded ? 'expanded' : ''}`}>
                    {isExpanded 
                      ? s.content 
                      : (s.content ? s.content.slice(0, 260) + (s.content.length > 260 ? '…' : '') : '')}
                  </div>

                  <div className="source-actions">
                    <button className="chip" onClick={() => copyToClipboard(s.content)}>
                      📋 Copy
                    </button>
                    <button className="chip" onClick={() => copyToClipboard(s.title)}>
                      🔗 Copy Title
                    </button>
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
            <li><strong>Hybrid Search:</strong> Combines BM25 lexical search with dense vector embeddings using Reciprocal Rank Fusion (RRF)</li>
            <li><strong>Semantic Reranking:</strong> Reorders results using cross-encoder models for maximum relevance</li>
            <li><strong>Faceted Filtering:</strong> Dynamic filters based on categories, departments, dates, and tags</li>
            <li><strong>AI Summarization:</strong> Vertex AI Gemini generates concise answers with inline citations</li>
            <li><strong>Source Attribution:</strong> Every claim is backed by source documents with confidence scores</li>
          </ol>
        </div>
      </section>
    </div>
  );
}
