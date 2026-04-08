import os
import io
import json
import base64
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
from google import genai
from google.genai import types
from fingerprint import FingerprintError, scan_and_predict
from memory import MemoryStore

# Load .env from the backend directory explicitly
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

app = FastAPI(title="MediSonar Backend API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
MODEL_ID = "gemini-2.5-flash-lite"
print(f"GEMINI_API_KEY loaded: {'YES' if GEMINI_API_KEY else 'NO'}")
if not GEMINI_API_KEY:
    print("WARNING: GEMINI_API_KEY is not set. Please add it to backend/.env")

memory_store = MemoryStore("medisonar_memory.db")

def get_client():
    return genai.Client(api_key=GEMINI_API_KEY)


class HealthProfile(BaseModel):
    name: str = ""
    age: str = ""
    gender: str = ""
    location: str = ""
    weight: str = ""
    height: str = ""
    bloodGroup: str = ""
    conditions: str = ""
    allergies: str = ""
    medications: str = ""


class ChatRequest(BaseModel):
    user_id: str
    message: str
    health_profile: Optional[HealthProfile] = None
    history: list[dict] = []


class ChatResponse(BaseModel):
    response: str
    memory_updates: list[str] = []


class ChatWithFilesRequest(BaseModel):
    user_id: str
    message: str
    health_profile: Optional[HealthProfile] = None
    files: list[dict] = []
    history: list[dict] = []


class ReportRequest(BaseModel):
    messages: list[dict]
    health_profile: Optional[HealthProfile] = None


class AdvisoriesRequest(BaseModel):
    location: str = ""
    conditions: str = ""


class AdvisoriesResponse(BaseModel):
    advisories: list[dict]


class SpecialistRequest(BaseModel):
    disease: str = ""
    location: str = ""


class SpecialistResponse(BaseModel):
    specialists: list[dict]


class FingerprintScanRequest(BaseModel):
    serial_port: str = ""
    baud_rate: int = 57600
    timeout_seconds: float = 20
    test_image_path: str = ""


class FingerprintScanResponse(BaseModel):
    blood_group: str
    confidence: float
    source: str
    serial_port: str = ""
    image_path: str = ""
    model: str = ""


def format_health_profile(profile: Optional[HealthProfile]) -> str:
    if not profile:
        return "No health profile provided."
    parts = []
    if profile.name:
        parts.append(f"Name: {profile.name}")
    if profile.age:
        parts.append(f"Age: {profile.age}")
    if profile.gender:
        parts.append(f"Gender: {profile.gender}")
    if profile.location:
        parts.append(f"Location: {profile.location}")
    if profile.weight:
        parts.append(f"Weight: {profile.weight}")
    if profile.height:
        parts.append(f"Height: {profile.height}")
    if profile.bloodGroup:
        parts.append(f"Blood group: {profile.bloodGroup}")
    if profile.conditions:
        parts.append(f"Existing conditions: {profile.conditions}")
    if profile.allergies:
        parts.append(f"Allergies: {profile.allergies}")
    if profile.medications:
        parts.append(f"Current medications: {profile.medications}")
    return "\n".join(parts) if parts else "No health profile data filled."


def build_system_instruction(health_context: str, user_context: str) -> str:
    return (
        "You are MediSonar, an AI medical assistant that helps users understand symptoms "
        "and find appropriate care.\n\n"
        "RESPONSE FORMAT:\n"
        "- Use **markdown** formatting: headings (##), bullet points, bold (**text**), etc.\n"
        "- Structure longer responses with clear sections\n"
        "- Keep responses focused and well-organized (use bullet points over long paragraphs)\n"
        "- Use a professional, warm tone — avoid being overly casual or robotic\n\n"
        "BEHAVIORAL RULES:\n"
        "- Do NOT address the user by name in every response. Only use their name occasionally, if at all.\n"
        "- Do NOT start every reply with a greeting. Jump straight into the helpful content.\n"
        "- Ask clarifying questions when symptoms are vague\n"
        "- Suggest the type of medical specialist when relevant\n"
        "- Always end with a brief reminder to consult a healthcare professional for diagnosis\n"
        "- If the user asks to connect with or find a specialist, recommend the specialist type "
        "and inform them that you're searching for specialists near their area. "
        "Include the phrase [FIND_SPECIALIST] followed by the specialist type in your response.\n\n"
        f"Patient Health Profile:\n{health_context}\n\n"
        f"Remembered Context:\n{user_context}\n\n"
        "IMPORTANT: You are not a doctor. Suggest possibilities and recommend professional consultation."
    )


def build_contents_from_history(history: list[dict], current_message: str) -> list:
    """Build a proper multi-turn conversation contents list from history."""
    contents = []
    # Include last 20 messages for context (to stay within token limits)
    recent_history = history[-20:] if len(history) > 20 else history
    for msg in recent_history:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if not content:
            continue
        # Map 'assistant' to 'model' for Gemini API
        api_role = "model" if role == "assistant" else "user"
        contents.append(types.Content(role=api_role, parts=[types.Part.from_text(text=content)]))
    
    # Add current message
    if current_message:
        contents.append(types.Content(role="user", parts=[types.Part.from_text(text=current_message)]))
    
    return contents


@app.get("/api/health")
def health_check():
    return {"status": "ok", "api_key_configured": bool(GEMINI_API_KEY)}


@app.post("/api/fingerprint/scan", response_model=FingerprintScanResponse)
async def scan_fingerprint(request: FingerprintScanRequest):
    try:
        configured_port = request.serial_port or os.environ.get("FINGERPRINT_SERIAL_PORT", "")
        result = scan_and_predict(
            serial_port=configured_port or None,
            baud_rate=request.baud_rate,
            timeout_seconds=request.timeout_seconds,
            test_image_path=Path(request.test_image_path) if request.test_image_path else None,
        )
        return FingerprintScanResponse(**result)
    except FingerprintError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fingerprint scan failed: {e}")


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="API Key not configured. Please set GEMINI_API_KEY in backend/.env")

    try:
        client = get_client()

        user_context = memory_store.get_context(request.user_id)
        health_context = format_health_profile(request.health_profile)
        system_instruction = build_system_instruction(health_context, user_context)

        contents = build_contents_from_history(request.history, request.message)

        response = client.models.generate_content(
            model=MODEL_ID,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                tools=[types.Tool(google_search=types.GoogleSearch())],
                max_output_tokens=2048,
            ),
        )
        reply = response.text or ""

        extracted_facts = memory_store.extract_and_save_facts(request.user_id, request.message, client)

        return ChatResponse(response=reply, memory_updates=extracted_facts)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/chat/files", response_model=ChatResponse)
