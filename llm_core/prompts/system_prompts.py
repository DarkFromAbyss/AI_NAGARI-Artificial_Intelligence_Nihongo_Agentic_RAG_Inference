"""System prompt management for the Sensei agent.

Loads and assembles system instructions from markdown files in brain/ directory.
Follows rules.md: prompts treated as code with version control.
"""

import os
from typing import Dict, Optional
from llm_core.utils.logger import get_logger
from llm_core.utils.data_loaders import load_markdown_file

logger = get_logger(__name__)


class SystemPromptManager:
    """Manages system prompts for the Sensei agent.
    
    Loads intro.md, context.md, and rules.md from brain/ directory.
    Assembles complete system prompt with dynamic language settings.
    """
    
    def __init__(self, brain_path: str):
        """Initialize prompt manager and load brain files.
        
        Args:
            brain_path: Path to brain/7B directory
        """
        self.brain_path = brain_path
        self.logger = logger
        
        # Load markdown files
        self.intro_content = load_markdown_file(os.path.join(brain_path, "intro.md"))
        self.context_content = load_markdown_file(os.path.join(brain_path, "context.md"))
        self.rules_content = load_markdown_file(os.path.join(brain_path, "rules.md"))
        
        self.logger.info("System prompts loaded from %s", brain_path)
    
    def get_system_prompt(self, 
                          display_lang: str = "en", 
                          recent_time: str = "") -> str:
        """Assemble complete system prompt with language settings and TTS instructions.
        
        Args:
            display_lang: Output language ("en", "vi", or "ja")
            recent_time: Current time for temporal awareness
        
        Returns:
            Complete system prompt string with dual-track XML output enforcer
        """
        xml_output_enforcer = f"""[MANDATORY OUTPUT FORMAT - DUAL TRACK XML]

You MUST output responses ONLY using these EXACT FIVE independent XML tags as top-level siblings. 
CRITICAL: DO NOT wrap your response in markdown code blocks (```xml). DO NOT nest tags.

<html>
  [Dynamic HTML Content for Web UI]
  - For VOCABULARY queries, use Layout A (Flashcard):
    <div class="vocab-card">
      <h2 class="vocab-word">Kanji/Kana (Romaji)</h2>
      <p class="vocab-meaning"><b>Ý nghĩa:</b> ...</p>
      <hr>
      <div class="vocab-details"><p><b>Từ loại:</b> ...</p><p><b>Ví dụ:</b></p><ul><li>...</li></ul></div>
    </div>
  
  - For GRAMMAR queries, use Layout B (Structural Analysis):
    <div class="grammar-container">
      <h2 class="grammar-title">Cấu trúc: ...</h2>
      <p class="grammar-concept"><b>Khái niệm:</b> ...</p>
      <div class="grammar-usage"><p><b>Cách kết nối:</b> ...</p></div>
      <div class="grammar-examples"><p><b>Ví dụ cụ thể:</b></p><ul><li>...<br><small>...</small></li></ul></div>
      <div class="grammar-note"><p><b>💡 Chú ý:</b> ...</p></div>
    </div>
  
  - For CASUAL/OTHER queries, use Layout C (Minimal):
    <p>[Short paragraph in {display_lang}]</p>
</html>

<text>
  [Dynamic Markdown Content]
  - For VOCABULARY/GRAMMAR: Output retrieved pedagogical data using strictly ordered, logically organized Markdown. 
    + Use bolding (**), lists (-), and headings (###) to guide the reader to the core focus immediately.
    + Long content MUST be broken into short paragraphs or split at periods to enhance readability.
    + Non-Japanese explanations must be generated in {display_lang}.
  - For CASUAL: Provide a brief, natural text response in {display_lang}.
</text>

<display>
  [Short, emotional summary text generated in {display_lang}. NO HTML. Max 150 chars]
</display>

<voice>
  [Pure natural Japanese for TTS. Use Hiragana/Katakana for difficult Kanji. Max 300 chars]
</voice>

<intent>
  [ONLY "other" or "search"]
</intent>

CRITICAL INSTRUCTIONS:
1. Every response MUST contain all five tags in strict order: <html>, <text>, <display>, <voice>, <intent>.
2. The <html> content is injected directly into a web interface; ensure all tags are closed properly.
3. No text, thought process, or markdown formatting is allowed outside the XML tags.

[SYSTEM SETTINGS]
- Output language for <display>, <text>, and explanations: "{display_lang}"
- Current time context: {recent_time}
- TTS Voice Synthesis: Enabled
- Max reasoning steps: 3
"""
        
        system_prompt = f"""
{self.intro_content}

{self.rules_content}

{xml_output_enforcer}
"""
        return system_prompt.strip()

    def get_prompt_stats(self) -> Dict[str, int]:
        """Return prompt statistics for monitoring."""
        return {
            "intro_chars": len(self.intro_content),
            "rules_chars": len(self.rules_content),
            "total_chars": (len(self.intro_content) + 
                          len(self.context_content) + 
                          len(self.rules_content))
        }
