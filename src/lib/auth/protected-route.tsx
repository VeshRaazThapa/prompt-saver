'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Higher-order component to protect client components
 * Redirects to sign-in if not authenticated
 */
export function withAuth<P extends Record<string, unknown>>(
  Component: React.ComponentType<P>,
  redirectTo = '/auth/signin'
): React.ComponentType<P> {
  return function AuthenticatedComponent(props: P) {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
      if (status === 'unauthenticated') {
        router.push(redirectTo);
      }
    }, [status, router]);

    if (status === 'loading') {
      return (
        <div className="flex h-screen items-center justify-center">
          <div className="text-lg">Loading...</div>
        </div>
      );
    }

    if (session === null) {
      return null;
    }

    return <Component {...props} />;
  };
}
