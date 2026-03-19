'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { SearchBar } from './SearchBar';

export function Navigation() {
  const { data: session } = useSession();

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="shrink-0 text-lg font-bold text-gray-900">
            Prompt Saver
          </Link>

          {/* Search */}
          <SearchBar className="hidden sm:block sm:max-w-md sm:flex-1" />

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/prompts/new"
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
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
                <span className="hidden text-sm text-gray-700 sm:inline">
                  {session.user.name}
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                href="/auth/signin"
                className="text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
