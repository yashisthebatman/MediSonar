from __future__ import annotations

from datetime import datetime, timedelta, timezone

from ..config import Settings
from ..schemas import AdvisoryItem, AdvisoriesResponse
from ..utils.json_tools import extract_json_array
from .ai import GeminiService
from .memory import MemoryStore


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AdvisoryService:
    def __init__(self, settings: Settings, ai_service: GeminiService, store: MemoryStore) -> None:
        self.settings = settings
        self.ai_service = ai_service
        self.store = store

    def get_advisories(self, location: str, conditions: str, force_refresh: bool = False) -> AdvisoriesResponse:
        normalized_location = location.strip()
        normalized_conditions = conditions.strip()
        if len(normalized_location) < 2:
            return AdvisoriesResponse(advisories=[], error="Add a city or region in your profile to load local advisories.")

        if not force_refresh:
            cached = self.store.get_advisories_cache(normalized_location, normalized_conditions)
            if cached and cached["expires_at"] > _utc_now():
                return AdvisoriesResponse(
                    advisories=[AdvisoryItem(**item) for item in cached["payload"]],
                    cached=True,
                    fetched_at=cached["fetched_at"].isoformat(),
                    expires_at=cached["expires_at"].isoformat(),
                    error="",
                )

        fresh = self._fetch_advisories(normalized_location, normalized_conditions)
        if fresh.advisories:
            return fresh

        stale = self.store.get_advisories_cache(normalized_location, normalized_conditions)
        if stale:
            return AdvisoriesResponse(
                advisories=[AdvisoryItem(**item) for item in stale["payload"]],
                cached=True,
                fetched_at=stale["fetched_at"].isoformat(),
                expires_at=stale["expires_at"].isoformat(),
                error=fresh.error,
            )

        return fresh

    def _fetch_advisories(self, location: str, conditions: str) -> AdvisoriesResponse:
        client = self.ai_service.get_client()
        condition_hint = (
            f"Pay extra attention to risks that matter for these conditions: {conditions}. "
            if conditions.strip()
            else ""
        )
        system_instruction = (
            "Search the web for the latest official health advisories for one location and return only JSON.\n"
            "Use official sources when possible such as government health departments, CDC, WHO, EPA, weather services, and food safety agencies.\n"
            "Prefer advisories that are active now or were updated very recently.\n"
            "Return a JSON array only.\n"
            "Each item must contain: title, severity, description, source, url.\n"
            "Severity must be one of: high, medium, low, info.\n"
            "Keep descriptions short and practical.\n"
            "If there are no credible current advisories, return []."
        )
        prompt = (
            f"Today is {_utc_now().date().isoformat()}. "
            f"Find 3 to 5 latest official health advisories for {location}. "
            f"{condition_hint}"
            "Focus on alerts people in that area should know right now such as outbreaks, air quality, extreme heat, flood risk, vaccination notices, or food/water safety notices. "
            "Return only a JSON array with title, severity, description, source, and url."
        )
        try:
            response = client.models.generate_content(
                model=self.settings.grounded_model,
                contents=prompt,
                config=self.ai_service.grounded_search_config(system_instruction, max_output_tokens=1024),
            )
            raw_text = self.ai_service.extract_text(response)
        except Exception as exc:
            return AdvisoriesResponse(advisories=[], error=f"Grounded advisory search failed: {exc}")

        advisories = self._normalize_advisories(extract_json_array(raw_text))
        if not advisories and raw_text:
            try:
                advisories = self._normalize_advisories(
                    extract_json_array(
                        self.ai_service.extract_text(
                            client.models.generate_content(
                                model=self.settings.chat_model,
                                contents=(
                                    "Convert the following grounded-search notes into a JSON array only. "
                                    "Each item must contain title, severity, description, source, and url.\n\n"
                                    f"{raw_text}"
                                ),
                                config=self.ai_service.standard_config(
                                    "Return only a valid JSON array. Do not include markdown.",
                                    max_output_tokens=768,
                                ),
                            )
                        )
                    )
                )
            except Exception:
                advisories = []
        if not advisories:
            return AdvisoriesResponse(
                advisories=[],
                error="No credible current advisories were returned for that region. Try refreshing in a moment.",
            )

        fetched_at = _utc_now()
        expires_at = fetched_at + timedelta(seconds=self.settings.advisories_cache_ttl_seconds)
        payload = [item.model_dump() for item in advisories]
        self.store.save_advisories_cache(location, conditions, payload, fetched_at, expires_at)
        return AdvisoriesResponse(
            advisories=advisories,
            cached=False,
            fetched_at=fetched_at.isoformat(),
            expires_at=expires_at.isoformat(),
            error="",
        )

    def _normalize_advisories(self, items: list[dict]) -> list[AdvisoryItem]:
        advisories: list[AdvisoryItem] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            title = str(item.get("title", "")).strip()
            description = str(item.get("description", "")).strip()
            if not title or not description:
                continue
            severity = str(item.get("severity", "info")).strip().lower()
            if severity not in {"high", "medium", "low", "info"}:
                severity = "info"
            advisories.append(
                AdvisoryItem(
                    title=title,
                    severity=severity,
                    description=description,
                    source=str(item.get("source", "")).strip(),
                    url=str(item.get("url", "")).strip(),
                )
            )
        return advisories[:5]


class SpecialistService:
    def __init__(self, settings: Settings, ai_service: GeminiService) -> None:
        self.settings = settings
        self.ai_service = ai_service

    def find_specialists(self, disease: str, location: str) -> list[dict]:
        if not disease.strip() or not location.strip():
            return []

        client = self.ai_service.get_client()
        system_instruction = (
            "Search for real doctors, hospitals, and clinics for the requested condition and location.\n"
            "Return only a JSON array. Each item must include name, specialty, address, phone, rating, notes.\n"
            "Prioritize nearby real providers with enough detail to contact them.\n"
            "Do not invent data."
        )
        prompt = (
            f"Find 3 to 5 real specialists, clinics, or hospitals for {disease} near {location}. "
            "Include the provider name, specialty, address, phone if available, rating if available, and one short note. "
            "Return JSON only."
        )
        response = client.models.generate_content(
            model=self.settings.grounded_model,
            contents=prompt,
            config=self.ai_service.grounded_search_config(system_instruction, max_output_tokens=1024),
        )

        raw_text = self.ai_service.extract_text(response)
        parsed = extract_json_array(raw_text)
        if not parsed and raw_text:
            try:
                parsed = extract_json_array(
                    self.ai_service.extract_text(
                        client.models.generate_content(
                            model=self.settings.chat_model,
                            contents=(
                                "Convert these grounded-search notes into a JSON array only. "
                                "Each item must include name, specialty, address, phone, rating, and notes.\n\n"
                                f"{raw_text}"
                            ),
                            config=self.ai_service.standard_config(
                                "Return only a valid JSON array. Do not include markdown.",
                                max_output_tokens=768,
                            ),
                        )
                    )
                )
            except Exception:
                parsed = []

        specialists: list[dict] = []
        for item in parsed:
            if not isinstance(item, dict) or not item.get("name"):
                continue
            specialists.append(
                {
                    "name": str(item.get("name", "")).strip(),
                    "specialty": str(item.get("specialty", "")).strip(),
                    "address": str(item.get("address", "")).strip(),
                    "phone": str(item.get("phone", "")).strip(),
                    "rating": str(item.get("rating", "")).strip(),
                    "notes": str(item.get("notes", "")).strip(),
                }
            )
        return specialists[:5]
