/**
 * SectionCardView Component
 * 
 * Displays a section card with its summary, characters, and coherency issues.
 * This is shown in the structure view (Cards tab) next to each chapter.
 * 
 * Features:
 * - Shows summary of what happens in the section
 * - Lists characters present
 * - Displays coherency issues with severity indicators
 * - Links issues to problematic text in content
 * 
 * Usage:
 *   <SectionCardView
 *     card={sectionCard}
 *     onIssueClick={(issue) => navigateToIssue(issue)}
 *   />
 */

'use client'

import React from 'react'
import { 
  SectionCardDisplay, 
  CoherencyIssue, 
  StoryCharacter,
  CoherencyIssueSeverity
} from '@/types/librarian'

interface SectionCardViewProps {
  /** The section card to display (with resolved entities) */
  card: SectionCardDisplay
  /** Called when user clicks on an issue to navigate to it */
  onIssueClick?: (issue: CoherencyIssue) => void
  /** Called when user clicks on a character */
  onCharacterClick?: (character: StoryCharacter) => void
  /** Whether the card is expanded (shows full details) */
  expanded?: boolean
  /** Called when expand/collapse is toggled */
  onToggleExpand?: () => void
}

export function SectionCardView({
  card,
  onIssueClick,
  onCharacterClick,
  expanded = false,
  onToggleExpand,
}: SectionCardViewProps) {
  // Don't show anything if the card hasn't been analyzed yet
  if (!card.analyzed) {
    return (
      <div className="text-sm text-gray-400 dark:text-gray-500 italic px-3 py-2">
        No summary yet — Ask orchestrator to create one
      </div>
    )
  }
  
  // Count issues by severity
  const errorCount = card.issues?.filter(i => i.severity === 'error').length || 0
  const warningCount = card.issues?.filter(i => i.severity === 'warning').length || 0
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header with summary */}
      <div 
        className="px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750"
        onClick={onToggleExpand}
      >
        <div className="flex items-start justify-between gap-2">
          {/* Summary */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
              {card.summary || 'No summary available'}
            </p>
          </div>
          
          {/* Issue badges */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {errorCount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                {errorCount} ⚠️
              </span>
            )}
            {warningCount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                {warningCount} ⚡
              </span>
            )}
            {/* Expand/collapse indicator */}
            <span className="text-gray-400 dark:text-gray-500 ml-1">
              {expanded ? '▼' : '▶'}
            </span>
          </div>
        </div>
        
        {/* Meta info (always visible) */}
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
          {card.wordCount > 0 && (
            <span>📝 {card.wordCount.toLocaleString()} words</span>
          )}
          {card.characters.length > 0 && (
            <span>👥 {card.characters.length} characters</span>
          )}
          {card.mood && (
            <span>🎭 {card.mood}</span>
          )}
        </div>
      </div>
      
      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          {/* Characters with avatars */}
          {card.characters.length > 0 && (
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Characters
              </h4>
              <div className="flex flex-wrap gap-2">
                {card.characters.map(char => (
                  <button
                    key={char.id}
                    onClick={() => onCharacterClick?.(char)}
                    className={`
                      inline-flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs
                      transition-colors cursor-pointer border
                      ${char.role === 'protagonist' 
                        ? 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50' 
                        : char.role === 'antagonist'
                          ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50'
                          : 'bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }
                    `}
                    title={char.description || char.name}
                  >
                    {/* Character avatar */}
                    {char.photoUrl ? (
                      <img
                        src={char.photoUrl}
                        alt={char.name}
                        className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                        {char.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="font-medium">{char.name}</span>
                    <RoleIcon role={char.role} />
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* New characters introduced (minor/unnamed) */}
          {card.newCharactersIntroduced && card.newCharactersIntroduced.length > 0 && (
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                <span className="text-amber-500">✨</span> New Characters Introduced
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {card.newCharactersIntroduced.map((newChar, idx) => (
                  <span
                    key={idx}
                    className={`
                      inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs
                      ${newChar.promoted
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-dashed border-amber-300 dark:border-amber-600'
                      }
                    `}
                    title={newChar.description || `New character: ${newChar.name}`}
                  >
                    {newChar.promoted ? '✓' : '+'} {newChar.name}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 italic">
                Ask to expand these into full character profiles
              </p>
            </div>
          )}
          
          {/* Key moments */}
          {card.keyMoments.length > 0 && (
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Key Moments
              </h4>
              <ul className="space-y-1">
                {card.keyMoments.slice(0, 3).map((moment, idx) => (
                  <li key={idx} className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2">
                    <span className="text-gray-400">•</span>
                    <span>{moment}</span>
                  </li>
                ))}
                {card.keyMoments.length > 3 && (
                  <li className="text-xs text-gray-400 dark:text-gray-500">
                    +{card.keyMoments.length - 3} more...
                  </li>
                )}
              </ul>
            </div>
          )}
          
          {/* Coherency issues */}
          {card.issues && card.issues.length > 0 && (
            <div className="px-4 py-3">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Issues
              </h4>
              <ul className="space-y-2">
                {card.issues.map(issue => (
                  <li 
                    key={issue.id}
                    onClick={() => onIssueClick?.(issue)}
                    className={`
                      text-sm rounded-md px-3 py-2 cursor-pointer transition-colors
                      ${issue.severity === 'error'
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30'
                        : issue.severity === 'warning'
                          ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/30'
                          : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                      }
                    `}
                  >
                    <div className="flex items-start gap-2">
                      <SeverityIcon severity={issue.severity} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{formatIssueType(issue.type)}</p>
                        <p className="text-xs opacity-80 mt-0.5">{issue.description}</p>
                        {issue.problematicText && (
                          <p className="text-xs mt-1 italic opacity-70 truncate">
                            &quot;{issue.problematicText}&quot;
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Dependencies */}
          {card.dependencies.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Dependencies
              </h4>
              <ul className="space-y-1">
                {card.dependencies.map((dep, idx) => (
                  <li key={idx} className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <DependencyIcon type={dep.type} />
                    <span>{dep.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function RoleIcon({ role }: { role: string }) {
  switch (role) {
    case 'protagonist':
      return <span>⭐</span>
    case 'antagonist':
      return <span>💀</span>
    case 'supporting':
      return <span>👤</span>
    default:
      return <span>·</span>
  }
}

function SeverityIcon({ severity }: { severity: CoherencyIssueSeverity }) {
  switch (severity) {
    case 'error':
      return <span className="flex-shrink-0">🔴</span>
    case 'warning':
      return <span className="flex-shrink-0">🟡</span>
    case 'info':
      return <span className="flex-shrink-0">🔵</span>
    default:
      return null
  }
}

function DependencyIcon({ type }: { type: string }) {
  switch (type) {
    case 'requires':
      return <span>⬅️</span>
    case 'references':
      return <span>🔗</span>
    case 'builds_on':
      return <span>📈</span>
    case 'contradicts_if':
      return <span>⚠️</span>
    default:
      return <span>→</span>
  }
}

function formatIssueType(type: string): string {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// ============================================================================
// COMPACT CARD (for sidebar/list views)
// ============================================================================

interface SectionCardCompactProps {
  card: SectionCardDisplay
  onClick?: () => void
  isActive?: boolean
}

export function SectionCardCompact({
  card,
  onClick,
  isActive = false,
}: SectionCardCompactProps) {
  const hasIssues = card.issues && card.issues.length > 0
  const hasErrors = card.issues?.some(i => i.severity === 'error')
  
  return (
    <div 
      onClick={onClick}
      className={`
        px-3 py-2 rounded-lg cursor-pointer transition-colors
        ${isActive 
          ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800' 
          : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent'
        }
      `}
    >
      <div className="flex items-center gap-2">
        {/* Status indicator */}
        <span className={`
          w-2 h-2 rounded-full flex-shrink-0
          ${!card.analyzed 
            ? 'bg-gray-300 dark:bg-gray-600' 
            : hasErrors
              ? 'bg-red-500'
              : hasIssues
                ? 'bg-yellow-500'
                : 'bg-green-500'
          }
        `} />
        
        {/* Section name */}
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate flex-1">
          {card.sectionName}
        </span>
        
        {/* Word count */}
        {card.wordCount > 0 && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {card.wordCount.toLocaleString()}w
          </span>
        )}
      </div>
      
      {/* Summary preview */}
      {card.analyzed && card.summary && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1 pl-4">
          {card.summary}
        </p>
      )}
    </div>
  )
}

