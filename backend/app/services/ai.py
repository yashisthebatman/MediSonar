from __future__ import annotations

import base64
import json
import re
from typing import Optional

from google import genai
from google.genai import types

from ..config import Settings
from ..schemas import HealthProfile


SERVICE_ERROR_MARKERS = (
    "429",
    "connection refused",
    "actively refused",
    "timed out",
    "timeout",
    "temporarily unavailable",
    "unavailable",
    "name or service not known",
    "name resolution",
    "network is unreachable",
    "failed to establish a new connection",
    "max retries exceeded",
    "resource_exhausted",
    "quota exceeded",
    "rate limit",
    "retryinfo",
    "503",
    "502",
    "504",
)

URGENT_SYMPTOM_MARKERS = (
    "chest pain",
    "shortness of breath",
    "difficulty breathing",
    "severe bleeding",
    "stroke",
    "seizure",
    "passed out",
    "fainted",
    "unconscious",
    "anaphyl",
    "suicid",
)

SPECIALTY_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"(skin|rash|acne|dermat)", re.IGNORECASE), "dermatologist"),
    (re.compile(r"(heart|chest pain|cardio)", re.IGNORECASE), "cardiologist"),
    (re.compile(r"(lung|breath|asthma|pulmon)", re.IGNORECASE), "pulmonologist"),
    (re.compile(r"(brain|seizure|migraine|neuro)", re.IGNORECASE), "neurologist"),
    (re.compile(r"(child|kid|pediatric)", re.IGNORECASE), "pediatrician"),
    (re.compile(r"(bone|joint|fracture|ortho)", re.IGNORECASE), "orthopedic specialist"),
    (re.compile(r"(stomach|abdomen|liver|gastric)", re.IGNORECASE), "gastroenterologist"),
    (re.compile(r"(mental|anxiety|depress|psychi)", re.IGNORECASE), "psychiatrist"),
    (re.compile(r"(eye|vision|ophthal)", re.IGNORECASE), "ophthalmologist"),
    (re.compile(r"(ear|nose|throat|ent)", re.IGNORECASE), "ENT specialist"),
    (
        re.compile(r"(general practitioner|primary care|family doctor)", re.IGNORECASE),
        "general practitioner",
    ),
)

EXPLICIT_SPECIALIST_ACTIONS = (
    "connect me",
    "find me",
    "show me",
    "give me",
    "recommend",
    "refer me",
    "book me",
    "help me find",
    "can you connect me",
    "can you find me",
    "i need",
    "i want",
    "can you get me",
)

