"""
Tests for Intent Classification

Run with: pytest tests/test_intent.py -v

These tests verify that pattern matching works correctly,
without needing LLM API calls (fast, deterministic).
"""

import pytest
from orchestrator.intent.classifier import classify_with_patterns
from orchestrator.intent.types import PipelineContext, IntentAnalysis


# ============================================================
# TEST FIXTURES
# ============================================================

@pytest.fixture
def empty_context():
    """Context with no document open, no segment selected."""
    return PipelineContext(
        message="",
        activeSegment=None,
        documentPanelOpen=False,
        documentFormat=None,
        canvasContext=None,
        conversationHistory=[]
    )


@pytest.fixture
def document_open_context():
    """Context with document panel open but no segment selected."""
    return PipelineContext(
        message="",
        activeSegment=None,
        documentPanelOpen=True,
        documentFormat="novel",
        canvasContext=None,
        conversationHistory=[]
    )


@pytest.fixture
def segment_selected_context():
    """Context with a segment selected in the document."""
    return PipelineContext(
        message="",
        activeSegment={"id": "ch1", "name": "Chapter 1", "level": 2},
        documentPanelOpen=True,
        documentFormat="novel",
        canvasContext=None,
        conversationHistory=[]
    )


@pytest.fixture
def canvas_context():
    """Context with canvas nodes (no document open)."""
    return PipelineContext(
        message="",
        activeSegment=None,
        documentPanelOpen=False,
        documentFormat=None,
        canvasContext={
            "connectedNodes": [
                {"nodeId": "node-1", "nodeType": "story-structure", "label": "My Novel"}
            ],
            "allNodes": [
                {"nodeId": "node-1", "nodeType": "story-structure", "label": "My Novel"}
            ],
            "totalNodes": 1
        },
        conversationHistory=[]
    )


# ============================================================
# STRUCTURE CREATION TESTS
# ============================================================

class TestStructureCreation:
    """Tests for create_structure intent detection."""
    
    def test_create_novel(self, empty_context):
        """'Create a novel about...' should detect create_structure."""
        result = classify_with_patterns("Create a novel about dragons", empty_context)
        
        assert result is not None
        assert result.intent == "create_structure"
        assert result.confidence >= 0.9
        assert result.usedLLM == False
    
    def test_story_about(self, empty_context):
        """'A story about...' should detect create_structure."""
        result = classify_with_patterns("A story about a detective in Oslo", empty_context)
        
        assert result is not None
        assert result.intent == "create_structure"
    
    def test_screenplay_request(self, empty_context):
        """'Write a screenplay...' should detect create_structure."""
        result = classify_with_patterns("Write a screenplay about space explorers", empty_context)
        
        assert result is not None
        assert result.intent == "create_structure"
    
    def test_no_structure_when_document_open(self, document_open_context):
        """Should NOT detect create_structure when document is already open."""
        result = classify_with_patterns("Create a novel about dragons", document_open_context)
        
        # Should return None (needs deeper analysis) or a different intent
        # because we don't create structures when a document is already open
        assert result is None or result.intent != "create_structure"


# ============================================================
# WRITE CONTENT TESTS
# ============================================================

class TestWriteContent:
    """Tests for write_content intent detection."""
    
    def test_write_this_chapter(self, segment_selected_context):
        """'Write this chapter' with segment selected should detect write_content."""
        result = classify_with_patterns("Write this chapter", segment_selected_context)
        
        assert result is not None
        assert result.intent == "write_content"
        assert result.confidence >= 0.9
        assert "Chapter 1" in result.suggestedAction
    
    def test_expand_section(self, segment_selected_context):
        """'Expand this section' should detect write_content."""
        result = classify_with_patterns("Expand this section", segment_selected_context)
        
        assert result is not None
        assert result.intent == "write_content"
    
    def test_continue_writing(self, segment_selected_context):
        """'Continue writing' should detect write_content."""
        result = classify_with_patterns("Continue writing", segment_selected_context)
        
        assert result is not None
        assert result.intent == "write_content"
    
    def test_write_without_segment(self, document_open_context):
        """'Write' without segment selected should NOT match write_content."""
        result = classify_with_patterns("Write this chapter", document_open_context)
        
        # Should not match because no segment is selected
        assert result is None or result.intent != "write_content"


# ============================================================
# QUESTION TESTS
# ============================================================

class TestAnswerQuestion:
    """Tests for answer_question intent detection."""
    
    def test_what_question(self, empty_context):
        """Questions starting with 'What' should detect answer_question."""
        result = classify_with_patterns("What is the theme of my story?", empty_context)
        
        assert result is not None
        assert result.intent == "answer_question"
    
    def test_how_question(self, empty_context):
        """Questions starting with 'How' should detect answer_question."""
        result = classify_with_patterns("How do I improve the pacing?", empty_context)
        
        assert result is not None
        assert result.intent == "answer_question"
    
    def test_question_mark(self, empty_context):
        """Sentences ending with '?' should detect answer_question."""
        result = classify_with_patterns("Is this a good plot twist?", empty_context)
        
        assert result is not None
        assert result.intent == "answer_question"


# ============================================================
# NAVIGATION TESTS
# ============================================================

class TestNavigation:
    """Tests for navigate_section intent detection."""
    
    def test_go_to_chapter(self, document_open_context):
        """'Go to chapter 3' with document open should detect navigate_section."""
        result = classify_with_patterns("Go to chapter 3", document_open_context)
        
        assert result is not None
        assert result.intent == "navigate_section"
    
    def test_show_me_section(self, document_open_context):
        """'Show me the introduction' should detect navigate_section."""
        result = classify_with_patterns("Show me the introduction", document_open_context)
        
        assert result is not None
        assert result.intent == "navigate_section"
    
    def test_navigate_without_document(self, empty_context):
        """Navigation without document open should not match."""
        result = classify_with_patterns("Go to chapter 3", empty_context)
        
        # Should not match navigation when document isn't open
        assert result is None or result.intent != "navigate_section"


# ============================================================
# DELETE TESTS
# ============================================================

class TestDelete:
    """Tests for delete_node intent detection."""
    
    def test_delete_node(self, empty_context):
        """'Delete this node' should detect delete_node."""
        result = classify_with_patterns("Delete this node", empty_context)
        
        assert result is not None
        assert result.intent == "delete_node"
    
    def test_remove_document(self, empty_context):
        """'Remove the document' should detect delete_node."""
        result = classify_with_patterns("Remove the document", empty_context)
        
        assert result is not None
        assert result.intent == "delete_node"


# ============================================================
# NO MATCH TESTS
# ============================================================

class TestNoMatch:
    """Tests for messages that should NOT match patterns."""
    
    def test_complex_request(self, empty_context):
        """Complex requests should return None (needs LLM)."""
        result = classify_with_patterns(
            "I want something like Game of Thrones but in space", 
            empty_context
        )
        
        # Should not match - needs deeper analysis
        assert result is None
    
    def test_ambiguous_request(self, empty_context):
        """Ambiguous requests should return None."""
        result = classify_with_patterns(
            "Make it better but keep the essence", 
            empty_context
        )
        
        assert result is None
    
    def test_conditional_request(self, empty_context):
        """Conditional requests should return None."""
        result = classify_with_patterns(
            "If the protagonist is female, change chapter 2", 
            empty_context
        )
        
        assert result is None


# ============================================================
# RUN TESTS
# ============================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
