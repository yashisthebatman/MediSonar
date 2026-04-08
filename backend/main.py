from app.main import app, ai_service, memory_store, scan_and_predict, settings

GEMINI_API_KEY = settings.gemini_api_key


def get_client():
    return ai_service.get_client()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
