# MediSonar System Overview

## Purpose
MediSonar is a health-oriented assistant platform with three main capability areas:

1. A grounded medical chat assistant for symptom discussion and specialist discovery.
2. A profile-driven dashboard that surfaces location-based health advisories.
3. Experimental vision and sensor modules for autism-image classification and fingerprint-based blood-group estimation.

## High-Level Architecture

### Frontend
- React + TypeScript + Vite.
- Zustand persists chat sessions, profile data, and sidebar state in `localStorage`.
- Routes:
  - `/` dashboard
  - `/chat` consultation interface
  - `/profile` health profile and fingerprint capture
  - `/autism-screening` webcam/upload-based model inference page

### Backend
- FastAPI application split into `backend/app/`.
- `backend/app/main.py` owns the API surface.
- Services:
  - `services/ai.py` for Gemini client access and grounded generation helpers.
  - `services/advisories.py` for advisory and specialist search workflows.
  - `services/autism.py` for PyTorch inference against the provided ResNet50 checkpoint.
  - `services/fingerprint.py` for R30x/R307 serial capture and blood-group model inference.
  - `services/memory.py` for persisted chat facts and advisory caching.

### Persistence
- Runtime SQLite database stored at `backend/data/medisonar.db`.
- Stores:
  - extracted user memory facts
  - cached health advisories keyed by location and conditions

## Grounded AI Flows

### Chat
- Endpoint: `POST /api/chat`
- Sends recent history, health profile context, and remembered user facts.
- Uses Gemini with Google Search grounding enabled.
- Supports specialist handoff tags via `[FIND_SPECIALIST]`.

### File-Aware Chat
- Endpoint: `POST /api/chat/files`
- Accepts image attachments and forwards image bytes plus text prompt to Gemini.

### Specialists
- Endpoint: `POST /api/specialists`
- Uses grounded web search to return real nearby specialist options in JSON form.

### Health Advisories
- Endpoint: `POST /api/advisories`
- Uses grounded search and caches successful responses for 20 minutes.
- If a fresh grounded response fails, the backend falls back to the most recent cached result instead of returning nothing when possible.

## Experimental Modules

### Autism Vision
- Endpoint: `POST /api/autism/predict`
- Loads `Autism/best_model.pt` lazily on first use.
- Rebuilds the ResNet50 binary classifier described in the supplied notebook and runs inference on uploaded or webcam-captured frames.
- Frontend allows camera selection, which supports laptop webcams and any external camera exposed to the browser.
- This is a software demonstration only and is not a clinical diagnostic tool.

### Fingerprint Blood Group
- Endpoint: `POST /api/fingerprint/scan`
- Works with an R30x/R307-style scanner over serial.
- Captures a raw image, converts it into BMP, preprocesses it for the existing Keras model, and predicts blood group.
- Includes a local test-image path mode for development without hardware.
- This is also experimental and must not replace proper laboratory testing.

## Repo Organization

### Source
- `backend/app/` backend modules
- `backend/tests/` backend tests
- `frontend/src/` frontend application code
- `docs/` implementation notes
- `hardware/` hardware bridge sketches
- `Autism/` notebook and checkpoint supplied for the autism model

### Runtime / Generated
- `backend/.venv/`
- `frontend/node_modules/`
- `backend/data/medisonar.db`
- model/dataset artifacts outside the main source flow

## Safety Notes
- MediSonar is not a replacement for a clinician.
- The autism and fingerprint modules are experimental model integrations.
- Health advisories and specialist results are grounded, but users should still verify any critical information with official sources and medical professionals.
