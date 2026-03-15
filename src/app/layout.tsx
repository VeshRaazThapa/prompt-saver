import type { Metadata } from 'next';
import React from 'react';
import '../styles/globals.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Navigation } from '@/components/Navigation';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: 'Prompt Saver',
  description: 'LLM Prompt Intelligence Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          <Providers>
            <Navigation />
            <main className="min-h-screen bg-gray-50">{children}</main>
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
