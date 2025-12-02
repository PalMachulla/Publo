-- Migration: Import model configurations from CSV data
-- This migration sets up 23 active models and deactivates 61 legacy/deprecated models
-- Generated from model_configurations.csv and models_to_deactivate.csv

-- Step 1: Insert/Update active models from model_configurations.csv
-- Value mappings: tier (low/mid->standard, high->premium, frontier->frontier, nano->fast)
--                 speed (very-fast->instant, fast->fast, medium->medium, slow->slow, very-slow->slow)
--                 cost (very-low/low->cheap, medium->moderate, high/very-high->expensive)

INSERT INTO public.model_metadata (
  model_id,
  provider,
  is_active,
  supports_structured_output,
  supports_reasoning,
  supports_function_calling,
  supports_streaming,
  supports_vision,
  tier,
  speed,
  cost,
  context_window,
  max_output_tokens,
  best_for,
  admin_verified,
  notes
) VALUES
-- OpenAI Models (19 models)
('gpt-5', 'openai', true, 'full', true, true, true, true, 'frontier', 'fast', 'expensive', 200000, 128000, '["flagship", "multimodal", "agentic", "general-purpose"]', true, 'Flagship model - maximum capability'),
('gpt-5.1', 'openai', true, 'full', true, true, true, true, 'frontier', 'fast', 'expensive', 200000, 150000, '["adaptive-reasoning", "general-intelligence", "coding"]', true, 'Recommended primary model - best overall'),
('gpt-5-mini', 'openai', true, 'full', true, true, true, true, 'premium', 'fast', 'expensive', 128000, 64000, '["balanced-cost-performance", "multimodal"]', true, 'Balanced cost-performance'),
('gpt-5-nano', 'openai', true, 'full', false, true, true, true, 'fast', 'instant', 'cheap', 128000, 32000, '["ultra-cost-effective", "high-volume"]', true, 'Ultra cost-effective'),
('gpt-5-pro', 'openai', true, 'full', true, true, true, true, 'frontier', 'slow', 'expensive', 200000, 128000, '["maximum-capability", "research"]', true, 'Maximum capability for research'),
('gpt-4.1', 'openai', true, 'full', false, true, true, true, 'premium', 'fast', 'expensive', 128000, 32768, '["coding", "long-context", "instruction-following"]', true, 'Best for coding - 21-point SWE-bench improvement'),
('gpt-4.1-mini', 'openai', true, 'full', false, true, true, true, 'standard', 'fast', 'moderate', 128000, 16384, '["cost-efficient-coding", "balanced"]', true, 'Cost-efficient coding'),
('gpt-4.1-nano', 'openai', true, 'full', false, true, true, true, 'fast', 'instant', 'cheap', 128000, 8192, '["ultra-lightweight", "high-throughput"]', true, 'Ultra lightweight'),
('gpt-4', 'openai', true, 'full', false, true, true, false, 'premium', 'medium', 'expensive', 8192, 4096, '["legacy-production", "established-workflows"]', true, 'Legacy production model'),
('gpt-4-turbo', 'openai', true, 'full', false, true, true, true, 'premium', 'fast', 'expensive', 128000, 4096, '["legacy-multimodal", "proven"]', true, 'Legacy multimodal'),
('gpt-4o', 'openai', true, 'full', false, true, true, true, 'premium', 'fast', 'moderate', 128000, 16384, '["multimodal", "general-purpose", "proven"]', true, 'Proven general-purpose multimodal'),
('gpt-4o-mini', 'openai', true, 'full', false, true, true, true, 'standard', 'instant', 'cheap', 128000, 16384, '["best-value", "high-volume", "multimodal"]', true, 'Best value - recommended for high volume'),
('gpt-3.5-turbo', 'openai', true, 'none', false, true, true, false, 'standard', 'instant', 'cheap', 16385, 4096, '["legacy-support", "simple-tasks"]', true, 'Legacy support - simple tasks'),
('gpt-3.5-turbo-instruct', 'openai', true, 'none', false, false, true, false, 'standard', 'instant', 'cheap', 4096, 4096, '["instruction-tuned-legacy", "completion"]', true, 'Instruction-tuned legacy'),
('o3', 'openai', true, 'full', true, true, true, true, 'frontier', 'slow', 'expensive', 200000, 100000, '["expert-reasoning", "STEM", "complex-problems"]', true, 'Expert reasoning - complex problems'),
('o3-mini', 'openai', true, 'full', true, true, true, true, 'standard', 'fast', 'moderate', 128000, 65000, '["fast-reasoning", "coding", "math"]', true, 'Fast reasoning'),
('o4-mini', 'openai', true, 'full', true, true, true, true, 'premium', 'fast', 'expensive', 200000, 100000, '["efficient-reasoning", "vision-tasks", "balanced"]', true, 'Efficient reasoning with vision'),
('o1', 'openai', true, 'full', true, true, true, true, 'frontier', 'slow', 'expensive', 200000, 100000, '["deep-reasoning", "research"]', true, 'Deep reasoning (legacy)'),
('o1-pro', 'openai', true, 'full', true, true, true, true, 'frontier', 'slow', 'expensive', 200000, 100000, '["maximum-reasoning", "reliability"]', true, 'Maximum reasoning reliability'),
-- Groq Models (4 models)
('llama-3.3-70b-versatile', 'groq', true, 'json-mode', false, true, true, false, 'premium', 'instant', 'cheap', 128000, 4096, '["multilingual", "instruction-following", "instant"]', true, 'Multilingual - instant responses'),
('llama-3.1-8b-instant', 'groq', true, 'json-mode', false, true, true, false, 'standard', 'instant', 'cheap', 128000, 4096, '["real-time-chat", "high-throughput", "lowest-cost"]', true, 'Fastest & cheapest - recommended for speed'),
('openai/gpt-oss-120b', 'groq', true, 'none', false, true, true, false, 'premium', 'medium', 'cheap', 128000, 4096, '["open-source", "self-hosted", "customizable"]', true, 'Open-source GPT alternative'),
('openai/gpt-oss-20b', 'groq', true, 'none', false, true, true, false, 'standard', 'fast', 'cheap', 128000, 4096, '["lightweight-open-source", "cost-effective"]', true, 'Lightweight open-source')
ON CONFLICT (model_id, provider) 
DO UPDATE SET
  is_active = EXCLUDED.is_active,
  supports_structured_output = EXCLUDED.supports_structured_output,
  supports_reasoning = EXCLUDED.supports_reasoning,
  supports_function_calling = EXCLUDED.supports_function_calling,
  supports_streaming = EXCLUDED.supports_streaming,
  supports_vision = EXCLUDED.supports_vision,
  tier = EXCLUDED.tier,
  speed = EXCLUDED.speed,
  cost = EXCLUDED.cost,
  context_window = EXCLUDED.context_window,
  max_output_tokens = EXCLUDED.max_output_tokens,
  best_for = EXCLUDED.best_for,
  admin_verified = EXCLUDED.admin_verified,
  notes = EXCLUDED.notes,
  updated_at = NOW();

