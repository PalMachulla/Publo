-- Migration 020: Add new_characters_introduced to section_cards
-- 
-- This column tracks minor/new characters introduced in each section
-- that haven't been promoted to full Character nodes yet.
-- Examples: "The Landlord", "A Fan", "The Bartender"
-- 
-- Format: [{ "name": "The Landlord", "description": "Axel's grumpy landlord", "promoted": false }]

ALTER TABLE public.section_cards 
ADD COLUMN IF NOT EXISTS new_characters_introduced JSONB DEFAULT '[]';

-- Add comment explaining the column
COMMENT ON COLUMN public.section_cards.new_characters_introduced IS 
  'Minor characters introduced in this section (not yet full Character nodes). Format: [{"name": "...", "description": "...", "promoted": false, "promotedToId": null}]';
