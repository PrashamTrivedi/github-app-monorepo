'use client';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  className?: string;
}

export function LoadingSpinner({ 
  size = 'md', 
  message,
  className = '' 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div 
        className={`animate-spin rounded-full border-b-2 border-blue-600 ${sizeClasses[size]}`}
      />
      {message && (
        <span className={`mt-3 text-github-600 dark:text-github-300 ${textSizeClasses[size]}`}>
          {message}
        </span>
      )}
    </div>
  );
}

export function PageLoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <LoadingSpinner size="lg" message={message} />
    </div>
  );
}

export function InlineLoadingSpinner({ message }: { message?: string }) {
  return (
    <div className="flex items-center space-x-3 p-4">
      <LoadingSpinner size="sm" />
      {message && (
        <span className="text-sm text-github-600 dark:text-github-300">
          {message}
        </span>
      )}
    </div>
  );
}