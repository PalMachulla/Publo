# graph/agents/writer.py

"""
Writer Agent

Generates content for sections using LLM.
Replaces: WriterAgent.ts
"""

import os
from typing import Optional
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

# Initialize LLM
def get_writer_llm():
    """Get LLM for writing tasks"""
    if os.getenv("ANTHROPIC_API_KEY"):
        return ChatAnthropic(
            model="claude-sonnet-4-20250514",
            temperature=0.7,
            max_tokens=4000
        )
    elif os.getenv("OPENAI_API_KEY"):
        return ChatOpenAI(
            model="gpt-4o",
            temperature=0.7,
            max_tokens=4000
        )
    else:
        raise ValueError("No API key found for writer agent")


WRITER_SYSTEM_PROMPT = """You are an expert creative writer. Your task is to generate 
high-quality content for the given section.

Guidelines:
- Write in a clear, engaging style
- Match the tone and voice of any existing content
- Be creative while staying true to the context
- Use vivid descriptions and strong narrative flow

{context_section}
"""

WRITER_USER_PROMPT = """Section: {section_name}

User request: {prompt}

Write the content for this section:"""


async def generate_content(
    prompt: str,
    section_name: Optional[str] = None,
    context: Optional[str] = None,
    existing_content: Optional[str] = None
) -> str:
    """
    Generate content for a section.
    
    Args:
        prompt: User's writing request
        section_name: Name of the section to write
        context: Canvas/document context
        existing_content: Existing content to continue from
        
    Returns:
        Generated content string
    """
    llm = get_writer_llm()
    
    # Build context section
    context_parts = []
    if context:
        context_parts.append(f"Document Context:\n{context}")
    if existing_content:
        context_parts.append(f"Existing Content:\n{existing_content[:2000]}...")
    
    context_section = "\n\n".join(context_parts) if context_parts else ""
    
    # Create prompt
    chat_prompt = ChatPromptTemplate.from_messages([
        ("system", WRITER_SYSTEM_PROMPT),
        ("user", WRITER_USER_PROMPT)
    ])
    
    # Generate
    chain = chat_prompt | llm
    
    response = await chain.ainvoke({
        "context_section": context_section,
        "section_name": section_name or "Content",
        "prompt": prompt
    })
    
    print(f"✍️ [Writer] Generated {len(response.content)} characters")
    
    return response.content