import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ClientNavigation } from './ClientNavigation';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'GitHub App Dashboard',
  description: 'Manage your GitHub repositories and issues with ease',
};


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-github-50 dark:bg-github-900">
          <ClientNavigation />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}