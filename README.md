# MediSonar

MediSonar is a React + FastAPI health assistant that combines grounded medical chat, profile-aware health advisories, specialist lookup, fingerprint-based blood-group estimation, and an experimental autism-image classification workflow.

## What’s Included

- Grounded AI consultation chat using Gemini with Google Search grounding.
- Dashboard with 20-minute cached, location-based health advisories.
- Specialist discovery from grounded search results.
- Health profile management with local persistence.
- Experimental fingerprint blood-group scan support for R30x/R307-style sensors.
- Experimental autism classification page using the provided `Autism/best_model.pt` checkpoint with webcam or uploaded-image input.

## Project Structure

```text
MediSonar/
├── Autism/                         # provided notebook + PyTorch checkpoint
├── backend/
│   ├── app/                        # FastAPI app modules
│   ├── data/                       # runtime SQLite DB
│   ├── tests/                      # backend tests
│   └── requirements.txt
├── docs/
│   ├── autism-vision.md
│   └── fingerprint-scanner.md
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── tests/
│   └── package.json
├── hardware/
└── system.md
```

## Requirements

### Backend
- Python 3.11+ recommended
- Gemini API key in `backend/.env`
- Optional hardware:
  - R30x/R307-compatible fingerprint sensor
  - Arduino bridge if used in your current hardware path

### Frontend
- Node.js 18+ recommended

## Environment Setup

Create `backend/.env`:

```env
GEMINI_API_KEY=your_api_key_here
FINGERPRINT_SERIAL_PORT=COM3
```

`FINGERPRINT_SERIAL_PORT` is optional if auto-detection works.

## Installation

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Frontend

```powershell
cd frontend
npm install
```

## Running The App

### Backend

```powershell
cd backend
.\.venv\Scripts\uvicorn.exe main:app --reload --port 8000
```

### Frontend

```powershell
cd frontend
npm run dev
```

Open the Vite URL in your browser, typically `http://localhost:5173`.

## Core Routes

### Frontend
- `/` dashboard
- `/chat` consultation chat
- `/profile` patient profile + fingerprint scan trigger
- `/autism-screening` webcam/upload inference page

### Backend
- `GET /api/health`
- `POST /api/chat`
- `POST /api/chat/files`
- `POST /api/report`
- `POST /api/advisories`
- `POST /api/specialists`
- `POST /api/fingerprint/scan`
- `POST /api/autism/predict`

## Health Advisory Caching

- Advisories are cached server-side for 20 minutes per `location + conditions` pair.
- A cached result is returned immediately while still allowing manual refresh from the dashboard.
- If grounded search fails after a successful earlier fetch, the backend falls back to the cached advisory payload instead of leaving the UI empty.

## Autism Vision Workflow

The app uses the supplied ResNet50 checkpoint from the `Autism/` folder and exposes it through `POST /api/autism/predict`.

On the frontend:
- Use your laptop webcam.
- Or select any browser-visible external camera.
- Or upload an image manually.

Important:
- This is an experimental model integration.
- Autism cannot be clinically diagnosed from a single image.
- The page explicitly treats the output as research/demo inference only.

More detail: [docs/autism-vision.md](/Users/yvcha/Desktop/MediSonar/docs/autism-vision.md)

## Fingerprint Workflow

The fingerprint feature captures an image from an R30x/R307-style sensor, converts the raw frame to BMP, and runs the existing Keras blood-group model already present in the repo.

Important:
- This is an experimental estimate.
- Do not use it in place of proper blood typing.

More detail: [docs/fingerprint-scanner.md](/Users/yvcha/Desktop/MediSonar/docs/fingerprint-scanner.md)

## Testing

### Backend

```powershell
cd backend
.\.venv\Scripts\pytest.exe
```

### Frontend

```powershell
cd frontend
npm run build
npx vitest run
```

## Notes On Cleanup

- The source code is now organized under dedicated backend service modules and frontend page/component folders.
- Unused Vite starter assets were removed.
- Runtime DB data lives under `backend/data/` instead of mixing with source files.

## Safety

- MediSonar can be helpful, but it is not a doctor.
- Grounded search improves freshness, not certainty.
- The autism and fingerprint modules are experimental software features and should never be treated as medical diagnosis tools.
