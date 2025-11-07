# Node Documentation

## Overview

Publo uses a node-based canvas system for building and organizing story elements. Each canvas contains interconnected nodes that represent different aspects of your story—from source materials and characters to locations and reference links.

---

## What Are Nodes?

Nodes are visual building blocks on your canvas that represent different types of content and information. Each node can be:

- **Created** by clicking the "Add Node" menu on the canvas
- **Edited** by clicking on any node to open its detail panel
- **Connected** to the context node (automatically) or to other nodes
- **Saved** manually using the "Save Changes" button
- **Deleted** from within the node detail panel

All nodes connect to a central **Context Node** at the bottom of the canvas, which serves as your story's prompt bar.

---

## Node Types

### 1. Story Book Node 📖

**Purpose**: Link copyright-free books to your story as source material, inspiration, or style references.

**Features**:
- Search and select from public domain books via Open Library API
- Displays book cover (when available)
- Shows book title, author, publication year, and description
- Assign a role to define how the book influences your story

**Book Roles**:
- **Baseline**: Core story foundation
- **Influence**: Thematic or plot inspiration
- **Writing Style**: Stylistic reference
- **Inform**: Background research or context

**Use Cases**:
- Reference classic literature for plot structures
- Draw inspiration from public domain works
- Study writing styles of master authors
- Build upon existing story worlds

---

### 2. Character Node 👤

**Purpose**: Create and manage characters (personas) for your story.

**Features**:
- Editable name and bio
- Photo upload (or take photo)
- Character library system (private, shared, or public)
- Role assignment for story hierarchy
- Future: AI-powered character profiler chat

**Character Roles**:
- **Main**: Protagonist or primary character
- **Active**: Key supporting character with agency
- **Included**: Regular supporting character
- **Involved**: Minor character with interactions
- **Passive**: Background character

**Visibility Settings**:
- **Private**: Only visible to you
- **Shared**: Accessible to selected collaborators
- **Public**: Available to all Publo users

**Character Library**:
- Browse existing characters from your library
- Reuse characters across multiple stories
- Search and filter by name
- Load character data into any story canvas

**Use Cases**:
- Build character profiles and backstories
- Maintain consistency across story series
- Share character archetypes with collaborators
- Track character relationships and development

---

### 3. Documents Node 📄

**Purpose**: Upload and manage reference documents for your story.

**Features**:
- Upload multiple files (txt, pdf, etc.)
- View uploaded document list
- Track file metadata (name, type, size)

**Supported File Types**:
- Plain text (.txt)
- PDF documents (.pdf)
- Additional formats (planned)

**Use Cases**:
- Upload research materials
- Store plot outlines and notes
- Attach reference documents
- Organize supplementary content

---

### 4. Location Node 📍

**Purpose**: Define and visualize story settings and locations.

**Features**:
- Set location name
- Store coordinates (latitude/longitude)
- Address information
- Future: OpenStreetMap integration

**Use Cases**:
- Map story settings
- Track character movements
- Build consistent world geography
- Reference real-world locations

---

### 5. Link Node 🔗

**Purpose**: Store and organize web links for reference and research.

**Features**:
- Add multiple URLs
- Store link titles
- Future: Web scraping for content extraction
- Organized link management

**Use Cases**:
- Bookmark research articles
- Save reference websites
- Collect inspiration sources
- Organize online resources

---

### 6. Context Node (Special) 💬

**Purpose**: Central hub for your story prompt and canvas interactions.

**Characteristics**:
- Automatically present on every canvas
- Cannot be deleted or moved
- All other nodes connect to it
- Located at the bottom-center of the canvas
- Future: Will accept text input for AI story generation

**Note**: The context node is unique—clicking it does not open a detail panel. It will serve as the input interface for AI-powered story generation in future updates.

---

## Working with Nodes

### Creating a Node

1. Click the **"Add Node"** button (rounded pill on the canvas)
2. Select the node type from the menu
3. The new node appears on the canvas with a "Click to Edit" prompt
4. Click the node to open its detail panel and add content
5. Click **"Save Changes"** to persist your work

### Editing a Node

1. Click any node on the canvas
2. The **Node Details Panel** slides in from the right
3. Edit the node's properties:
   - Title/Name
   - Specific content (book selection, character bio, etc.)
   - Role assignment (for Story Book and Character nodes)
4. Changes are tracked automatically
5. Click **"Save Changes"** to save your edits

### Deleting a Node

