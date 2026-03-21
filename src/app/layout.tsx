import type { Metadata } from 'next';
import React from 'react';
import '../styles/globals.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Navigation } from '@/components/Navigation';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: 'Prompt Saver',
  description: 'Save, version, and search your LLM prompts',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ErrorBoundary>
          <Providers>
            <Navigation />
            <main className="min-h-screen bg-stone-50">{children}</main>
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
