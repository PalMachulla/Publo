/**
 * MarkdownContent Atom
 * 
 * Renders markdown content with proper styling for chat and content areas.
 * Uses ReactMarkdown with GitHub Flavored Markdown support.
 */

'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export interface MarkdownContentProps {
  children: string
  className?: string
  /** Compact mode reduces spacing for chat bubbles */
  compact?: boolean
}

export function MarkdownContent({
  children,
  className = '',
  compact = false
}: MarkdownContentProps) {
  // Custom components for proper markdown rendering
  const components = {
    // Paragraphs
    p: ({ children: pChildren, ...props }: React.HTMLAttributes<HTMLParagraphElement> & { children?: React.ReactNode }) => (
      <p 
        className={compact ? 'mb-2 last:mb-0' : 'mb-3 last:mb-0'} 
        {...props}
      >
        {pChildren}
      </p>
    ),
    
    // Headings
    h1: ({ children: h1Children, ...props }: React.HTMLAttributes<HTMLHeadingElement> & { children?: React.ReactNode }) => (
      <h1 className="text-2xl uppercase mb-2 mt-3 first:mt-0 " {...props}>{h1Children}</h1>
    ),
    h2: ({ children: h2Children, ...props }: React.HTMLAttributes<HTMLHeadingElement> & { children?: React.ReactNode }) => (
      <h2 className=" text-lg font-bold mb-3 mt-4 first:mt-0 " {...props}>{h2Children}</h2>
    ),
    h3: ({ children: h3Children, ...props }: React.HTMLAttributes<HTMLHeadingElement> & { children?: React.ReactNode }) => (
      <h3 className="text-sm font-bold py-2 px-4  rounded-md mb-2 mt-2 first:mt-0 bg-zinc-200" {...props}>{h3Children}</h3>
    ),
    
    // Lists
    ul: ({ children: ulChildren, ...props }: React.HTMLAttributes<HTMLUListElement> & { children?: React.ReactNode }) => (
      <ul 
        className={`list-disc pl-4 space-y-1 ${compact ? 'mb-2' : 'mb-3'} last:mb-0`} 
        {...props}
      >
        {ulChildren}
      </ul>
    ),
    ol: ({ children: olChildren, ...props }: React.HTMLAttributes<HTMLOListElement> & { children?: React.ReactNode }) => (
      <ol 
        className={`list-decimal pl-4 space-y-1 ${compact ? 'mb-2' : 'mb-3'} last:mb-0`} 
        {...props}
      >
        {olChildren}
      </ol>
    ),
    li: ({ children: liChildren, ...props }: React.HTMLAttributes<HTMLLIElement> & { children?: React.ReactNode }) => (
      <li className="leading-relaxed text-sm" {...props}>{liChildren}</li>
    ),
    
    // Inline elements
    strong: ({ children: strongChildren, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) => (
      <strong className="font-semibold" {...props}>{strongChildren}</strong>
    ),
    em: ({ children: emChildren, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) => (
      <em className="italic" {...props}>{emChildren}</em>
    ),
    
    // Code
    code: ({ children: codeChildren, className: codeClassName, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) => {
      // Check if it's a code block (has language class) or inline code
      const isInline = !codeClassName
      
      if (isInline) {
        return (
          <code 
            className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-sm font-mono" 
            {...props}
          >
            {codeChildren}
          </code>
        )
      }
      
      return (
        <code className={`${codeClassName} font-mono text-sm`} {...props}>
          {codeChildren}
        </code>
      )
    },
    pre: ({ children: preChildren, ...props }: React.HTMLAttributes<HTMLPreElement> & { children?: React.ReactNode }) => (
      <pre 
        className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 overflow-x-auto mb-3 last:mb-0" 
        {...props}
      >
        {preChildren}
      </pre>
    ),
    
    // Blockquote
    blockquote: ({ children: bqChildren, ...props }: React.HTMLAttributes<HTMLQuoteElement> & { children?: React.ReactNode }) => (
      <blockquote 
        className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-600 dark:text-gray-400 mb-3 last:mb-0" 
        {...props}
      >
        {bqChildren}
      </blockquote>
    ),
    
    // Links
    a: ({ children: aChildren, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { children?: React.ReactNode }) => (
      <a 
        href={href}
        className="text-blue-600 dark:text-blue-400 hover:underline"
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      >
        {aChildren}
      </a>
    ),
    
    // Horizontal rule
    hr: ({ ...props }: React.HTMLAttributes<HTMLHRElement>) => (
      <hr className="border-gray-300 dark:border-gray-600 my-3" {...props} />
    ),
  }

  return (
    <div className={`text-sm leading-relaxed ${className}`}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