-- Step 2: Deactivate models from models_to_deactivate.csv
INSERT INTO public.model_metadata (
  model_id,
  provider,
  is_active,
  notes,
  admin_verified
) VALUES
-- Deprecated Models (3)
('o1-preview', 'openai', false, 'Deprecated July 2025 - Use o3 instead', true),
('o1-mini', 'openai', false, 'Deprecated October 2025 - Use o4-mini instead', true),
('gpt-4.5-preview', 'openai', false, 'Deprecated July 2025 - Use gpt-4.1 instead', true),
-- Dated Versions (26)
('gpt-3.5-turbo-0125', 'openai', false, 'Dated version - Use gpt-3.5-turbo', true),
('gpt-3.5-turbo-1106', 'openai', false, 'Dated version - Use gpt-3.5-turbo', true),
('gpt-3.5-turbo-16k', 'openai', false, 'Dated version - Use gpt-3.5-turbo', true),
('gpt-3.5-turbo-instruct-0914', 'openai', false, 'Dated version - Use gpt-3.5-turbo-instruct', true),
('gpt-4-0613', 'openai', false, 'Dated version - Use gpt-4', true),
('gpt-4-0125-preview', 'openai', false, 'Dated version - Use gpt-4.1', true),
('gpt-4-1106-preview', 'openai', false, 'Dated version - Use gpt-4.1', true),
('gpt-4-turbo-2024-04-09', 'openai', false, 'Dated version - Use gpt-4-turbo', true),
('gpt-4-turbo-preview', 'openai', false, 'Dated version - Use gpt-4-turbo', true),
('gpt-4.1-2025-04-14', 'openai', false, 'Dated version - Use gpt-4.1', true),
('gpt-4.1-mini-2025-04-14', 'openai', false, 'Dated version - Use gpt-4.1-mini', true),
('gpt-4.1-nano-2025-04-14', 'openai', false, 'Dated version - Use gpt-4.1-nano', true),
('gpt-4o-2024-05-13', 'openai', false, 'Dated version - Use gpt-4o', true),
('gpt-4o-2024-08-06', 'openai', false, 'Dated version - Use gpt-4o', true),
('gpt-4o-2024-11-20', 'openai', false, 'Dated version - Use gpt-4o', true),
('gpt-4o-mini-2024-07-18', 'openai', false, 'Dated version - Use gpt-4o-mini', true),
('gpt-5-2025-08-07', 'openai', false, 'Dated version - Use gpt-5', true),
('gpt-5-mini-2025-08-07', 'openai', false, 'Dated version - Use gpt-5-mini', true),
('gpt-5-nano-2025-08-07', 'openai', false, 'Dated version - Use gpt-5-nano', true),
('gpt-5-pro-2025-10-06', 'openai', false, 'Dated version - Use gpt-5-pro', true),
('gpt-5.1-2025-11-13', 'openai', false, 'Dated version - Use gpt-5.1', true),
('o1-2024-12-17', 'openai', false, 'Dated version - Use o1', true),
('o1-pro-2025-03-19', 'openai', false, 'Dated version - Use o1-pro', true),
('o3-2025-04-16', 'openai', false, 'Dated version - Use o3', true),
('o3-mini-2025-01-31', 'openai', false, 'Dated version - Prefer o4-mini', true),
('o4-mini-2025-04-16', 'openai', false, 'Dated version - Use o4-mini', true),
-- Ambiguous/Redundant (3)
('chatgpt-4o-latest', 'openai', false, 'Ambiguous version - Use gpt-4o', true),
('gpt-5-chat-latest', 'openai', false, 'Redundant alias - Use gpt-5', true),
('gpt-5.1-chat-latest', 'openai', false, 'Redundant alias - Use gpt-5.1', true),
-- Preview/Specialized Models (18)
('gpt-4o-mini-realtime-preview', 'openai', false, 'Preview specialized - Wait for GA', true),
('gpt-4o-mini-realtime-preview-2024-12-17', 'openai', false, 'Preview specialized - Wait for GA', true),
('gpt-4o-realtime-preview', 'openai', false, 'Preview specialized - Wait for GA', true),
('gpt-4o-realtime-preview-2024-10-01', 'openai', false, 'Preview specialized - Wait for GA', true),
('gpt-4o-realtime-preview-2024-12-17', 'openai', false, 'Preview specialized - Wait for GA', true),
('gpt-4o-realtime-preview-2025-06-03', 'openai', false, 'Preview specialized - Wait for GA', true),
('gpt-4o-mini-search-preview', 'openai', false, 'Preview specialized - Wait for GA', true),
('gpt-4o-mini-search-preview-2025-03-11', 'openai', false, 'Preview specialized - Wait for GA', true),
('gpt-4o-search-preview', 'openai', false, 'Preview specialized - Wait for GA', true),
('gpt-4o-search-preview-2025-03-11', 'openai', false, 'Preview specialized - Wait for GA', true),
-- Specialized Audio/Image Models (7)
('gpt-4o-mini-transcribe', 'openai', false, 'Specialized audio - Use when needed', true),
('gpt-4o-transcribe', 'openai', false, 'Specialized audio - Use when needed', true),
('gpt-4o-transcribe-diarize', 'openai', false, 'Specialized audio - Use when needed', true),
('gpt-realtime', 'openai', false, 'Specialized audio - Use when needed', true),
('gpt-realtime-2025-08-28', 'openai', false, 'Specialized audio - Use when needed', true),
('gpt-realtime-mini', 'openai', false, 'Specialized audio - Use when needed', true),
('gpt-realtime-mini-2025-10-06', 'openai', false, 'Specialized audio - Use when needed', true),
('gpt-image-1', 'openai', false, 'Specialized image generation - Use when needed', true),
('gpt-image-1-mini', 'openai', false, 'Specialized image generation - Use when needed', true),
-- Specialized Coding/Search Models (5)
('gpt-5-codex', 'openai', false, 'Specialized coding - Use gpt-5.1', true),
('gpt-5-search-api', 'openai', false, 'Specialized search - Use gpt-5', true),
('gpt-5-search-api-2025-10-14', 'openai', false, 'Specialized search - Use gpt-5', true),
('gpt-5.1-codex', 'openai', false, 'Specialized coding - Use gpt-5.1', true),
('gpt-5.1-codex-mini', 'openai', false, 'Specialized coding - Use gpt-5-mini', true),
('o4-mini-deep-research', 'openai', false, 'Specialized research - Use o4-mini', true),
('o4-mini-deep-research-2025-06-26', 'openai', false, 'Specialized research - Use o4-mini', true),
-- Groq Preview Models (4)
('meta-llama/llama-4-maverick-17b-128e-instruct', 'groq', false, 'Preview testing - Use llama-3.3-70b-versatile', true),
('meta-llama/llama-4-scout-17b-16e-instruct', 'groq', false, 'Preview testing - Use llama-3.1-8b-instant', true),
('moonshotai/kimi-k2-instruct-0905', 'groq', false, 'Preview third-party - Use llama-3.3-70b-versatile', true),
('qwen/qwen3-32b', 'groq', false, 'Preview third-party - Use llama-3.3-70b-versatile', true)
ON CONFLICT (model_id, provider)
DO UPDATE SET
  is_active = false,
  notes = EXCLUDED.notes,
  admin_verified = true,
  updated_at = NOW();

