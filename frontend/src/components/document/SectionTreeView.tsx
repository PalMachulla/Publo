'use client'

import { memo, type RefObject } from 'react'
import type { StoryStructureItem } from '@/types/nodes'

interface DocumentSection {
  id: string
  structure_item_id: string | null
  word_count: number
  status?: 'draft' | 'in_progress' | 'completed'
}

interface SectionTreeViewProps {
  structureItems: StoryStructureItem[]
  sections: DocumentSection[]
  activeSectionId: string | null
  expandedSections: Set<string>
  toggleSectionExpansion: (itemId: string) => void
  onSectionClick: (itemId: string) => void
  editorContainerRef: RefObject<HTMLDivElement>
  onAddSection?: () => void
}

function SectionTreeView({
  structureItems,
  sections,
  activeSectionId,
  expandedSections,
  toggleSectionExpansion,
  onSectionClick,
  editorContainerRef,
  onAddSection
}: SectionTreeViewProps) {

  // Build hierarchical tree from flat structure
  const buildTree = (items: typeof structureItems, parentId: string | undefined) => {
    return items
      .filter((item) => {
        if (parentId === undefined) {
          return item.parentId === null || item.parentId === undefined || item.parentId === ''
        }
        return item.parentId === parentId
      })
      .sort((a, b) => a.order - b.order)
  }

  const renderTreeLevel = (items: typeof structureItems, level: number = 0) => {
    return items.map((item) => {
      const section = sections.find(s => s.structure_item_id === item.id)
      const children = buildTree(structureItems, item.id)
      const hasChildren = children.length > 0
      const isExpanded = expandedSections.has(item.id)
      const isActive = activeSectionId === item.id || section?.id === activeSectionId

      return (
        <div key={item.id}>
          {/* Section Item Row */}
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors cursor-pointer group ${
              isActive
                ? 'bg-yellow-50 text-yellow-900'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
          >
            {/* Chevron (if has children) */}
            {hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleSectionExpansion(item.id)
                }}
                className="flex-shrink-0 w-4 h-4 flex items-center justify-center hover:bg-gray-200 rounded transition-colors"
              >
                <svg
                  className={`w-3 h-3 text-gray-500 transition-transform ${
                    isExpanded ? 'rotate-90' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <div className="w-4 h-4 flex-shrink-0" />
            )}

            {/* Document Icon */}
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>

            {/* Section Name & Title */}
            <button
              onClick={() => {
                console.log('👆 [SectionTreeView] Setting active section:', item.id, item.name)
                onSectionClick(item.id)
                
                // Scroll to the section anchor in the document
                const sectionId = `section-${item.id}`
                const container = editorContainerRef.current
                
                const scrollToSection = () => {
                  const element = document.getElementById(sectionId)
                  if (element && container) {
                    const containerRect = container.getBoundingClientRect()
                    const elementRect = element.getBoundingClientRect()
                    const offsetTop = elementRect.top - containerRect.top + container.scrollTop - 20
                    
                    container.scrollTo({
                      top: offsetTop,
                      behavior: 'smooth'
                    })
                    return true
                  }
                  return false
                }
                
                // Try to scroll immediately
                const scrolled = scrollToSection()
                
                // If element not found, retry after short delay
                if (!scrolled) {
                  console.log('⏳ [SectionTreeView] Section anchor not found, retrying...')
                  setTimeout(() => {
                    const retried = scrollToSection()
                    if (!retried) {
                      console.warn('⚠️ [SectionTreeView] Section anchor still not found:', sectionId)
                    }
                  }, 200)
                }
              }}
              className="flex-1 text-left text-sm truncate min-w-0 px-1"
            >
              <span className="font-normal">{item.name}</span>
              {item.title && (
                <span className="text-xs text-gray-400 ml-1">• {item.title}</span>
              )}
            </button>

            {/* Word Count */}
            <div className="flex-shrink-0 text-xs text-gray-400 font-mono pr-1">
              {section?.word_count || 0}w
            </div>

            {/* Status Indicator */}
            <div
              className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${
                section?.status === 'completed'
                  ? 'bg-green-500'
                  : section?.status === 'in_progress'
                  ? 'bg-yellow-500'
                  : 'bg-gray-300'
              }`}
              title={section?.status || 'draft'}
            />
          </div>

          {/* Render children (if expanded) */}
          {hasChildren && isExpanded && (
            <div>
              {renderTreeLevel(children, level + 1)}
            </div>
          )}
        </div>
      )
    })
  }

  const rootItems = buildTree(structureItems, undefined)

  // No structure at all
  if (rootItems.length === 0 && structureItems.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="text-gray-400 text-sm mb-4">No structure yet</div>
        {onAddSection && (
          <button
            onClick={onAddSection}
            className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded-lg text-sm font-medium transition-colors"
          >
            + Add First Section
          </button>
        )}
      </div>
    )
  }
  
  // Structure items exist but no root items found (orphaned items)
  if (rootItems.length === 0 && structureItems.length > 0) {
    console.warn('⚠️ [SectionTreeView] No root items! Showing flat list')
    return (
      <div className="py-1">
        {renderTreeLevel(structureItems, 0)}
      </div>
    )
  }

  // Normal tree view
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="py-1">
        {renderTreeLevel(rootItems, 0)}
        
        {/* Add Section Button */}
        {onAddSection && (
          <button
            onClick={onAddSection}
            className="w-full mt-2 mx-2 p-2.5 border-2 border-dashed border-gray-300 hover:border-yellow-400 hover:bg-yellow-50 rounded-md text-sm text-gray-500 hover:text-yellow-900 transition-all"
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="font-medium">Add Section</span>
            </div>
          </button>
        )}
      </div>
    </div>
  )
}

export default memo(SectionTreeView)

