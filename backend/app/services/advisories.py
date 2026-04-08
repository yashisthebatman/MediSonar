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
            return AdvisoriesResponse(advisories=[])

        if not force_refresh:
            cached = self.store.get_advisories_cache(normalized_location, normalized_conditions)
            if cached and cached["expires_at"] > _utc_now():
                return AdvisoriesResponse(
                    advisories=[AdvisoryItem(**item) for item in cached["payload"]],
                    cached=True,
                    fetched_at=cached["fetched_at"].isoformat(),
                    expires_at=cached["expires_at"].isoformat(),
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
            )
        return AdvisoriesResponse(advisories=[])

    def _fetch_advisories(self, location: str, conditions: str) -> AdvisoriesResponse:
        client = self.ai_service.get_client()
        system_instruction = (
            "You are a health advisory research assistant. Search the live web and return only current, real "
            "health advisories from official public-health or government sources relevant to the user's area.\n\n"
            "Output requirements:\n"
            "- Return only a JSON array\n"
            "- Each item must contain title, severity, description, source, url\n"
            "- severity must be one of: high, medium, low, info\n"
            "- description must be 35 to 90 words and explain the health risk and the practical action\n"
            "- Prefer agencies like CDC, WHO, NIH, local health departments, national weather services, EPA, and food safety authorities\n"
            "- If there are no credible current advisories, return []\n"
            f"- Location: {location}\n"
            f"- User conditions to prioritize when relevant: {conditions or 'None'}"
        )
        response = client.models.generate_content(
            model=self.settings.grounded_model,
            contents=(
                f"Find current official health advisories for {location}. "
                "Return a JSON array with title, severity, description, source, and url."
            ),
            config=self.ai_service.grounded_search_config(system_instruction),
        )
        advisories = self._normalize_advisories(extract_json_array(response.text or ""))
        if not advisories:
            return AdvisoriesResponse(advisories=[])

        fetched_at = _utc_now()
        expires_at = fetched_at + timedelta(seconds=self.settings.advisories_cache_ttl_seconds)
        payload = [item.model_dump() for item in advisories]
        self.store.save_advisories_cache(location, conditions, payload, fetched_at, expires_at)
        return AdvisoriesResponse(
            advisories=advisories,
            cached=False,
            fetched_at=fetched_at.isoformat(),
            expires_at=expires_at.isoformat(),
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
            "You are a medical specialist finder. Search the web for real doctors, hospitals, and clinics.\n"
            "Return only a JSON array. Each item must include name, specialty, address, phone, rating, notes.\n"
            "Use grounded search and do not invent data.\n"
            f"Condition: {disease}\n"
            f"Location: {location}"
        )
        response = client.models.generate_content(
            model=self.settings.grounded_model,
            contents=f"Find specialists for {disease} near {location}. Return JSON only.",
            config=self.ai_service.grounded_search_config(system_instruction),
        )

        specialists: list[dict] = []
        for item in extract_json_array(response.text or ""):
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

