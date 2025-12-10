// ============================================================
// OrchestratorChatMessage Component
// ============================================================
// Renders different message types with appropriate styling

import React from 'react';
import type { ChatMessage } from '../../hooks/useOrchestratorStream';
import type { StructureCreatedEvent } from '../../types/orchestrator-streaming-types';

interface OrchestratorChatMessageProps {
  message: ChatMessage;
}

export function OrchestratorChatMessage({ message }: OrchestratorChatMessageProps) {
  const baseClasses = "px-4 py-3 rounded-lg max-w-[85%] animate-in fade-in slide-in-from-bottom-2 duration-300";
  
  switch (message.type) {
    case 'user':
      return (
        <div className="flex justify-end">
          <div className={`${baseClasses} bg-blue-600 text-white`}>
            {message.content}
          </div>
        </div>
      );

    case 'assistant':
      return (
        <div className="flex justify-start">
          <div className={`${baseClasses} bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100`}>
            {message.content}
          </div>
        </div>
      );

    case 'progress':
      return (
        <div className="flex justify-start">
          <div className={`${baseClasses} bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800`}>
            <span className="inline-block animate-pulse mr-2">●</span>
            {message.content}
          </div>
        </div>
      );

    case 'structure':
      const structureData = message.metadata?.structure as StructureCreatedEvent | undefined;
      return (
        <div className="flex justify-start">
          <div className={`${baseClasses} bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800`}>
            <div className="font-medium">{message.content}</div>
            {structureData && (
              <div className="mt-2 text-sm opacity-80">
                {structureData.sections.slice(0, 3).map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <span className="text-xs">○</span>
                    {s.title}
                  </div>
                ))}
                {structureData.sections.length > 3 && (
                  <div className="text-xs mt-1 opacity-60">
                    +{structureData.sections.length - 3} more sections
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );

    case 'section-progress':
      return (
        <div className="flex justify-start">
          <div className={`${baseClasses} bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-sm`}>
            <span className="inline-block animate-spin mr-2">⏳</span>
            {message.content}
          </div>
        </div>
      );

    case 'thinking':
      return (
        <div className="flex justify-start">
          <div className={`${baseClasses} bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-sm italic border border-gray-200 dark:border-gray-700`}>
            💭 {message.content}
          </div>
        </div>
      );

    case 'error':
      return (
        <div className="flex justify-start">
          <div className={`${baseClasses} bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800`}>
            {message.content}
          </div>
        </div>
      );

    default:
      return (
        <div className="flex justify-start">
          <div className={`${baseClasses} bg-gray-100 dark:bg-gray-800`}>
            {message.content}
          </div>
        </div>
      );
  }
}

// ============================================================
// StructureProgressPanel Component
// ============================================================
// Shows the progressive creation with visual feedback

import type { CreationProgress } from '../../types/orchestrator-streaming-types';

interface StructureProgressPanelProps {
  progress: CreationProgress;
  className?: string;
}

export function StructureProgressPanel({ progress, className = '' }: StructureProgressPanelProps) {
  if (!progress.isActive || !progress.structure) {
    return null;
  }

  const { structure, percentComplete, stage, currentSection } = progress;

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📖</span>
            <span className="font-semibold">{structure.title}</span>
          </div>
          <span className="text-sm opacity-80">
            {stage === 'complete' ? '✓ Complete' : `${Math.round(percentComplete)}%`}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500 ease-out"
          style={{ width: `${percentComplete}%` }}
        />
      </div>

      {/* Sections list */}
      <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
        {structure.sections.map((section, index) => (
          <SectionProgressItem
            key={section.id}
            title={section.title}
            status={section.status}
            preview={section.preview}
            wordCount={section.wordCount}
            isActive={section.title === currentSection}
            index={index + 1}
          />
        ))}
      </div>

      {/* Footer status */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500">
        {stage === 'planning' && '🤔 Planning structure...'}
        {stage === 'structuring' && '📐 Building outline...'}
        {stage === 'writing' && `✍️ Writing: ${currentSection || '...'}`}
        {stage === 'reviewing' && '🔍 Reviewing content...'}
        {stage === 'complete' && '✅ All sections complete!'}
        {stage === 'error' && `❌ Error: ${progress.error}`}
      </div>
    </div>
  );
}

// ============================================================
// SectionProgressItem Component
// ============================================================

interface SectionProgressItemProps {
  title: string;
  status: 'pending' | 'writing' | 'complete';
  preview?: string;
  wordCount?: number;
  isActive: boolean;
  index: number;
}

function SectionProgressItem({
  title,
  status,
  preview,
  wordCount,
  isActive,
  index,
}: SectionProgressItemProps) {
  const statusConfig = {
    pending: {
      icon: '○',
      bg: 'bg-gray-50 dark:bg-gray-800',
      border: 'border-gray-200 dark:border-gray-700',
      text: 'text-gray-400',
    },
    writing: {
      icon: '●',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'border-amber-300 dark:border-amber-700',
      text: 'text-amber-600 dark:text-amber-400',
    },
    complete: {
      icon: '✓',
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-300 dark:border-green-700',
      text: 'text-green-600 dark:text-green-400',
    },
  };

  const config = statusConfig[status];

  return (
    <div
      className={`
        p-3 rounded-lg border transition-all duration-300
        ${config.bg} ${config.border}
        ${isActive ? 'ring-2 ring-amber-400 ring-offset-2' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Status indicator */}
        <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${config.text} font-medium text-sm`}>
          {status === 'writing' ? (
            <span className="animate-pulse">{config.icon}</span>
          ) : (
            config.icon
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`font-medium ${status === 'pending' ? 'text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
              {index}. {title}
            </span>
            {wordCount && (
              <span className="text-xs text-gray-400 flex-shrink-0">
                {wordCount} words
              </span>
            )}
          </div>
          
          {/* Preview text */}
          {preview && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
              "{preview}"
            </p>
          )}
          
          {/* Loading state */}
          {status === 'writing' && (
            <div className="mt-2 flex gap-1">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}
          
          {/* Pending state */}
          {status === 'pending' && (
            <p className="mt-1 text-xs text-gray-400 italic">
              Waiting...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// OrchestratorChat Component (Putting it all together)
// ============================================================

interface OrchestratorChatProps {
  messages: ChatMessage[];
  progress: CreationProgress;
  isStreaming: boolean;
  onSend: (message: string) => void;
  className?: string;
}

export function OrchestratorChat({
  messages,
  progress,
  isStreaming,
  onSend,
  className = '',
}: OrchestratorChatProps) {
  const [input, setInput] = React.useState('');
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isStreaming) {
      onSend(input.trim());
      setInput('');
    }
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message) => (
          <OrchestratorChatMessage key={message.id} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Progress panel (shows when creating) */}
      {progress.isActive && progress.structure && (
        <div className="px-4 pb-4">
          <StructureProgressPanel progress={progress} />
        </div>
      )}

      {/* Input area */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isStreaming ? 'Creating...' : 'Create a story about...'}
            disabled={isStreaming}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isStreaming ? '...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default OrchestratorChat;