GENERIC_PROVIDER_TERMS = (
    "specialist",
    "doctor",
    "physician",
    "clinic",
    "hospital",
    "practitioner",
)


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
            "You are MediSonar, an AI medical assistant that helps users understand symptoms and choose next steps.\n\n"
            "Style rules:\n"
            "- Answer directly without filler greetings\n"
            "- Use short markdown sections and bullets when useful\n"
            "- Be practical, calm, and specific\n"
            "- If symptoms are vague, ask 1 to 3 focused follow-up questions\n"
            "- If urgent red flags appear, say so clearly\n"
            "- End with a brief reminder that a clinician should confirm diagnosis and treatment\n"
            "- If the user asks to find a doctor or specialist, briefly say you can surface nearby options based on their location\n\n"
            f"Patient Health Profile:\n{health_context}\n\n"
            f"Remembered Context:\n{user_context}\n\n"
            "You are not a doctor. Do not claim certainty."
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
            parts.append(types.Part.from_text(text=message))
        return parts

    def grounded_search_config(self, system_instruction: str, max_output_tokens: int = 1536) -> types.GenerateContentConfig:
        return types.GenerateContentConfig(
            system_instruction=system_instruction,
            tools=[types.Tool(google_search=types.GoogleSearch())],
            max_output_tokens=max_output_tokens,
        )

    def standard_config(self, system_instruction: str, max_output_tokens: int = 1536) -> types.GenerateContentConfig:
        return types.GenerateContentConfig(
            system_instruction=system_instruction,
            max_output_tokens=max_output_tokens,
        )

    def should_ground_chat_search(self, message: str) -> bool:
        lowered = message.lower()
        search_terms = (
            "latest",
            "current",
            "today",
            "near me",
            "nearby",
            "in my area",
            "specialist",
            "doctor near",
            "hospital near",
            "outbreak",
            "advisory",
            "air quality",
            "weather alert",
            "vaccination",
            "cdc",
            "who",
            "guideline",
        )
        return any(term in lowered for term in search_terms)

    def wants_specialist_help(self, message: str, reply: str = "") -> bool:
        return self.is_explicit_specialist_request(message)

    def is_explicit_specialist_request(self, message: str) -> bool:
        lowered = (message or "").lower()
        if not lowered:
            return False
        action_requested = any(term in lowered for term in EXPLICIT_SPECIALIST_ACTIONS)
        provider_requested = any(term in lowered for term in GENERIC_PROVIDER_TERMS) or any(
            pattern.search(lowered) for pattern, _ in SPECIALTY_PATTERNS
        )
        location_hint = any(term in lowered for term in ("near me", "nearby", "in my area"))
        return (action_requested and provider_requested) or (provider_requested and location_hint)

    def extract_specialist_query(
        self,
        client: genai.Client,
        message: str,
        reply: str,
        health_context: str,
        history: list[dict],
    ) -> str:
        tagged_match = re.search(r"\[FIND_SPECIALIST\]\s*(.+)", reply or "", re.IGNORECASE)
        if tagged_match:
            return tagged_match.group(1).strip()

        if not self.is_explicit_specialist_request(message):
            return ""

        recent_history = "\n".join(
            f"{item.get('role', 'user')}: {item.get('content', '')}"
            for item in history[-8:]
            if item.get("content")
        )
        extraction_prompt = (
            "Determine whether the user wants nearby healthcare professionals.\n"
            "Return only JSON in the form {\"needs_specialist\": true|false, \"specialty\": \"...\"}.\n"
            "Use a practical search phrase like 'general practitioner', 'dermatologist', "
            "'pediatric neurologist', or 'primary care doctor'.\n"
            "If the request is broad, prefer 'general practitioner' or 'primary care doctor'.\n"
            "If no specialist search is needed, return {\"needs_specialist\": false, \"specialty\": \"\"}.\n\n"
            f"Health profile:\n{health_context}\n\n"
            f"Recent conversation:\n{recent_history or 'None'}\n\n"
            f"Latest user message:\n{message}\n\n"
            f"Assistant reply:\n{reply}"
        )

        try:
            response = client.models.generate_content(
                model=self.settings.chat_model,
                contents=extraction_prompt,
                config=self.standard_config(
                    "Return only valid JSON. Do not wrap the answer in markdown.",
                    max_output_tokens=180,
                ),
            )
            parsed = json.loads(self.extract_text(response) or "{}")
        except Exception:
            return self.infer_specialty_from_text(message, reply)

        if not parsed.get("needs_specialist"):
            return ""
        return str(parsed.get("specialty", "")).strip()

    def infer_specialty_from_text(self, *segments: str) -> str:
        combined = " ".join(segment for segment in segments if segment).strip()
        if not combined:
            return ""
        if not self.is_explicit_specialist_request(combined):
            return ""
        for pattern, specialty in SPECIALTY_PATTERNS:
            if pattern.search(combined):
                return specialty
        return "general practitioner"

    def is_temporary_service_error(self, exc: Exception) -> bool:
        text = str(exc).lower()
        return any(marker in text for marker in SERVICE_ERROR_MARKERS)

    def format_service_error(self, capability: str, exc: Exception) -> str:
        text = str(exc).lower()
        if "resource_exhausted" in text or "quota exceeded" in text or "429" in text:
            return (
                f"The live {capability} service hit its current Gemini quota limit. "
                "Wait a minute and try again, or switch to a paid API plan/key."
            )
        if self.is_temporary_service_error(exc):
            return (
                f"The live {capability} service is temporarily unavailable. "
                "Check the internet connection or Gemini API access and try again."
            )
        return f"The {capability} service could not complete the request right now."

    def fallback_chat_response(self, message: str, has_files: bool = False) -> str:
        lowered = message.lower()
        if any(marker in lowered for marker in URGENT_SYMPTOM_MARKERS):
            return (
                "The live AI service is temporarily unavailable. Because you mentioned potentially urgent symptoms, "
                "please contact emergency care or a clinician right away instead of waiting for the app."
            )
        if has_files:
            return (
                "The live AI image analysis service is temporarily unavailable. Please try again shortly, "
                "or describe what the image shows so a clinician can review it with you."
            )
        return (
            "The live AI service is temporarily unavailable right now. Please try again shortly. "
            "If symptoms are worsening, severe, or urgent, contact a clinician or emergency care."
        )

    def extract_text(self, response) -> str:
        try:
            text = response.text
        except Exception:
            text = None
        if text:
            return text.strip()

        chunks: list[str] = []
        for candidate in getattr(response, "candidates", []) or []:
            content = getattr(candidate, "content", None)
            for part in getattr(content, "parts", []) or []:
                part_text = getattr(part, "text", None)
                if part_text:
                    chunks.append(part_text)
        return "\n".join(chunks).strip()