1. Click the node you want to delete
2. Scroll to the bottom of the detail panel
3. Click the **"Delete Node"** button
4. The node and its connections are removed
5. Click **"Save Changes"** to persist the deletion

### Saving Your Canvas

- The **"Save Changes"** button appears at the top-center of the canvas
- It shows three states:
  - **Gray "Save Changes"**: You have unsaved changes
  - **"Saving..."**: Save in progress
  - **Green "All changes saved"**: Everything is persisted
- Always save before navigating away!
- You'll receive a warning if you try to leave with unsaved changes

---

## Node Connections

### Automatic Connections

- Every new node automatically connects to the **Context Node**
- Connections are visual curved lines in gray

### Connection Behavior

- Nodes only have bottom connection points (source)
- Context node only has a top connection point (target)
- Connections cannot be animated (by design)
- Future: Manual node-to-node connections may be added

---

## Visual Design

### Node Cards

- **Size**: 90x120 pixels (compact and organized)
- **Shape**: Rounded corners with subtle shadows
- **Content**: Icon + "Click to Edit" text (when empty)
- **Selected State**: Yellow ring highlights active node

### Node Labels

- Displayed above the card
- Uppercase, small font, gray color
- Text wraps and aligns to bottom-left
- Role badges (yellow pills) shown for Story Book and Character nodes

### Node Icons

- Each node type has a unique icon
- Icons use consistent sizing and styling
- Color-coded for visual differentiation

---

## Data Persistence

### Storage

- All node data is stored in the PostgreSQL database
- Each canvas has a unique story ID
- Nodes and edges are stored in separate tables
- Manual save required to persist changes

### Character Library

- Characters can be stored as reusable entities
- Separate from node instances
- Can be loaded into multiple canvases
- Visibility settings control access

### Node Instances

- Each node on a canvas is a unique instance
- Nodes store their configuration in JSONB format
- Changing a character in one canvas doesn't affect others
- Story Book selections are per-instance

---

## Best Practices

### Organization

- Use node types strategically for different content
- Keep node labels clear and descriptive
- Assign roles to prioritize importance
- Save frequently to prevent data loss

### Characters

- Create reusable characters in your library
- Use visibility settings for collaboration
- Assign appropriate roles for story hierarchy
- Add detailed bios for consistency

### Story Books

- Choose books that align with your story goals
- Use role assignments to clarify influence
- Combine multiple books for diverse inspiration
- Reference classics for proven structures

### Workflow

1. Start with a new canvas
2. Add relevant node types
3. Fill in content for each node
4. Connect ideas visually
5. Save your work
6. Return anytime to continue building

---

## Future Features

### Planned Enhancements

- **Context Node Input**: AI-powered story generation from prompts
- **Character Profiler**: AI chatbot to develop character personalities
- **Location Maps**: OpenStreetMap integration for visual location setting
- **Link Scraping**: Automatic content extraction from URLs
- **Collaborative Canvas**: Share and co-edit with other users
- **Node-to-Node Connections**: Link nodes beyond the context hub
- **Export Options**: Generate story outlines and reports
- **Version History**: Track canvas changes over time

---

## Troubleshooting

### Nodes Not Saving

- Ensure you click **"Save Changes"** before navigating away
- Check for the green "All changes saved" confirmation
- If save fails, you'll see an alert—try again
- Avoid running multiple Publo instances simultaneously

### Deleted Nodes Reappearing

- Always save after deleting nodes
- Wait for "All changes saved" confirmation
- Hard refresh browser if issues persist (Cmd+Shift+R / Ctrl+Shift+F5)

### Character Library Not Loading

- Check your database connection
- Ensure characters have proper visibility settings
- Try refreshing the page
- Check browser console for errors

### Performance Issues

- Close other Publo tabs (localhost or deployed)
- Reduce number of nodes on a single canvas
- Save regularly to prevent data loss
- Check your network connection

---

## Technical Details

### Database Schema

- **stories**: Canvas metadata (title, user_id, timestamps)
- **nodes**: Node instances (type, data, position)
- **edges**: Connections between nodes
- **characters**: Reusable character library
- **story_books**: Public domain book catalog

### API Integration

- **Open Library Search API**: Powers Story Book node search
- Future: OpenStreetMap API for Location nodes
- Future: Web scraping service for Link nodes

### Data Format

- Node data stored as JSONB (flexible schema)
- Character photos stored as base64 (in database)
- Book covers linked via URL (when available)

---

## Support

For issues, questions, or feature requests, please refer to the main project documentation or contact the development team.

---

**Last Updated**: November 2025  
**Version**: 1.0

