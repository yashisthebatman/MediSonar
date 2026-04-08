from __future__ import annotations

import base64
from typing import Optional

from google import genai
from google.genai import types

from ..config import Settings
from ..schemas import HealthProfile


class GeminiService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def is_configured(self) -> bool:
        return bool(self.settings.gemini_api_key)

    def get_client(self) -> genai.Client:
        return genai.Client(api_key=self.settings.gemini_api_key)

    def format_health_profile(self, profile: Optional[HealthProfile]) -> str:
        if not profile:
            return "No health profile provided."

        parts: list[str] = []
        for label, value in (
            ("Name", profile.name),
            ("Age", profile.age),
            ("Gender", profile.gender),
            ("Location", profile.location),
            ("Weight", profile.weight),
            ("Height", profile.height),
            ("Blood group", profile.bloodGroup),
            ("Existing conditions", profile.conditions),
            ("Allergies", profile.allergies),
            ("Current medications", profile.medications),
        ):
            if value:
                parts.append(f"{label}: {value}")
        return "\n".join(parts) if parts else "No health profile data filled."

    def build_chat_system_instruction(self, health_context: str, user_context: str) -> str:
        return (
            "You are MediSonar, an AI medical assistant that helps users understand symptoms "
            "and find appropriate care.\n\n"
            "RESPONSE FORMAT:\n"
            "- Use markdown with concise headings and bullet points when useful\n"
            "- Keep responses focused and organized\n"
            "- Use a professional, warm tone\n\n"
            "BEHAVIORAL RULES:\n"
            "- Do not greet the user in every response\n"
            "- Ask clarifying questions when symptoms are vague\n"
            "- Suggest the relevant specialist type when appropriate\n"
            "- End with a reminder to consult a healthcare professional for diagnosis\n"
            "- If the user asks to connect with or find a specialist, include "
            "[FIND_SPECIALIST] followed by the specialist type in your response.\n\n"
            f"Patient Health Profile:\n{health_context}\n\n"
            f"Remembered Context:\n{user_context}\n\n"
            "IMPORTANT: You are not a doctor. Suggest possibilities and recommend professional consultation."
        )

    def build_contents_from_history(self, history: list[dict], current_message: str) -> list[types.Content]:
        contents: list[types.Content] = []
        for msg in history[-20:]:
            role = "model" if msg.get("role") == "assistant" else "user"
            content = msg.get("content", "")
            if content:
                contents.append(types.Content(role=role, parts=[types.Part.from_text(text=content)]))
        if current_message:
            contents.append(types.Content(role="user", parts=[types.Part.from_text(text=current_message)]))
        return contents

    def build_image_parts(self, files: list[dict], message: str) -> list:
        parts: list = []
        image_mime_types = {"image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"}
        for item in files:
            mime_type = item.get("mime_type") or item.get("type") or "application/octet-stream"
            if mime_type not in image_mime_types:
                continue
            parts.append(types.Part.from_bytes(data=base64.b64decode(item["data"]), mime_type=mime_type))
        if message:
            parts.append(message)
        return parts

    def grounded_search_config(self, system_instruction: str, max_output_tokens: int = 1536) -> types.GenerateContentConfig:
        return types.GenerateContentConfig(
            system_instruction=system_instruction,
            tools=[types.Tool(google_search=types.GoogleSearch())],
            max_output_tokens=max_output_tokens,
        )

