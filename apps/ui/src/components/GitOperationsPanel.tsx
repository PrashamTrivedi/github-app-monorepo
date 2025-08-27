'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import type { GitOperation } from '@github-app/shared';

interface GitOperationsPanelProps {
  repository: {
    owner: string;
    repo: string;
  };
}

interface GitOperationStatus {
  id: string;
  type: 'clone' | 'pull' | 'commit' | 'push';
  status: 'pending' | 'running' | 'completed' | 'failed';
  message?: string;
  startedAt: string;
  completedAt?: string;
  logs?: string[];
}

export function GitOperationsPanel({ repository }: GitOperationsPanelProps) {
  const [operations, setOperations] = useState<GitOperationStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [commitFiles, setCommitFiles] = useState<Array<{ path: string; content: string }>>([]);
  const [showCommitForm, setShowCommitForm] = useState(false);

  // Poll for operation status updates
  useEffect(() => {
    if (operations.some(op => op.status === 'pending' || op.status === 'running')) {
      const interval = setInterval(async () => {
        // This would poll the backend for operation status
        // For now, we'll simulate with timeout updates
        setOperations(prev => 
          prev.map(op => {
            if (op.status === 'running' && Math.random() > 0.7) {
              return {
                ...op,
                status: 'completed',
                completedAt: new Date().toISOString(),
                logs: [...(op.logs || []), 'Operation completed successfully']
              };
            }
            return op;
          })
        );
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [operations]);

  const executeOperation = async (type: 'clone' | 'pull' | 'push' | 'commit', operation?: Partial<GitOperation>) => {
    setIsLoading(true);
    
    const operationId = `${type}-${Date.now()}`;
    const newOperation: GitOperationStatus = {
      id: operationId,
      type,
      status: 'pending',
      startedAt: new Date().toISOString(),
      logs: [`Starting ${type} operation...`]
    };
    
    setOperations(prev => [newOperation, ...prev]);

    try {
      const payload: GitOperation = {
        type,
        repository: `${repository.owner}/${repository.repo}`,
        branch: 'main',
        ...operation
      };

      // Update to running status
      setOperations(prev => 
        prev.map(op => op.id === operationId ? { ...op, status: 'running' } : op)
      );

      const response = await apiClient.executeGitOperation(payload);
      
      if (response.success) {
        setOperations(prev => 
          prev.map(op => op.id === operationId ? {
            ...op,
            status: 'completed',
            completedAt: new Date().toISOString(),
            logs: [...(op.logs || []), 'Operation completed successfully']
          } : op)
        );
      } else {
        setOperations(prev => 
          prev.map(op => op.id === operationId ? {
            ...op,
            status: 'failed',
            completedAt: new Date().toISOString(),
            message: response.error || 'Operation failed',
            logs: [...(op.logs || []), `Error: ${response.error}`]
          } : op)
        );
      }
    } catch (error) {
      setOperations(prev => 
        prev.map(op => op.id === operationId ? {
          ...op,
          status: 'failed',
          completedAt: new Date().toISOString(),
          message: error instanceof Error ? error.message : 'Operation failed',
          logs: [...(op.logs || []), `Error: ${error}`]
        } : op)
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    
    await executeOperation('commit', {
      message: commitMessage,
      files: commitFiles
    });
    
    setCommitMessage('');
    setCommitFiles([]);
    setShowCommitForm(false);
  };

  const addCommitFile = () => {
    setCommitFiles(prev => [...prev, { path: '', content: '' }]);
  };

  const updateCommitFile = (index: number, field: 'path' | 'content', value: string) => {
    setCommitFiles(prev => 
      prev.map((file, i) => i === index ? { ...file, [field]: value } : file)
    );
  };

  const removeCommitFile = (index: number) => {
    setCommitFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getStatusIcon = (status: GitOperationStatus['status']) => {
    switch (status) {
      case 'pending':
        return <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />;
      case 'running':
        return <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />;
      case 'completed':
        return (
          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const getStatusColor = (status: GitOperationStatus['status']) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-800';
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
    }
  };

  return (
    <div className="bg-white dark:bg-github-800 rounded-lg shadow-sm border border-github-200 dark:border-github-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-github-900 dark:text-white">
          Git Operations
        </h2>
        <div className="text-sm text-github-500 dark:text-github-400">
          {repository.owner}/{repository.repo}
        </div>
      </div>

      {/* Operation Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <button
          onClick={() => executeOperation('clone')}
          disabled={isLoading}
          className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-md transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Clone
        </button>
        
        <button
          onClick={() => executeOperation('pull')}
          disabled={isLoading}
          className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-green-400 rounded-md transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Pull
        </button>
        
        <button
          onClick={() => setShowCommitForm(!showCommitForm)}
          disabled={isLoading}
          className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 rounded-md transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Commit
        </button>
        
        <button
          onClick={() => executeOperation('push')}
          disabled={isLoading}
          className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 rounded-md transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
          Push
        </button>
      </div>

      {/* Commit Form */}
      {showCommitForm && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-github-700 rounded-lg border border-gray-200 dark:border-github-600">
          <h3 className="text-sm font-medium text-github-900 dark:text-white mb-3">Create Commit</h3>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="commit-message" className="block text-sm font-medium text-github-700 dark:text-github-300 mb-1">
                Commit Message
              </label>
              <input
                id="commit-message"
                type="text"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Enter commit message..."
                className="w-full px-3 py-2 border border-github-300 dark:border-github-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-github-600 dark:text-white"
              />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-github-700 dark:text-github-300">
                  Files to Commit
                </label>
                <button
                  onClick={addCommitFile}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  + Add File
                </button>
              </div>
              
              {commitFiles.map((file, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 p-3 border border-github-200 dark:border-github-600 rounded">
                  <div>
                    <input
                      type="text"
                      value={file.path}
                      onChange={(e) => updateCommitFile(index, 'path', e.target.value)}
                      placeholder="File path (e.g., src/example.js)"
                      className="w-full px-3 py-2 text-sm border border-github-300 dark:border-github-600 rounded-md dark:bg-github-600 dark:text-white"
                    />
                  </div>
                  <div className="flex">
                    <textarea
                      value={file.content}
                      onChange={(e) => updateCommitFile(index, 'content', e.target.value)}
                      placeholder="File content..."
                      rows={3}
                      className="flex-1 px-3 py-2 text-sm border border-github-300 dark:border-github-600 rounded-l-md dark:bg-github-600 dark:text-white"
                    />
                    <button
                      onClick={() => removeCommitFile(index)}
                      className="px-3 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-r-md"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowCommitForm(false)}
                className="px-4 py-2 text-sm font-medium text-github-700 dark:text-github-300 bg-white dark:bg-github-600 border border-github-300 dark:border-github-600 rounded-md hover:bg-gray-50 dark:hover:bg-github-500"
              >
                Cancel
              </button>
              <button
                onClick={handleCommit}
                disabled={!commitMessage.trim() || isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 rounded-md"
              >
                Create Commit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Operations History */}
      <div>
        <h3 className="text-sm font-medium text-github-900 dark:text-white mb-3">
          Recent Operations
        </h3>
        
        {operations.length === 0 ? (
          <div className="text-center py-8 text-github-500 dark:text-github-400">
            No git operations yet. Start by cloning the repository.
          </div>
        ) : (
          <div className="space-y-3">
            {operations.map((operation) => (
              <div key={operation.id} className="border border-github-200 dark:border-github-600 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(operation.status)}
                    <span className="font-medium text-github-900 dark:text-white capitalize">
                      {operation.type}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(operation.status)}`}>
                      {operation.status}
                    </span>
                  </div>
                  <div className="text-xs text-github-500 dark:text-github-400">
                    {new Date(operation.startedAt).toLocaleTimeString()}
                  </div>
                </div>
                
                {operation.message && (
                  <div className="text-sm text-github-600 dark:text-github-300 mb-2">
                    {operation.message}
                  </div>
                )}
                
                {operation.logs && operation.logs.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-github-500 dark:text-github-400 hover:text-github-700 dark:hover:text-github-200">
                      View logs ({operation.logs.length})
                    </summary>
                    <div className="mt-2 p-2 bg-gray-50 dark:bg-github-700 rounded text-github-700 dark:text-github-300 font-mono">
                      {operation.logs.map((log, index) => (
                        <div key={index}>{log}</div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}