-- Step 3: Update any existing models that should be inactive
-- This catches models that might already exist in the database
UPDATE public.model_metadata
SET 
  is_active = false,
  admin_verified = true,
  updated_at = NOW()
WHERE (model_id, provider) IN (
  VALUES
    ('o1-preview', 'openai'),
    ('o1-mini', 'openai'),
    ('gpt-4.5-preview', 'openai'),
    ('gpt-3.5-turbo-0125', 'openai'),
    ('gpt-3.5-turbo-1106', 'openai'),
    ('gpt-3.5-turbo-16k', 'openai'),
    ('gpt-3.5-turbo-instruct-0914', 'openai'),
    ('gpt-4-0613', 'openai'),
    ('gpt-4-0125-preview', 'openai'),
    ('gpt-4-1106-preview', 'openai'),
    ('gpt-4-turbo-2024-04-09', 'openai'),
    ('gpt-4-turbo-preview', 'openai'),
    ('gpt-4.1-2025-04-14', 'openai'),
    ('gpt-4.1-mini-2025-04-14', 'openai'),
    ('gpt-4.1-nano-2025-04-14', 'openai'),
    ('gpt-4o-2024-05-13', 'openai'),
    ('gpt-4o-2024-08-06', 'openai'),
    ('gpt-4o-2024-11-20', 'openai'),
    ('gpt-4o-mini-2024-07-18', 'openai'),
    ('gpt-5-2025-08-07', 'openai'),
    ('gpt-5-mini-2025-08-07', 'openai'),
    ('gpt-5-nano-2025-08-07', 'openai'),
    ('gpt-5-pro-2025-10-06', 'openai'),
    ('gpt-5.1-2025-11-13', 'openai'),
    ('o1-2024-12-17', 'openai'),
    ('o1-pro-2025-03-19', 'openai'),
    ('o3-2025-04-16', 'openai'),
    ('o3-mini-2025-01-31', 'openai'),
    ('o4-mini-2025-04-16', 'openai'),
    ('chatgpt-4o-latest', 'openai'),
    ('gpt-4o-mini-realtime-preview', 'openai'),
    ('gpt-4o-mini-realtime-preview-2024-12-17', 'openai'),
    ('gpt-4o-realtime-preview', 'openai'),
    ('gpt-4o-realtime-preview-2024-10-01', 'openai'),
    ('gpt-4o-realtime-preview-2024-12-17', 'openai'),
    ('gpt-4o-realtime-preview-2025-06-03', 'openai'),
    ('gpt-4o-mini-search-preview', 'openai'),
    ('gpt-4o-mini-search-preview-2025-03-11', 'openai'),
    ('gpt-4o-search-preview', 'openai'),
    ('gpt-4o-search-preview-2025-03-11', 'openai'),
    ('gpt-4o-mini-transcribe', 'openai'),
    ('gpt-4o-transcribe', 'openai'),
    ('gpt-4o-transcribe-diarize', 'openai'),
    ('gpt-realtime', 'openai'),
    ('gpt-realtime-2025-08-28', 'openai'),
    ('gpt-realtime-mini', 'openai'),
    ('gpt-realtime-mini-2025-10-06', 'openai'),
    ('gpt-5-chat-latest', 'openai'),
    ('gpt-5-codex', 'openai'),
    ('gpt-5-search-api', 'openai'),
    ('gpt-5-search-api-2025-10-14', 'openai'),
    ('gpt-5.1-chat-latest', 'openai'),
    ('gpt-5.1-codex', 'openai'),
    ('gpt-5.1-codex-mini', 'openai'),
    ('gpt-image-1', 'openai'),
    ('gpt-image-1-mini', 'openai'),
    ('o4-mini-deep-research', 'openai'),
    ('o4-mini-deep-research-2025-06-26', 'openai'),
    ('meta-llama/llama-4-maverick-17b-128e-instruct', 'groq'),
    ('meta-llama/llama-4-scout-17b-16e-instruct', 'groq'),
    ('moonshotai/kimi-k2-instruct-0905', 'groq'),
    ('qwen/qwen3-32b', 'groq')
);

-- Summary
-- ✅ Active models: 23 (19 OpenAI + 4 Groq)
-- ✅ Inactive models: 61 (deprecated, dated versions, previews, specialized)
-- ✅ Total models configured: 84
