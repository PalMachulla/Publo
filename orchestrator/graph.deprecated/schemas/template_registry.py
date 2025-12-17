"""
Template Registry

Central source of truth for document templates across all formats.
Python equivalent of frontend/src/lib/orchestrator/schemas/templateRegistry.ts
"""

from typing import Optional, List, Dict, Any

class Template:
    """Template definition"""
    def __init__(
        self,
        id: str,
        name: str,
        description: str,
        keywords: Optional[List[str]] = None,
        complexity: str = 'simple',  # simple | moderate | complex
        recommended_for: Optional[str] = None
    ):
        self.id = id
        self.name = name
        self.description = description
        self.keywords = keywords or []
        self.complexity = complexity
        self.recommended_for = recommended_for
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'keywords': self.keywords,
            'complexity': self.complexity,
            'recommendedFor': self.recommended_for
        }


# Template Registry - Single Source of Truth
TEMPLATE_REGISTRY: Dict[str, List[Template]] = {
    'novel': [
        Template('three-act', 'Three-Act Structure', 'Classic beginning, middle, and end',
                 ['three act', 'classic', 'traditional', 'beginning middle end'],
                 'simple', 'Traditional storytelling with clear setup, confrontation, and resolution'),
        Template('heros-journey', "Hero's Journey", 'Archetypal adventure narrative',
                 ['hero', 'journey', 'monomyth', 'campbell', 'adventure', 'quest'],
                 'moderate', 'Epic adventures, fantasy, or transformative character arcs'),
        Template('freytag', "Freytag's Pyramid", 'Rising action, climax, falling action',
                 ['freytag', 'pyramid', 'rising action', 'climax', 'falling action'],
                 'moderate', 'Dramatic stories with clear tension build-up and resolution'),
        Template('save-the-cat', 'Save The Cat', 'Modern screenplay structure adapted for novels',
                 ['save the cat', 'snyder', 'beat sheet', 'screenplay'],
                 'complex', 'Plot-driven novels with commercial appeal'),
        Template('blank', 'Blank Canvas', 'Start from scratch',
                 ['blank', 'custom', 'freeform', 'scratch'],
                 'simple', 'Complete creative freedom'),
    ],
    'short-story': [
        Template('classic', 'Classic Short Story', 'Single plot, few characters, brief timespan',
                 ['classic', 'traditional', 'single plot'],
                 'simple', 'Traditional short fiction with focused narrative'),
        Template('flash-fiction', 'Flash Fiction', 'Ultra-short 500-1000 words',
                 ['flash', 'micro', 'ultra short', 'brief'],
                 'simple', 'Extremely concise stories with punchy impact'),
        Template('twist-ending', 'Twist Ending', 'Surprise revelation structure',
                 ['twist', 'surprise', 'revelation', 'unexpected'],
                 'moderate', 'Stories with shocking or unexpected conclusions'),
        Template('blank', 'Blank Canvas', 'Start from scratch',
                 ['blank', 'custom', 'freeform', 'scratch'],
                 'simple', 'Complete creative freedom'),
    ],
    'screenplay': [
        Template('feature', 'Feature Film', '90-120 pages, three acts',
                 ['feature', 'film', 'movie', 'theatrical', '90 minutes', 'three act'],
                 'complex', 'Full-length theatrical films'),
        Template('tv-pilot', 'TV Pilot', '30 or 60-minute episode',
                 ['tv', 'television', 'pilot', 'series', 'episode'],
                 'complex', 'Television series premiere episodes'),
        Template('short-film', 'Short Film', '5-30 pages',
                 ['short', 'short film', 'brief', 'festival'],
                 'moderate', 'Festival submissions or proof-of-concept'),
        Template('blank', 'Blank Canvas', 'Start from scratch',
                 ['blank', 'custom', 'freeform', 'scratch'],
                 'simple', 'Complete creative freedom'),
    ],
    'podcast': [
        Template('interview', 'Interview Format', 'Host interviews guests',
                 ['interview', 'guest', 'host', 'q&a', 'conversation'],
                 'simple', 'Guest-focused conversational podcasts'),
        Template('co-hosted', 'Co-Hosted', 'Multiple hosts in conversation',
                 ['co-hosted', 'multiple hosts', 'panel', 'discussion'],
                 'moderate', 'Dynamic multi-host discussions'),
        Template('storytelling', 'Storytelling', 'Narrative-driven episodes',
                 ['storytelling', 'narrative', 'story', 'documentary'],
                 'complex', 'Narrative or documentary-style podcasts'),
        Template('blank', 'Blank Canvas', 'Start from scratch',
                 ['blank', 'custom', 'freeform', 'scratch'],
                 'simple', 'Complete creative freedom'),
    ],
    'report': [
        Template('business', 'Business Report', 'Executive summary, findings, recommendations',
                 ['business', 'executive', 'corporate', 'findings'],
                 'moderate', 'Corporate analysis and strategic recommendations'),
        Template('research', 'Research Report', 'Literature review, methodology, results',
                 ['research', 'academic', 'methodology', 'literature review'],
                 'complex', 'Academic or scientific research documentation'),
        Template('technical', 'Technical Report', 'Specifications, analysis, documentation',
                 ['technical', 'specs', 'documentation', 'analysis'],
                 'complex', 'Technical specifications and system documentation'),
        Template('blank', 'Blank Canvas', 'Start from scratch',
                 ['blank', 'custom', 'freeform', 'scratch'],
                 'simple', 'Complete creative freedom'),
    ],
    'article': [
        Template('how-to', 'How-To Guide', 'Step-by-step instructional',
                 ['how to', 'guide', 'tutorial', 'instructional', 'steps'],
                 'simple', 'Instructional content with clear steps'),
        Template('listicle', 'Listicle', 'Numbered or bulleted list format',
                 ['list', 'listicle', 'numbered', 'top 10', 'bullets'],
                 'simple', 'Scannable content with multiple points'),
        Template('opinion', 'Opinion Piece', 'Editorial or commentary',
                 ['opinion', 'editorial', 'commentary', 'perspective'],
                 'moderate', 'Persuasive or thought-provoking content'),
        Template('feature', 'Feature Article', 'In-depth exploration of topic',
                 ['feature', 'in-depth', 'long-form', 'deep dive'],
                 'complex', 'Comprehensive topic exploration'),
        Template('blank', 'Blank Canvas', 'Start from scratch',
                 ['blank', 'custom', 'freeform', 'scratch'],
                 'simple', 'Complete creative freedom'),
    ],
    'essay': [
        Template('argumentative', 'Argumentative', 'Claim, evidence, counterarguments',
                 ['argumentative', 'persuasive', 'debate', 'claim', 'evidence'],
                 'moderate', 'Persuasive essays with clear thesis'),
        Template('narrative', 'Narrative Essay', 'Personal story with reflection',
                 ['narrative', 'personal', 'story', 'reflection', 'memoir'],
                 'simple', 'Personal storytelling with insight'),
        Template('compare-contrast', 'Compare & Contrast', 'Analyze similarities and differences',
                 ['compare', 'contrast', 'comparison', 'similarities', 'differences'],
                 'moderate', 'Analytical comparison of subjects'),
        Template('blank', 'Blank Canvas', 'Start from scratch',
                 ['blank', 'custom', 'freeform', 'scratch'],
                 'simple', 'Complete creative freedom'),
    ],
}


