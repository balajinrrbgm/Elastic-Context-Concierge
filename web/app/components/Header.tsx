import React from 'react';

export default function Header() {
  return (
    <header className="site-header">
      <div className="container branding">
        <a className="logo" href="/">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <rect width="24" height="24" rx="6" fill="#052b33" />
            <path d="M6 12h12M6 7h12M6 17h8" stroke="#06b6d4" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <div className="branding-title">Elastic Context Concierge</div>
            <div className="branding-sub">Hybrid search + generative AI demo</div>
          </div>
        </a>
      </div>
      <div className="nav container">
        <nav>
        </nav>
        <a className="btn" href="#demo">Try it</a>
      </div>
    </header>
  );
}
