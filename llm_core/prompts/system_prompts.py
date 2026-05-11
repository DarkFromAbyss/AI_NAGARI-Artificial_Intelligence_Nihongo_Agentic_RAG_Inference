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
        """Assemble complete system prompt with language settings.
        
        Args:
            display_lang: Output language ("en", "vi", or "ja")
            recent_time: Current time for temporal awareness
        
        Returns:
            Complete system prompt string
        """
        system_prompt = f"""
{self.intro_content}

{self.context_content}

{self.rules_content}

[SYSTEM SETTINGS]
- Output language (display_lang) for this session: "{display_lang}"
- If display_lang="en": Write <display> section in English
- If display_lang="vi": Write <display> section in Vietnamese
- If display_lang="ja": Write <display> section in Japanese
- If recent_time {recent_time} is provided: Include it in the system prompt for temporal awareness
- <voice> tag MUST ALWAYS be in Japanese (にほんご)
- Max reasoning steps: 3
- Safety guardrails: Enabled
"""
        if recent_time:
            system_prompt = system_prompt.replace("{recent_time}", recent_time)
        return system_prompt.strip()

    def get_prompt_stats(self) -> Dict[str, int]:
        """Return prompt statistics for monitoring."""
        return {
            "intro_chars": len(self.intro_content),
            "context_chars": len(self.context_content),
            "rules_chars": len(self.rules_content),
            "total_chars": (len(self.intro_content) + 
                          len(self.context_content) + 
                          len(self.rules_content))
        }
