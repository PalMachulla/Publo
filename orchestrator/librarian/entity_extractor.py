"""
Entity Extractor

LLM-based extraction of characters, places, and events from story content.
"""

import json
from typing import Dict, Any, List


class EntityExtractor:
    """
    Extracts story entities from content using LLM.
    
    Usage:
        extractor = EntityExtractor(llm)
        entities = await extractor.extract(content)
    """
    
    def __init__(self, llm):
        """
        Initialize extractor.
        
        Args:
            llm: LangChain LLM instance
        """
        self.llm = llm
    
    async def extract(self, content: str) -> Dict[str, Any]:
        """
        Extract entities from story content.
        
        Args:
            content: Story content text
        
        Returns:
            Dictionary with extracted entities:
            - characters: [{name, description, role, traits}]
            - places: [{name, type, description, atmosphere}]
            - events: [{name, description, type}]
            - key_moments: [str]
            - mood: str
            - timeframe: str
        """
        # Truncate if too long
        max_chars = 8000
        if len(content) > max_chars:
            half = max_chars // 2
            content = content[:half] + "\n\n[...content truncated...]\n\n" + content[-half:]
        
        prompt = f"""Analyze this story content and extract entities.

CONTENT:
{content}

Return a JSON object with:
{{
  "characters": [
    {{
      "name": "Full name",
      "description": "Brief physical/role description",
      "role": "protagonist|antagonist|supporting|minor",
      "traits": ["trait1", "trait2"]
    }}
  ],
  "places": [
    {{
      "name": "Place name",
      "type": "interior|exterior|city|country|realm|vehicle|other",
      "description": "Brief description",
      "atmosphere": "Mood/feeling of this place"
    }}
  ],
  "events": [
    {{
      "name": "Brief event name",
      "description": "What happened",
      "type": "plot_point|revelation|conflict|resolution|death|transformation|meeting|other"
    }}
  ],
  "key_moments": ["Key moment 1", "Key moment 2", "Key moment 3"],
  "mood": "Overall mood/tone of this section",
  "timeframe": "When this happens in story time (e.g., 'Day 1, morning', 'Two weeks later')"
}}

Only include entities that are actually mentioned or described in the content.
Be concise but accurate.
Return ONLY valid JSON, no markdown formatting."""

        try:
            response = await self.llm.ainvoke(prompt)
            response_text = response.content if hasattr(response, 'content') else str(response)
            
            # Clean up response
            response_text = response_text.strip()
            if response_text.startswith("```"):
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            
            return json.loads(response_text.strip())
        except Exception as e:
            print(f"❌ [EntityExtractor] Extraction failed: {e}")
            return {
                "characters": [],
                "places": [],
                "events": [],
                "key_moments": [],
                "mood": None,
                "timeframe": None
            }

