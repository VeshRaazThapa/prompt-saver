'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut, getProviders } from 'next-auth/react';
import { SearchBar } from './SearchBar';

export function Navigation() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const isLibraryPage = pathname === '/';
  const [hasProviders, setHasProviders] = useState(false);

  useEffect(() => {
    getProviders().then((p) => {
      setHasProviders(p !== null && Object.keys(p).length > 0);
    });
  }, []);

  return (
    <nav className="border-b border-stone-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-4">
          <Link href="/" className="shrink-0 font-display text-xl text-stone-900">
            Prompt Saver
          </Link>

          {!isLibraryPage && <SearchBar className="hidden sm:block sm:max-w-md sm:flex-1" />}

          <div className="flex items-center gap-3">
            <Link
              href="/prompts/new"
              className="rounded-md bg-primary px-3 min-h-[44px] inline-flex items-center text-sm font-medium text-white transition-colors duration-150 ease-out hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              + New Prompt
            </Link>

            {session?.user ? (
              <div className="flex items-center gap-2">
                {session.user.image && (
                  <img
                    src={session.user.image}
                    alt={session.user.name ?? ''}
                    className="h-7 w-7 rounded-full"
                  />
                )}
                <span className="hidden text-sm text-stone-600 sm:inline">
                  {session.user.name}
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="min-h-[44px] px-2 text-sm text-stone-500 transition-colors duration-150 hover:text-stone-700"
                >
                  Sign Out
                </button>
              </div>
            ) : hasProviders ? (
              <Link
                href="/auth/signin"
                className="min-h-[44px] inline-flex items-center px-2 text-sm font-medium text-stone-600 transition-colors duration-150 hover:text-stone-900"
              >
                Sign In
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
}
