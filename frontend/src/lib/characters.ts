import { createClient } from '@/lib/supabase/client'
import { Character, CharacterVisibility, CharacterRole } from '@/types/nodes'

const supabase = createClient()

// Get all characters accessible to current user (own + shared + public)
export async function getAccessibleCharacters(): Promise<Character[]> {
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .order('updated_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching characters:', error)
    throw error
  }
  
  return data || []
}

// Search characters by name
export async function searchCharacters(query: string): Promise<Character[]> {
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .ilike('name', `%${query}%`)
    .order('name', { ascending: true })
  
  if (error) {
    console.error('Error searching characters:', error)
    throw error
  }
  
  return data || []
}

// Get a single character by ID
export async function getCharacter(id: string): Promise<Character | null> {
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) {
    console.error('Error fetching character:', error)
    return null
  }
  
  return data
}

// Create a new character
export async function createCharacter(character: {
  name: string
  bio?: string
  photo_url?: string
  visibility?: CharacterVisibility
  role?: CharacterRole
}): Promise<Character> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error} = await supabase
    .from('characters')
    .insert({
      user_id: user.id,
      name: character.name,
      bio: character.bio || '',
      photo_url: character.photo_url,
      visibility: character.visibility || 'private',
      role: character.role,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating character:', error)
    throw error
  }

  return data
}

// Update an existing character
export async function updateCharacter(
  id: string,
  updates: Partial<Omit<Character, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<Character> {
  const { data, error } = await supabase
    .from('characters')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating character:', error)
    throw error
  }

  return data
}

// Delete a character
export async function deleteCharacter(id: string): Promise<void> {
  const { error } = await supabase
    .from('characters')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting character:', error)
    throw error
  }
}

