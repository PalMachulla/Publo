# Database Structure - Node Instances

## ✅ Current Setup is Correct - No New Table Needed!

### How It Works:

#### 1. **`nodes` Table** (Your Unique Instances)
Each row = One unique node on your canvas
```
node_id: 'node-123'
story_id: 'canvas-abc'
node_type: 'story'
position: {x: 100, y: 200}
data: {
  label: 'ALICE IN WONDERLAND',
  bookId: 'book-uuid-1',
  bookTitle: 'Alice in Wonderland',
  bookAuthor: 'Lewis Carroll',
  image: 'cover-url',
  description: '...'
}
```

#### 2. **`story_books` Table** (Reference Catalog)
Read-only book catalog (shared by all users)
```
id: 'book-uuid-1'
title: 'Alice in Wonderland'
author: 'Lewis Carroll'
year: 1865
cover_url: 'https://...'
description: '...'
```

### Key Points:

✅ **Each node is a unique instance** - You can have 10 nodes all referencing "Alice in Wonderland", and each will have its own:
- Position on canvas
- Title (can be customized)
- Description
- Comments
- Settings

✅ **Book catalog is shared** - All users see the same 15 books, but each user creates their own node instances

✅ **Updates are isolated** - Changing book in one node doesn't affect other nodes

### Example Scenario:

```
Canvas 1:
- Node A: Alice in Wonderland (position: top-left, title: "ALICE")
- Node B: Alice in Wonderland (position: bottom-right, title: "WONDERLAND STORY")
- Node C: Sherlock Holmes (position: center)

Each node is completely separate, even though A and B reference the same book!
```

### Data Flow:

1. **Create node** → New row in `nodes` table
2. **Select book** → `bookId` stored in node's data (references `story_books`)
3. **Change book** → Only that node's data updates
4. **Title/image updates** → Automatically reflected on canvas
5. **Save canvas** → All node data persisted

### No Additional Tables Needed Because:

- ✅ `nodes` already stores each unique instance
- ✅ `story_books` is just a reference catalog
- ✅ Many-to-one relationship: Many nodes can reference one book
- ✅ Node data (title, description, etc.) is stored per-node, not per-book

