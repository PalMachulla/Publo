# Stories & Canvas Management Setup

This document explains how to set up and use the new multi-canvas story management system.

## 🎯 What's New

You can now:
- ✅ Create multiple story canvases
- ✅ Save and load canvas layouts
- ✅ Click nodes to edit properties in a sliding panel
- ✅ Add comments to nodes
- ✅ Manage multiple stories from a dashboard

## 📊 Database Setup

### Step 1: Run the Migration in Supabase

1. Go to your Supabase project: https://supabase.com/dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the contents of `/supabase/migrations/001_create_stories_schema.sql`
5. Paste and click **Run**

This creates three tables:
- `stories` - Your canvas instances
- `nodes` - Story elements (cards)  
- `edges` - Connections between nodes

All tables have Row Level Security (RLS) enabled, so users can only access their own data.

### Step 2: Verify Tables

In Supabase, go to **Table Editor** and verify you see:
- ✅ `stories`
- ✅ `nodes`
- ✅ `edges`

## 🚀 How It Works

### User Flow

1. **Login** → User authenticates with Supabase Auth
2. **Stories Dashboard** (`/stories`) → See all your canvases
3. **Create Story** → Click "New Story" button
4. **Canvas** (`/canvas?id=xxx`) → Edit nodes, add elements
5. **Edit Nodes** → Click any node to open the detail panel
6. **Auto-Save** → Changes save automatically after 2 seconds

### Architecture

```
User (Supabase Auth)
  └── Stories (Canvas Instances)
       ├── Story 1
       │   ├── Nodes (Story elements)
       │   └── Edges (Connections)
       ├── Story 2
       │   ├── Nodes
       │   └── Edges
       └── Story 3...
```

## 🎨 Features

### Stories List Page (`/stories`)

- View all your story canvases
- Create new stories
- Delete existing stories
- See last updated date

### Canvas Page (`/canvas`)

**Left Sidebar:**
- "+" button to add new story nodes
- Nodes auto-connect to the prompt bar

**Main Canvas:**
- Drag and drop nodes
- Create connections between nodes
- Zoom and pan (React Flow controls)
- Minimap for navigation

**Right Panel (opens on node click):**
- Edit node title
- Edit description
- Add comments (with author and timestamp)
- Delete comments (your own only)
- Image upload (coming soon)

### Auto-Save

Changes are automatically saved 2 seconds after:
- Moving nodes
- Editing node properties
- Adding/deleting nodes
- Creating/deleting connections
- Adding comments

## 🔧 Development

### File Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── stories/
│   │   │   └── page.tsx          # Stories dashboard
│   │   └── canvas/
│   │       └── page.tsx          # Canvas editor (updated)
│   ├── components/
│   │   ├── NodeDetailsPanel.tsx  # Right sliding panel
│   │   ├── StoryNode.tsx        # Node component
│   │   └── ContextCanvas.tsx    # Prompt bar component
│   ├── lib/
│   │   └── stories.ts           # Supabase service layer
│   └── types/
│       └── nodes.ts             # TypeScript types

supabase/
└── migrations/
    └── 001_create_stories_schema.sql  # Database schema
```

### Key Functions (`lib/stories.ts`)

```typescript
// Get all stories for current user
await getStories()

// Get story with nodes and edges
await getStory(storyId)

// Create new story
await createStory('My Story Title')

// Save canvas state
await saveCanvas(storyId, nodes, edges)

// Update story metadata
await updateStory(storyId, { title: 'New Title' })

// Delete story
await deleteStory(storyId)
```

## 🎯 Next Steps

### To Add Story Loading to Canvas:

The canvas currently shows default nodes. To load a specific story:

1. The canvas already checks for `?id=xxx` in the URL
2. Uncomment or implement the `loadStory()` function
3. Test by creating a story and opening it from `/stories`

### Future Enhancements:

- [ ] Image upload for nodes (Supabase Storage)
- [ ] Real-time collaboration (Supabase Realtime)
- [ ] Export canvas to PDF/PNG
- [ ] Duplicate stories
- [ ] Story templates
- [ ] Custom node types
- [ ] Version history

## 🔒 Security

All tables use Row Level Security (RLS):
- Users can only see their own stories
- Users can only modify their own data
- Cascading deletes (deleting a story deletes its nodes/edges)

## 📝 Notes

- Comments are stored in the `data` JSONB column of nodes
- Node positions are stored as `position_x` and `position_y`
- Edge styles (color, width) are stored in JSONB
- Auto-save has a 2-second debounce to prevent excessive writes

## 🆘 Troubleshooting

**"Failed to load stories"**
- Check that you ran the database migration
- Verify your Supabase credentials in `.env.local`
- Check browser console for errors

**Panel not opening**
- Make sure you're clicking on a node (not the canvas background)
- Check that `NodeDetailsPanel` is imported

**Auto-save not working**
- Check that you have a `storyId` in the URL (`/canvas?id=xxx`)
- Verify the story exists in the database
- Check network tab for failed API calls

---

**Ready to use!** 🚀

Login and navigate to `/stories` to create your first canvas!

