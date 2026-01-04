// ============================================================
// OrchestratorChatMessage Component
// ============================================================
// Renders different message types with appropriate styling

import React from 'react';
import type { ChatMessage } from '../../hooks/useOrchestratorStream';
import type { StructureCreatedEvent } from '../../types/orchestrator-streaming-types';
import { ThinkingBlock } from '../ui/molecules/ThinkingBlock';
import { MarkdownContent } from '../ui/atoms/MarkdownContent';
import { GearIcon, Pencil1Icon, ChatBubbleIcon } from '@radix-ui/react-icons';

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
            <MarkdownContent compact>
              {message.content}
            </MarkdownContent>
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
          <div className={`${baseClasses} bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-sm flex items-center gap-2`}>
            <Pencil1Icon className="w-4 h-4 animate-pulse flex-shrink-0" />
            <span>{message.content}</span>
          </div>
        </div>
      );

    case 'thinking':
      return (
        <div className="flex justify-start">
          <div className={`${baseClasses} bg-neutral-50 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 text-sm border border-neutral-200 dark:border-neutral-700 flex items-center gap-2`}>
            <GearIcon className="w-4 h-4 animate-spin flex-shrink-0" />
            <span>{message.content}</span>
          </div>
        </div>
      );

    case 'reasoning':
      // Cursor-style collapsible thinking block
      const startTime = message.metadata?.startTime 
        ? new Date(message.metadata.startTime as string) 
        : message.timestamp;
      const endTime = message.metadata?.endTime 
        ? new Date(message.metadata.endTime as string) 
        : undefined;
      const isStreaming = message.metadata?.isStreaming as boolean || false;
      
      return (
        <div className="flex justify-start w-full">
          <div className="w-full max-w-[95%]">
            <ThinkingBlock
              content={message.content}
              startTime={startTime}
              endTime={endTime}
              isStreaming={isStreaming}
              defaultCollapsed={!isStreaming}
            />
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
          <div className={`${baseClasses} bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100`}>
            <MarkdownContent compact>
              {message.content}
            </MarkdownContent>
          </div>
        </div>
      );
  }
}

// ============================================================
// StructureProgressPanel Component (Wrapper)
// ============================================================
// Re-exports StructureProgress from molecules with CreationProgress interface

import type { CreationProgress } from '../../types/orchestrator-streaming-types';
import { StructureProgress } from '../ui/molecules/StructureProgress';

interface StructureProgressPanelProps {
  progress: CreationProgress;
  className?: string;
}

/**
 * Wrapper component for backward compatibility.
 * Uses the atomic StructureProgress component internally.
 */
export function StructureProgressPanel({ progress, className = '' }: StructureProgressPanelProps) {
  if (!progress.isActive || !progress.structure) {
    return null;
  }

  return (
    <StructureProgress
      structure={progress.structure}
      stage={progress.stage}
      percentComplete={progress.percentComplete}
      currentSection={progress.currentSection}
      error={progress.error}
      className={className}
    />
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