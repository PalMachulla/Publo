# Node Types Implementation Plan

## ✅ Completed Steps:

1. **Database Migration Created** (`003_add_node_types.sql`)
   - Added `node_type` column to nodes table
   - Created `story_books` table with 15 seeded public domain books
   - Created `documents` table for file uploads
   - Created `characters` table for personas
   - Created `locations` table for map locations
   - Created `links` table for URL scraping
   - Set up RLS policies for all new tables

2. **TypeScript Types Updated** (`types/nodes.ts`)
   - Created `NodeType` union type
   - Created `BaseNodeData` interface
   - Created specific interfaces for each node type:
     - `StoryNodeData`
     - `DocsNodeData`
     - `CharacterNodeData`
     - `LocationNodeData`
     - `LinkNodeData`
   - Added `StoryBook` interface
   - Created `AnyNodeData` union type

3. **Node Type Menu Component** (`components/NodeTypeMenu.tsx`)
   - Created stacked menu with 5 node type options
   - Each option has icon, label, and description
   - Animated slide-in menu
   - Click outside to close

4. **Node Icon Utilities** (`lib/nodeIcons.tsx`)
   - `getNodeIcon()` function returns icon SVG for each type
   - `getNodeColor()` function returns color class for each type
   - Reusable across components

## 🔧 Next Steps:

### Step 1: Update Canvas Page ✅
- ✅ Replace simple "+" button with `NodeTypeMenu` component
- ✅ Update `addNewNode` function to accept node type parameter
- ✅ Initialize node data based on type

### Step 2: Update StoryNode Component ✅
- ✅ Add icon display based on `nodeType`
- ✅ Handle different data structures for each type
- ✅ Update styling to show node type visually with colored icons

### Step 3: Create Specialized Panel Components
For each node type, create a panel component:
- `StoryBookPanel.tsx` - Searchable list of public domain books
- `DocsPanel.tsx` - File upload interface
- `CharacterPanel.tsx` - Bio and photo upload
- `LocationPanel.tsx` - OpenStreetMap integration
- `LinkPanel.tsx` - URL input and scraping

### Step 4: Update NodeDetailsPanel
- Route to appropriate specialized panel based on node type
- Maintain existing comment functionality

### Step 5: Update Save/Load Logic
- Update `stories.ts` to handle different node type data
- Ensure proper saving/loading of specialized data

### Step 6: Run Migration
- Execute `003_add_node_types.sql` in Supabase SQL Editor
- Verify tables are created and books are seeded

## 📋 Implementation Order:

1. ✅ Database schema
2. ✅ TypeScript types
3. ✅ Menu component
4. ✅ Icon utilities
5. **Update canvas page** (next)
6. Update StoryNode component
7. Create specialized panels
8. Update save/load logic
9. Run migration
10. Test all node types

## 🎨 Design Notes:

- Each node type has a unique color
- Icons are displayed in both the menu and on nodes
- Consistent card-based design across all node types
- Right panel adapts to node type

## 🗄️ Database Tables:

- `nodes` - Base node data with `node_type` field
- `story_books` - Public domain book catalog (read-only for users)
- `documents` - User-uploaded files (linked to nodes)
- `characters` - Character personas (one per node)
- `locations` - Geographic locations (one per node)
- `links` - URLs for scraping (many per node)