def get_templates_for_format(format_type: str) -> List[Template]:
    """Get templates for a specific format"""
    return TEMPLATE_REGISTRY.get(format_type, [])


def get_template_by_id(format_type: str, template_id: str) -> Optional[Template]:
    """Get a specific template by ID"""
    templates = get_templates_for_format(format_type)
    for template in templates:
        if template.id == template_id:
            return template
    return None


def find_template_by_keywords(format_type: str, query: str) -> Optional[Template]:
    """Find template by keyword matching (for intent analysis)"""
    templates = get_templates_for_format(format_type)
    lower_query = query.lower()
    
    # Try exact name match first
    for template in templates:
        if template.name.lower() == lower_query:
            return template
    
    # Try keyword matching
    for template in templates:
        for keyword in template.keywords:
            if keyword in lower_query or lower_query in keyword:
                return template
    
    return None


def get_format_label(format_type: str) -> str:
    """Get human-readable label for format"""
    labels = {
        'novel': 'Novel',
        'short-story': 'Short Story',
        'screenplay': 'Screenplay',
        'podcast': 'Podcast',
        'report': 'Report',
        'article': 'Article',
        'essay': 'Essay',
    }
    return labels.get(format_type, format_type.replace('-', ' ').title())


def get_available_formats() -> List[str]:
    """Get all formats that have templates"""
    return list(TEMPLATE_REGISTRY.keys())