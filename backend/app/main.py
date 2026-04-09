from __future__ import annotations

import io
import logging
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
    ResetSystemRequest,
    ResetSystemResponse,
    SpecialistRequest,
    SpecialistResponse,
)
from .services.advisories import AdvisoryService, SpecialistService
from .services.ai import GeminiService
from .services.autism import AutismModelError, predict_autism_from_base64
from .services.fingerprint import FingerprintError, scan_and_predict
from .services.memory import MemoryStore


logger = logging.getLogger(__name__)
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


def _stream_text_report(content: str) -> StreamingResponse:
    buffer = io.BytesIO(content.encode("utf-8"))
    return StreamingResponse(
        buffer,
        media_type="text/plain",
        headers={"Content-Disposition": "attachment; filename=medisonar_report.txt"},
    )


def _report_document(body: str) -> str:
    return (
        "=" * 60
        + "\n       MEDISONAR - HEALTH CONSULTATION REPORT\n"
        + "=" * 60
        + "\n\n"
        + body.strip()
        + "\n\n"
        + "=" * 60
        + "\n"
    )


def _build_local_report_body(request: ReportRequest, service_note: str = "") -> str:
    profile_text = ai_service.format_health_profile(request.health_profile)
    user_messages = [
        str(message.get("content", "")).strip()
        for message in request.messages
        if message.get("role") == "user" and str(message.get("content", "")).strip()
    ]
    latest_user_points = user_messages[-5:]
    latest_summary = " | ".join(latest_user_points) if latest_user_points else "No patient concerns were captured."
    specialty = ai_service.infer_specialty_from_text(" ".join(user_messages))

    sections = [
        "PATIENT SUMMARY",
        profile_text,
        "",
        "CHIEF COMPLAINTS",
        f"- {latest_summary}",
        "",
        "ASSESSMENT",
        "- This report was assembled from the saved profile and conversation history.",
        "- A clinician should review the symptoms, duration, severity, and relevant medical history directly.",
    ]
    if service_note:
        sections.append(f"- SERVICE NOTE: {service_note}")

    sections.extend(
        [
            "",
            "RECOMMENDED SPECIALISTS",
            f"- {specialty.title() if specialty else 'Primary care clinician'}",
            "",
            "SUGGESTIONS",
            "- Seek urgent medical care for severe, worsening, or emergency symptoms.",
            "- Bring this summary, medication list, allergies, and symptom timeline to the appointment.",
            "",
            "DISCLAIMER",
            "- This report is informational only and is not a diagnosis or treatment plan.",
        ]
    )
    return "\n".join(sections)


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
        contents = ai_service.build_contents_from_history(request.history, request.message)
        use_grounding = ai_service.should_ground_chat_search(request.message)
        config = (
            ai_service.grounded_search_config(system_instruction, max_output_tokens=1600)
            if use_grounding
            else ai_service.standard_config(system_instruction, max_output_tokens=1600)
        )
        response = client.models.generate_content(model=settings.chat_model, contents=contents, config=config)
        reply = ai_service.extract_text(response)
        if not reply:
            fallback_config = ai_service.standard_config(system_instruction, max_output_tokens=1600)
            fallback_response = client.models.generate_content(
                model=settings.chat_model,
                contents=contents,
                config=fallback_config,
            )
            reply = ai_service.extract_text(fallback_response)
        if not reply:
            reply = (
                "I couldn't generate a complete response just now. Please try again, or rephrase the question "
                "with the main symptom, timing, and severity."
            )
        specialist_query = ai_service.extract_specialist_query(
            client=client,
            message=request.message,
            reply=reply,
            health_context=health_context,
            history=request.history,
        )
        reply = reply.replace("[FIND_SPECIALIST]", "").strip()
        extracted_facts = memory_store.extract_and_save_facts(request.user_id, request.message, client)
        return ChatResponse(response=reply, memory_updates=extracted_facts, specialist_query=specialist_query)
    except Exception as exc:
        if ai_service.is_temporary_service_error(exc):
            return ChatResponse(
                response=ai_service.fallback_chat_response(request.message),
                memory_updates=[],
                specialist_query=ai_service.infer_specialty_from_text(request.message),
            )
        logger.exception("Chat endpoint failed.")
        raise HTTPException(status_code=500, detail="Chat service failed unexpectedly.") from exc


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
            config=ai_service.standard_config(system_instruction, max_output_tokens=1600),
        )
        reply = ai_service.extract_text(response)
        if not reply:
            reply = (
                "I couldn't read enough from that image to answer reliably. Try a clearer image or add a short text description."
            )
        specialist_query = ai_service.extract_specialist_query(
            client=client,
            message=request.message,
            reply=reply,
            health_context=health_context,
            history=request.history,
        )
        extracted_facts = memory_store.extract_and_save_facts(request.user_id, request.message, client)
        return ChatResponse(
            response=reply.replace("[FIND_SPECIALIST]", "").strip(),
            memory_updates=extracted_facts,
            specialist_query=specialist_query,
        )
    except Exception as exc:
        if ai_service.is_temporary_service_error(exc):
            return ChatResponse(
                response=ai_service.fallback_chat_response(request.message, has_files=True),
                memory_updates=[],
                specialist_query=ai_service.infer_specialty_from_text(request.message),
            )
        logger.exception("Chat with files endpoint failed.")
        raise HTTPException(status_code=500, detail="Image chat service failed unexpectedly.") from exc


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
        body = ai_service.extract_text(response) or _build_local_report_body(
            request,
            "Live AI report generation returned no content, so a structured local summary was generated instead.",
        )
        return _stream_text_report(_report_document(body))
    except Exception as exc:
        logger.warning("Falling back to local report generation: %s", exc)
        body = _build_local_report_body(request, ai_service.format_service_error("report generation", exc))
        return _stream_text_report(_report_document(body))


@app.post("/api/advisories", response_model=AdvisoriesResponse)
async def get_advisories(request: AdvisoriesRequest):
    _require_api_key()
    try:
        return advisory_service.get_advisories(request.location, request.conditions, request.force_refresh)
    except Exception as exc:
        logger.warning("Advisory lookup failed: %s", exc)
        return AdvisoriesResponse(advisories=[], error=ai_service.format_service_error("health advisory lookup", exc))


@app.post("/api/specialists", response_model=SpecialistResponse)
async def find_specialists(request: SpecialistRequest):
    _require_api_key()
    try:
        return SpecialistResponse(specialists=specialist_service.find_specialists(request.disease, request.location))
    except Exception as exc:
        logger.warning("Specialist lookup failed: %s", exc)
        return SpecialistResponse(
            specialists=[],
            error=ai_service.format_service_error("specialist lookup", exc),
        )


@app.post("/api/system/reset", response_model=ResetSystemResponse)
async def reset_system(request: ResetSystemRequest):
    try:
        cleared_any = memory_store.reset(
            clear_memory=request.clear_memory,
            clear_advisories_cache=request.clear_advisories_cache,
        )
        return ResetSystemResponse(status="ok", cleared_backend_db=cleared_any)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"System reset error: {exc}") from exc
