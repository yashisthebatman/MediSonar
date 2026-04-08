from __future__ import annotations

import io
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .config import load_settings
from .schemas import (
    AdvisoriesRequest,
    AdvisoriesResponse,
    AutismPredictionRequest,
    AutismPredictionResponse,
    ChatRequest,
    ChatResponse,
    ChatWithFilesRequest,
    FingerprintScanRequest,
    FingerprintScanResponse,
    ReportRequest,
    SpecialistRequest,
    SpecialistResponse,
)
from .services.advisories import AdvisoryService, SpecialistService
from .services.ai import GeminiService
from .services.autism import AutismModelError, predict_autism_from_base64
from .services.fingerprint import FingerprintError, scan_and_predict
from .services.memory import MemoryStore


settings = load_settings()
app = FastAPI(title="MediSonar Backend API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

memory_store = MemoryStore(str(settings.db_path))
ai_service = GeminiService(settings)
advisory_service = AdvisoryService(settings, ai_service, memory_store)
specialist_service = SpecialistService(settings, ai_service)


def _require_api_key() -> None:
    if not ai_service.is_configured():
        raise HTTPException(status_code=503, detail="API Key not configured. Please set GEMINI_API_KEY in backend/.env")


@app.get("/api/health")
def health_check():
    return {"status": "ok", "api_key_configured": ai_service.is_configured()}


@app.post("/api/fingerprint/scan", response_model=FingerprintScanResponse)
async def scan_fingerprint(request: FingerprintScanRequest):
    try:
        configured_port = request.serial_port or settings.fingerprint_serial_port
        result = scan_and_predict(
            serial_port=configured_port or None,
            baud_rate=request.baud_rate,
            timeout_seconds=request.timeout_seconds,
            test_image_path=Path(request.test_image_path) if request.test_image_path else None,
        )
        return FingerprintScanResponse(**result)
    except FingerprintError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Fingerprint scan failed: {exc}") from exc


@app.post("/api/autism/predict", response_model=AutismPredictionResponse)
async def predict_autism(request: AutismPredictionRequest):
    try:
        result = predict_autism_from_base64(request.image_base64)
        return AutismPredictionResponse(**result, source=request.source, camera_name=request.camera_name)
    except AutismModelError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Autism prediction failed: {exc}") from exc


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    _require_api_key()
    try:
        client = ai_service.get_client()
        user_context = memory_store.get_context(request.user_id)
        health_context = ai_service.format_health_profile(request.health_profile)
        system_instruction = ai_service.build_chat_system_instruction(health_context, user_context)
        response = client.models.generate_content(
            model=settings.chat_model,
            contents=ai_service.build_contents_from_history(request.history, request.message),
            config=ai_service.grounded_search_config(system_instruction, max_output_tokens=2048),
        )
        extracted_facts = memory_store.extract_and_save_facts(request.user_id, request.message, client)
        return ChatResponse(response=response.text or "", memory_updates=extracted_facts)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/chat/files", response_model=ChatResponse)
async def chat_with_files(request: ChatWithFilesRequest):
    _require_api_key()
    try:
        client = ai_service.get_client()
        user_context = memory_store.get_context(request.user_id)
        health_context = ai_service.format_health_profile(request.health_profile)
        system_instruction = ai_service.build_chat_system_instruction(health_context, user_context)
        parts = ai_service.build_image_parts(request.files, request.message)
        if not parts:
            return ChatResponse(
                response="I cannot read the attached file type. Please share images (PNG, JPG, WebP, GIF) or describe what you'd like me to analyze.",
                memory_updates=[],
            )

        response = client.models.generate_content(
            model=settings.chat_model,
            contents=parts,
            config=ai_service.grounded_search_config(system_instruction, max_output_tokens=2048),
        )
        extracted_facts = memory_store.extract_and_save_facts(request.user_id, request.message, client)
        return ChatResponse(response=response.text or "", memory_updates=extracted_facts)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/report")
async def generate_report(request: ReportRequest):
    _require_api_key()
    try:
        client = ai_service.get_client()
        profile_text = ai_service.format_health_profile(request.health_profile)
        conversation_text = "\n".join(
            f"{'Patient' if m.get('role') == 'user' else 'MediSonar'}: {m.get('content', '')}"
            for m in request.messages
        )
        report_prompt = (
            "You are MediSonar, a medical AI assistant. Generate a professional health consultation report "
            "based on the patient's information and conversation history.\n\n"
            f"Patient Health Profile:\n{profile_text}\n\n"
            f"Conversation History:\n{conversation_text}\n\n"
            "WRITE THIS REPORT:\n"
            "1. PATIENT SUMMARY\n"
            "2. CHIEF COMPLAINTS\n"
            "3. ASSESSMENT\n"
            "4. RECOMMENDED SPECIALISTS\n"
            "5. SUGGESTIONS\n"
            "6. DISCLAIMER\n\n"
            "FORMAT: Plain text with uppercase section headers. No markdown. Professional tone."
        )
        response = client.models.generate_content(model=settings.chat_model, contents=report_prompt)
        content = (
            "=" * 60
            + "\n       MEDISONAR - HEALTH CONSULTATION REPORT\n"
            + "=" * 60
            + "\n\n"
            + (response.text or "")
            + "\n\n"
            + "=" * 60
            + "\n"
        )
        buffer = io.BytesIO(content.encode("utf-8"))
        return StreamingResponse(
            buffer,
            media_type="text/plain",
            headers={"Content-Disposition": "attachment; filename=medisonar_report.txt"},
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/advisories", response_model=AdvisoriesResponse)
async def get_advisories(request: AdvisoriesRequest):
    _require_api_key()
    try:
        return advisory_service.get_advisories(request.location, request.conditions, request.force_refresh)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Advisories error: {exc}") from exc


@app.post("/api/specialists", response_model=SpecialistResponse)
async def find_specialists(request: SpecialistRequest):
    _require_api_key()
    try:
        return SpecialistResponse(specialists=specialist_service.find_specialists(request.disease, request.location))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Specialists error: {exc}") from exc
