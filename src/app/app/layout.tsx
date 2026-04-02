import React from 'react';
import { Navigation } from '@/components/Navigation';
import { Providers } from '@/components/Providers';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <ErrorBoundary>
      <Providers>
        <Navigation />
        <main className="min-h-screen bg-stone-50">{children}</main>
      </Providers>
    </ErrorBoundary>
  );
}
