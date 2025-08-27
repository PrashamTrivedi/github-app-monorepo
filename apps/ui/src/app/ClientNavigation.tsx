'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function ClientNavigation() {
  const pathname = usePathname();
  
  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-semibold text-gray-900 hover:text-blue-600 transition-colors">
              GitHub App Dashboard
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === '/'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/settings"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === '/settings'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
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