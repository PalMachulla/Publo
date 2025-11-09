# Canvas Sharing System

This guide explains how the canvas sharing system works in Publo.

## Overview

The sharing system allows canvas owners to control who can access their canvases through three visibility levels:
- **Private**: Only the owner can access
- **Shared**: Access granted to specific users by email
- **Public**: Anyone with the link can view

## UI Components

### Sharing Dropdown Button

Located in the canvas header, right next to the Save button. This pill-shaped dropdown shows the current visibility status and allows you to:
1. Change visibility (Private/Shared/Public)
2. Add users by email (for Shared mode)
3. Remove shared users
4. View who has access

### Button States

The button displays different icons and colors based on visibility:
- 🔒 **Private** (gray) - Lock icon
- 🔗 **Shared** (blue) - Share icon  
- 🌐 **Public** (green) - Globe icon

## Database Schema

### `canvas_shares` Table

Stores actual share relationships between canvases and users.

```sql
- id: UUID (Primary Key)
- canvas_id: UUID (Foreign Key → stories.id)
- shared_with_email: TEXT (Email of user with access)
- shared_with_user_id: UUID (Foreign Key → auth.users.id, NULL if not registered)
- shared_by_user_id: UUID (Foreign Key → auth.users.id, canvas owner)
- permission: TEXT ('view' or 'edit')
- invited_at: TIMESTAMPTZ
- accepted_at: TIMESTAMPTZ (NULL until accepted)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

### `canvas_invites` Table

Stores pending invitations for users not yet registered.

```sql
- id: UUID (Primary Key)
- canvas_id: UUID (Foreign Key → stories.id)
- email: TEXT (Invitee email)
- invited_by_user_id: UUID (Foreign Key → auth.users.id)
- invite_token: TEXT (Unique secure token)
- expires_at: TIMESTAMPTZ (Default: 7 days from creation)
- accepted: BOOLEAN (Default: false)
- created_at: TIMESTAMPTZ
```

## How It Works

### Sharing with Registered Users

1. User enters an email in the sharing dropdown
2. System checks if email exists in `user_profiles`
3. If yes:
   - Creates entry in `canvas_shares` with `shared_with_user_id`
   - Sets `accepted_at` to current time
   - User gets immediate access

### Sharing with Non-Registered Users

1. User enters an email not in the system
2. System creates entry in `canvas_invites` with unique token
3. **TODO**: Send invitation email with link
4. When recipient registers and clicks invite link:
   - System creates entry in `canvas_shares`
   - Marks invite as `accepted = true`

### Changing Visibility

#### To Private
- Removes all entries from `canvas_shares` for this canvas
- Sets `story.is_public = false` and `story.shared = false`

#### To Shared
- Sets `story.shared = true` and `story.is_public = false`
- Allows adding specific users

#### To Public
- Sets `story.is_public = true` and `story.shared = true`
- Anyone with link can view (no database entries needed)

## API Functions

### `shareCanvas(canvasId, email, permission)`

Shares a canvas with a user by email.

**Parameters:**
- `canvasId`: UUID of the canvas
- `email`: Email address to share with
- `permission`: 'view' or 'edit' (default: 'view')

**Returns:**
```typescript
{
  success: boolean
  userExists: boolean
  message: string
}
```

**Example:**
```typescript
const result = await shareCanvas('123-456', 'user@example.com', 'view')
if (result.success) {
  console.log(result.message) // "Canvas shared with user@example.com"
}
```

### `getCanvasShares(canvasId)`

Gets all users a canvas has been shared with.

**Returns:** `CanvasShare[]`

**Example:**
```typescript
const shares = await getCanvasShares('123-456')
shares.forEach(share => {
  console.log(share.shared_with_email, share.permission)
})
```

### `removeCanvasShare(canvasId, email)`

Removes a user's access to a canvas.

**Returns:** `boolean` (success status)

**Example:**
```typescript
const success = await removeCanvasShare('123-456', 'user@example.com')
```

### `checkCanvasAccess(canvasId)`

Checks if current user has access to view a canvas.

**Returns:** `boolean`

**Example:**
```typescript
const hasAccess = await checkCanvasAccess('123-456')
if (!hasAccess) {
  router.push('/stories')
}
```

### `acceptCanvasInvite(inviteToken)`

Accept a pending canvas invitation.

**Returns:** `boolean` (success status)

**Example:**
```typescript
// From invite link: /accept-invite?token=abc123...
const success = await acceptCanvasInvite(token)
if (success) {
  router.push(`/canvas?id=${canvasId}`)
}
```

## Row Level Security (RLS)

All tables have RLS enabled with the following policies:

### `canvas_shares`
- Users can view shares where they are the owner OR recipient
- Users can create shares for canvases they own
- Users can delete shares for canvases they own

### `canvas_invites`
- Users can view invites they created
- Users can create invites for canvases they own
- Users can update/delete their own invites

## Database Functions

### `user_has_canvas_access(canvas_id, user_id)`

Security definer function that checks if a user has access to a canvas.

**Returns:** `boolean`

**Checks:**
1. User owns the canvas
2. Canvas is public
3. User has been granted access via `canvas_shares`

### `get_canvas_shared_users(canvas_id)`

Security definer function that returns all users a canvas is shared with.

**Returns:** Table with columns:
- `email`: TEXT
- `user_id`: UUID
- `permission`: TEXT
- `accepted_at`: TIMESTAMPTZ

## TODO: Email Integration

To complete the sharing system, you need to:

1. **Create Email API Route** (`/api/send-invite`)
   - Use a service like SendGrid, Resend, or AWS SES
   - Send invitation emails with invite token link
   - Include canvas name and inviter info

2. **Create Invite Acceptance Page** (`/accept-invite`)
   - Check if user is logged in
   - If not, redirect to sign up with return URL
   - If yes, call `acceptCanvasInvite(token)`
   - Redirect to canvas

3. **Email Template**
   ```
   Subject: [Inviter Name] shared a Publo canvas with you
   
   Hi,
   
   [Inviter Name] has invited you to collaborate on their Publo canvas: "[Canvas Name]"
   
   [Accept Invitation Button] → https://publo.app/accept-invite?token=...
   
   This invitation expires in 7 days.
   ```

## Migration Instructions

To enable sharing on your Supabase instance, you need to run TWO migrations in order:

### Step 1: Add sharing columns to stories table

First, run migration `007_add_stories_sharing_columns.sql` in your Supabase SQL Editor:

```sql
-- Copy and paste the contents of:
-- supabase/migrations/007_add_stories_sharing_columns.sql
```

This adds the `is_public` and `shared` columns to your `stories` table.

### Step 2: Create sharing tables and functions

Then, run migration `006_add_canvas_sharing.sql`:

```sql
-- Copy and paste the contents of:
-- supabase/migrations/006_add_canvas_sharing.sql
```

This creates the `canvas_shares` and `canvas_invites` tables with RLS policies.

2. Verify tables were created:
   ```sql
   SELECT * FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('canvas_shares', 'canvas_invites');
   ```

3. Test RLS policies:
   ```sql
   -- As a canvas owner
   SELECT * FROM canvas_shares WHERE canvas_id = 'your-canvas-id';
   
   -- Check access function
   SELECT user_has_canvas_access('canvas-id', 'user-id');
   ```

## Security Considerations

1. **Invite Token Security**
   - Tokens are 64-character hex strings (256 bits of entropy)
   - Stored securely in database
   - Single-use and time-limited (7 days)

2. **Email Validation**
   - Basic regex validation on client
   - Case-insensitive matching (`email.toLowerCase()`)
   - Duplicate prevention via unique constraints

3. **RLS Enforcement**
   - All queries go through RLS policies
   - Security definer functions for complex checks
   - Owner can't accidentally lock themselves out

4. **Permission Levels**
   - Currently supports 'view' and 'edit'
   - Easy to extend for future granular permissions
   - Owner always has full control

## Testing Checklist

- [ ] Share canvas with registered user (immediate access)
- [ ] Share canvas with non-registered email (creates invite)
- [ ] Remove user from shared canvas
- [ ] Change visibility from Private → Shared → Public → Private
- [ ] Verify shared emails persist after page reload
- [ ] Test duplicate email prevention
- [ ] Test invalid email rejection
- [ ] Verify RLS policies (can't see other users' shares)
- [ ] Test invite acceptance flow (when implemented)
- [ ] Check invite expiration (7 days)

## Future Enhancements

1. **Permission Levels**
   - Add 'comment' permission (view + comment only)
   - Add 'admin' permission (can share with others)

2. **Notifications**
   - In-app notifications when canvas is shared
   - Email notifications for canvas updates

3. **Share Settings**
   - Allow owner to set expiration dates
   - Allow owner to revoke all access at once
   - Audit log of who accessed when

4. **Public Links**
   - Generate shareable links with tokens
   - Option to make public link read-only vs editable
   - Link analytics (views, unique visitors)

5. **Teams/Organizations**
   - Share with entire team/org
   - Role-based access control
   - Team workspaces

