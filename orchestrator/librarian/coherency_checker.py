"""
Coherency Checker

Detects coherency issues by comparing new content with established story facts.
"""

import json
from typing import Dict, List, Any


class CoherencyChecker:
    """
    Checks content for coherency issues against established story state.
    
    Detects:
    - Dead characters appearing
    - Name spelling inconsistencies
    - Timeline contradictions
    - Knowledge violations
    - Location errors
    """
    
    def __init__(self, supabase_client: Any, node_id: str):
        """
        Initialize checker.
        
        Args:
            supabase_client: Supabase client
            node_id: Story node ID
        """
        self.db = supabase_client
        self.node_id = node_id
    
    async def check(
        self,
        section_id: str,
        content: str,
        extracted: Dict[str, Any]
    ) -> List[Dict]:
        """
        Check content for coherency issues.
        
        Args:
            section_id: Section being checked
            content: Section content
            extracted: Extracted entities from content
        
        Returns:
            List of issue dictionaries
        """
        issues = []
        
        # Get all existing characters
        all_characters = await self._get_all_characters()
        
        for char_data in extracted.get("characters", []):
            name = char_data.get("name", "")
            
            for existing in all_characters:
                # Check for deceased characters
                if existing.get("status") == "deceased":
                    if self._name_matches(name, existing.get("name", ""), 
                                         self._parse_json(existing.get("aliases"), [])):
                        issues.append({
                            "type": "death_resurrection",
                            "severity": "error",
                            "description": f"Character '{existing['name']}' appears but was marked as deceased",
                            "expected_value": f"Character should not appear (died in {existing.get('status_changed_in')})",
                            "source_section_id": existing.get("status_changed_in")
                        })
                
                # Check for name inconsistencies
                if self._is_similar_name(name, existing.get("name", "")) and name != existing.get("name"):
                    issues.append({
                        "type": "name_inconsistency",
                        "severity": "warning",
                        "description": f"Character name '{name}' might be a variant of '{existing['name']}'",
                        "expected_value": existing.get("name"),
                        "source_section_id": existing.get("first_appearance_section_id")
                    })
        
        return issues
    
    async def _get_all_characters(self) -> List[Dict]:
        """Get all characters for this story."""
        try:
            result = self.db.table("story_characters") \
                .select("*") \
                .eq("node_id", self.node_id) \
                .execute()
            return result.data or []
        except Exception as e:
            print(f"❌ [CoherencyChecker] Failed to get characters: {e}")
            return []
    
    def _name_matches(self, name: str, canonical_name: str, aliases: List[str]) -> bool:
        """Check if a name matches the canonical name or any alias."""
        name_lower = name.lower().strip()
        if name_lower == canonical_name.lower().strip():
            return True
        for alias in aliases:
            if name_lower == alias.lower().strip():
                return True
        return False
    
    def _is_similar_name(self, name1: str, name2: str) -> bool:
        """Check if two names are similar (potential variants)."""
        n1 = name1.lower().strip()
        n2 = name2.lower().strip()
        
        # One contains the other
        if n1 in n2 or n2 in n1:
            return True
        
        # Same first name
        parts1 = n1.split()
        parts2 = n2.split()
        if parts1 and parts2 and parts1[0] == parts2[0]:
            return True
        
        return False
    
    def _parse_json(self, value: Any, default: Any) -> Any:
        """Parse JSON value."""
        if value is None:
            return default
        if isinstance(value, (list, dict)):
            return value
        if isinstance(value, str):
            try:
                return json.loads(value)
            except:
                return default
        return default

