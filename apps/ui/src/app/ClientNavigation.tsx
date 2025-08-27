'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function ClientNavigation() {
  const pathname = usePathname();
  
  return (
    <nav className="bg-white dark:bg-github-800 shadow-sm border-b border-github-200 dark:border-github-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-semibold text-github-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              GitHub App Dashboard
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === '/'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                  : 'text-github-500 hover:text-github-700 dark:text-github-400 dark:hover:text-github-200'
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/settings"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === '/settings'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                  : 'text-github-500 hover:text-github-700 dark:text-github-400 dark:hover:text-github-200'
              }`}
            >
              Settings
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}