async def chat_with_files(request: ChatWithFilesRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="API Key not configured. Please set GEMINI_API_KEY in backend/.env")

    try:
        client = get_client()

        user_context = memory_store.get_context(request.user_id)
        health_context = format_health_profile(request.health_profile)
        system_instruction = build_system_instruction(health_context, user_context)

        parts = []
        image_mime_types = {"image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"}
        for f in request.files:
            mime_type = f.get("mime_type", "application/octet-stream")
            data = base64.b64decode(f["data"])
            if mime_type not in image_mime_types:
                continue
            parts.append(types.Part.from_bytes(data=data, mime_type=mime_type))

        if request.message:
            parts.append(request.message)

        if not parts:
            return ChatResponse(
                response="I cannot read the attached file type. Please share images (PNG, JPG, WebP, GIF) or describe what you'd like me to analyze.",
                memory_updates=[],
            )

        response = client.models.generate_content(
            model=MODEL_ID,
            contents=parts,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                max_output_tokens=2048,
            ),
        )
        reply = response.text or ""

        extracted_facts = memory_store.extract_and_save_facts(request.user_id, request.message, client)

        return ChatResponse(response=reply, memory_updates=extracted_facts)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/report")
async def generate_report(request: ReportRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="API Key not configured. Please set GEMINI_API_KEY in backend/.env")

    try:
        client = get_client()

        profile_text = format_health_profile(request.health_profile)
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
            "1. PATIENT SUMMARY - Name (if provided), age, gender, location, existing conditions, allergies, medications\n"
            "2. CHIEF COMPLAINTS - What symptoms or health concerns the patient discussed (list each)\n"
            "3. ASSESSMENT - Your analysis of discussed symptoms, possible related conditions (speculative, not diagnostic), observations\n"
            "4. RECOMMENDED SPECIALISTS - Which specialist types to see and why (e.g., Cardiology for heart-related symptoms)\n"
            "5. SUGGESTIONS - Lifestyle advice, next steps, things to monitor, when to seek urgent care\n"
            "6. DISCLAIMER - This is AI-generated, not medical advice, consult a healthcare provider\n\n"
            "FORMAT: Plain text with uppercase section headers. No markdown. Professional tone. "
            "Each section should be 2-4 sentences minimum."
        )

        response = client.models.generate_content(
            model=MODEL_ID,
            contents=report_prompt,
        )
        report_content = response.text or ""

        header = (
            "=" * 60 + "\n"
            "       MEDISONAR - HEALTH CONSULTATION REPORT\n"
            "=" * 60 + "\n\n"
        )
        footer = "\n\n" + "=" * 60 + "\n"

        content = header + report_content + footer
        buffer = io.BytesIO(content.encode("utf-8"))

        return StreamingResponse(
            buffer,
            media_type="text/plain",
            headers={"Content-Disposition": "attachment; filename=medisonar_report.txt"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/advisories", response_model=AdvisoriesResponse)
async def get_advisories(request: AdvisoriesRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="API Key not configured. Please set GEMINI_API_KEY in backend/.env")

    if not request.location or len(request.location.strip()) < 2:
        return AdvisoriesResponse(advisories=[])

    try:
        client = get_client()
        
        system_instruction = (
            "You are a health advisory research assistant. Your ONLY task is to search for and return "
            "current official health advisories from government health authorities.\n\n"
            "STRICT OUTPUT REQUIREMENTS:\n"
            "- Return ONLY a valid JSON array - nothing else\n"
            "- No explanations, no introductions, no markdown formatting\n"
            "- If no real advisories found, return an empty array []\n\n"
            "JSON STRUCTURE (exactly this):\n"
            '[{"title": "Brief title", "severity": "high|medium|low|info", "description": "What the advisory is about and what action to take (50-100 words)"}]\n\n'
            "SEARCH REQUIREMENTS:\n"
            "- Use Google Search to find REAL, CURRENT advisories from official government sources\n"
            "- Focus on: disease outbreaks, air quality alerts, weather emergencies, vaccination campaigns, food safety recalls\n"
            "- Location to search: " + (request.location or "general") + "\n"
            f"- User health conditions: {request.conditions or 'None specified'}\n"
            "- Return 3-5 specific advisories with real titles and descriptions\n"
            "- Do NOT make up fake advisories - only return what you actually find"
        )
        
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=f"Search for current health advisories in {request.location} and return the JSON result.",
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                tools=[types.Tool(google_search=types.GoogleSearch())],
                max_output_tokens=1536,
            ),
        )
        raw = (response.text or "").strip()

        if raw.startswith("```"):
            lines = raw.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            raw = "\n".join(lines).strip()

        data = json.loads(raw)
        if isinstance(data, list) and len(data) > 0:
            return AdvisoriesResponse(advisories=data)
        return AdvisoriesResponse(advisories=[])
    except Exception as e:
        print(f"Advisories error: {e}")
        return AdvisoriesResponse(advisories=[])


