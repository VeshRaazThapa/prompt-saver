'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

/**
 * Navigation component
 * Provides app-wide navigation with authentication state
 */
export function Navigation() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const navItems = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/prompts', label: 'Prompts' },
    { href: '/test-runs', label: 'Test Runs' },
    { href: '/providers', label: 'Providers' },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // Don't render navigation during SSR or while loading
  if (status === 'loading' || typeof window === 'undefined') {
    return null;
  }

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between">
          {/* Logo and main nav */}
          <div className="flex">
            <Link href="/" className="flex items-center">
              <span className="text-xl font-bold text-gray-900">Prompt Platform</span>
            </Link>

            {session !== null && (
              <div className="ml-10 flex space-x-4">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium ${
                      isActive(item.href)
                        ? 'border-blue-600 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* User menu */}
          {session !== null ? (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                {session.user.image !== null && (
                  <img
                    src={session.user.image}
                    alt={session.user.name}
                    className="h-8 w-8 rounded-full"
                  />
                )}
                <span className="text-sm font-medium text-gray-700">{session.user.name}</span>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center">
              <Link
                href="/auth/signin"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
