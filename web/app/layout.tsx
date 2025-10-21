import React from 'react';

import './globals.css';
import Header from './components/Header';

export const metadata = {
  title: 'Elastic Context Concierge',
  description:
    'Demonstration of Elastic hybrid search + Google Cloud generative AI — intelligent, contextual search with source citations.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body>
        <Header />
        {children}
        <footer className="site-footer">
          <div className="container">
            <small>
              Built with Elastic hybrid search + Google Cloud generative AI — demo for the Elastic Challenge. 
            </small>
          </div>
        </footer>
      </body>
    </html>
  );
}