@app.post("/api/specialists", response_model=SpecialistResponse)
async def find_specialists(request: SpecialistRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="API Key not configured. Please set GEMINI_API_KEY in backend/.env")

    if not request.disease or not request.location:
        return SpecialistResponse(specialists=[])

    try:
        client = get_client()

        system_instruction = (
            "You are a medical specialist finder. Your task is to search for real doctors, clinics, "
            "and hospitals that specialize in treating the specified condition near the given location.\n\n"
            "STRICT OUTPUT REQUIREMENTS:\n"
            "- Return ONLY a valid JSON array - nothing else\n"
            "- No explanations, no introductions, no markdown formatting\n"
            "- If no results found, return an empty array []\n\n"
            "JSON STRUCTURE (exactly this):\n"
            '[{"name": "Doctor/Clinic Name", "specialty": "Specialization", '
            '"address": "Full address", "phone": "Phone number if available", '
            '"rating": "Rating if available", "notes": "Brief note about the practice"}]\n\n'
            "SEARCH REQUIREMENTS:\n"
            "- Use Google Search to find REAL doctors and clinics\n"
            f"- Condition/Disease: {request.disease}\n"
            f"- Location: {request.location}\n"
            "- Return 3-5 actual specialists with real details\n"
            "- Include hospitals, private practices, and clinics\n"
            "- Do NOT make up fake information"
        )

        response = client.models.generate_content(
            model=MODEL_ID,
            contents=f"Search for {request.disease} specialists and doctors near {request.location}. Return the JSON result.",
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                tools=[types.Tool(google_search=types.GoogleSearch())],
                max_output_tokens=1536,
            ),
        )
        raw = (response.text or "").strip()

        if raw.startswith("```"):
            lines = raw.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            raw = "\n".join(lines).strip()

        data = json.loads(raw)
        if isinstance(data, list) and len(data) > 0:
            return SpecialistResponse(specialists=data)
        return SpecialistResponse(specialists=[])
    except Exception as e:
        print(f"Specialists error: {e}")
        return SpecialistResponse(specialists=[])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
