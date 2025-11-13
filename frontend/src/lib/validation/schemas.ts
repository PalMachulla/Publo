import { z } from 'zod'

// Base node data schema
export const BaseNodeDataSchema = z.object({
  label: z.string(),
  description: z.string().optional(),
  comments: z.array(z.unknown()).optional(),
})

// Database node schema (from Supabase)
export const DatabaseNodeSchema = z.object({
  id: z.string(),
  story_id: z.string(),
  type: z.string(),
  position_x: z.number(),
  position_y: z.number(),
  data: z.record(z.unknown()),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

// Database edge schema (from Supabase)
export const DatabaseEdgeSchema = z.object({
  id: z.string(),
  story_id: z.string(),
  source: z.string(),
  target: z.string(),
  type: z.string().optional(),
  animated: z.boolean().optional(),
  style: z.record(z.unknown()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

// Story schema (from Supabase)
export const StorySchema = z.object({
  id: z.string(),
  user_id: z.string(),
  title: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  is_public: z.boolean().optional(),
  shared: z.boolean().optional(),
  shared_emails: z.array(z.string()).optional(),
})

// User profile schema
export const UserProfileSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  role: z.enum(['prospect', 'admin', 'user']).optional(),
  access_tier: z.enum(['free', 'tier1', 'tier2', 'tier3']).optional(),
  access_status: z.enum(['waitlist', 'granted', 'revoked']).optional(),
  waitlist_joined_at: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})

// Character schema
export const CharacterSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  bio: z.string().optional(),
  photo_url: z.string().url().optional().nullable(),
  visibility: z.enum(['private', 'shared', 'public']).optional(),
  role: z.enum(['protagonist', 'antagonist', 'supporting', 'minor']).optional(),
  created_at: z.string(),
  updated_at: z.string(),
})

// Research result schema
export const ResearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(), // Will be sanitized separately
  snippet: z.string().optional(),
  scrapedContent: z.string().optional(),
})

// API response schemas for validation
export const GetStoriesResponseSchema = z.array(StorySchema)

export const GetStoryResponseSchema = z.object({
  story: StorySchema,
  nodes: z.array(DatabaseNodeSchema),
  edges: z.array(DatabaseEdgeSchema),
})

export const GetCharactersResponseSchema = z.array(CharacterSchema)

export const GetUserProfileResponseSchema = UserProfileSchema.nullable()

// Helper type exports
export type ValidatedStory = z.infer<typeof StorySchema>
export type ValidatedNode = z.infer<typeof DatabaseNodeSchema>
export type ValidatedEdge = z.infer<typeof DatabaseEdgeSchema>
export type ValidatedUserProfile = z.infer<typeof UserProfileSchema>
export type ValidatedCharacter = z.infer<typeof CharacterSchema>
export type ValidatedResearchResult = z.infer<typeof ResearchResultSchema>

