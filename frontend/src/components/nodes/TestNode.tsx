'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { TestNodeData } from '@/types/nodes'
import { FileTextIcon } from '@radix-ui/react-icons'
import { PUBLO_SCREENPLAY } from '@/data/publoScreenplay'

// Export for backward compatibility
export const EXAMPLE_SCREENPLAY_MARKDOWN = PUBLO_SCREENPLAY

// Legacy example (keeping for reference but using PUBLO_SCREENPLAY by default)
const LEGACY_EXAMPLE = `---
format: screenplay
title: The Last Signal
structure:
  - id: act1
    level: 1
    name: Act I - Setup
    wordCount: 5000
  - id: act1_seq1
    level: 2
    name: Sequence 1 - Discovery
    parentId: act1
    wordCount: 2500
  - id: act1_seq1_scene1
    level: 3
    name: Scene 1 - The Transmission
    parentId: act1_seq1
    wordCount: 1250
  - id: act1_seq1_scene2
    level: 3
    name: Scene 2 - The Team Assembles
    parentId: act1_seq1
    wordCount: 1250
  - id: act1_seq2
    level: 2
    name: Sequence 2 - Investigation
    parentId: act1
    wordCount: 2500
  - id: act1_seq2_scene3
    level: 3
    name: Scene 3 - The Analysis
    parentId: act1_seq2
    wordCount: 1250
  - id: act1_seq2_scene4
    level: 3
    name: Scene 4 - First Contact
    parentId: act1_seq2
    wordCount: 1250
---

# Act I - Setup

## Sequence 1 - Discovery

### Scene 1 - The Transmission

INT. CONTROL ROOM - NIGHT

DR. ELENA MITCHELL (40s, sharp-eyed, worn from years at the observatory) stares at the cascading data streams on her terminal. The room hums with the white noise of servers and cooling fans.

Something catches her eye. A pattern. Repeating. Too structured to be natural.

She leans forward, fingers flying across the keyboard, isolating the signal. It pulses with an eerie regularity—70 seconds on, 30 seconds off.

"This can't be right," she whispers.

The signal strengthens. On the screen, waveforms dance in perfect mathematical harmony. This isn't cosmic noise. This is a message.

### Scene 2 - The Team Assembles

INT. CONFERENCE ROOM - DAY

Morning light floods the room as Elena presents her findings to a hastily assembled team: DAVID CHEN, cryptographer; DR. JAMES ROURKE, linguist; and SARAH PATEL, aerospace engineer.

"Seventy seconds on, thirty seconds off. The pattern repeats every hundred cycles, then shifts by exactly 0.0137 seconds," Elena explains, pulling up visualization after visualization.

David leans back, arms crossed. "That's not random. Someone—or something—is trying to communicate."

Sarah's eyes widen. "How far?"

Elena takes a breath. "Proxima Centauri. Four point two light years."

The room falls silent.

## Sequence 2 - Investigation

### Scene 3 - The Analysis

INT. CRYPTOGRAPHY LAB - DAY

David works through the night, walls covered in printouts, mathematical equations scrawled across whiteboards. James sits nearby, testing linguistic patterns against known communication systems.

"It's not binary," David mutters. "At least not in any conventional sense."

James points to a recurring cluster. "What if it's not language at all? What if it's coordinates?"

David stops, turns. "Coordinates to what?"

"Not 'what.' Where. And when."

The two exchange a look. On the screen, the decoded pattern begins to form a three-dimensional structure—a map.

### Scene 4 - First Contact

INT. CONTROL ROOM - NIGHT

The team gathers around Elena's terminal. The decoded map hovers in holographic form: a star system, unmistakably alien in configuration, with a trajectory marker pointing directly at Earth.

"They're not just sending a message," Sarah says quietly. "They're sending an arrival time."

On the screen, the calculation completes:

ESTIMATED ARRIVAL: 14 MONTHS, 7 DAYS, 3 HOURS

The signal continues its rhythm. 70 seconds on. 30 seconds off.

Waiting.
`

function TestNode({ data, selected }: NodeProps<TestNodeData>) {
  const label = data.label || 'TEST CONTENT'
  const format = data.format || 'screenplay'
  
  return (
    <div className="relative">
      {/* Top handle for incoming connections - invisible but functional */}
      <Handle type="target" position={Position.Top} className="!bg-transparent !w-3 !h-3 !border-0 opacity-0" />
      
      {/* Large connector dot behind node - half covered */}
      <div 
        className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full shadow-lg bg-purple-500"
        style={{ pointerEvents: 'none', zIndex: 0 }}
      />
      
      {/* Square node */}
      <div
        className={`relative bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg transition-all overflow-hidden ${
          selected ? 'ring-2 ring-yellow-400 shadow-xl' : 'shadow-md'
        }`}
        style={{ width: 100, height: 100, zIndex: 1 }}
      >
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-white">
          <FileTextIcon className="w-8 h-8" />
          <div className="text-[9px] font-medium tracking-wider uppercase">
            TEST
          </div>
        </div>
      </div>
      
      {/* Label below node */}
      <div className="flex flex-col items-center mt-2" style={{ width: 100 }}>
        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-sans text-center break-words leading-tight w-full">
          {label}
        </div>
        {/* Format badge */}
        <div className="mt-1 inline-block">
          <div 
            className="bg-purple-500 text-white text-[8px] font-semibold uppercase tracking-wide px-2 rounded-full"
            style={{ paddingTop: '1px', paddingBottom: '1px' }}
          >
            {format}
          </div>
        </div>
      </div>
      
      {/* Bottom handle for outgoing connections */}
      <Handle type="source" position={Position.Bottom} className="!bg-purple-500 !w-3 !h-3 !border-2 !border-white" />
    </div>
  )
}

export default memo(TestNode)

