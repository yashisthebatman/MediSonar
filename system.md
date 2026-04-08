# MediSonar System Architecture and Overview

## Overview
MediSonar is an AI-powered medical assistance chatbot designed to understand and address users regarding their symptoms or general health concerns. It features a conversational memory model that allows it to personalize responses by remembering key user details as the interaction advances.

The application emphasizes a premium user experience with a "ChatGPT-like" interface, deploying smooth micro-animations, a responsive aesthetic layout, and high-performance feedback loops.

## Architecture Design

### 1. Frontend (Client-side)
* **Stack:** React mapped with TypeScript.
* **Routing:** React Router DOM for navigation between Dashboard, Profile, and Chat pages.
* **Build System:** Vite for fast, unbundled development serving and optimized builds.
* **State Management:** Zustand with `persist` middleware for lightweight, scalable state handling. All data (chat sessions, health profiles, sidebar state) is persisted to `localStorage` so nothing is lost on page refresh.
* **UI/UX:** Black and white theme with Framer Motion micro-animations. Features a collapsible sidebar with chat history, user profile display, and health profile management.
* **Markdown Rendering:** AI responses are rendered as rich markdown using `react-markdown` with `remark-gfm`, supporting headings, lists, bold text, code blocks, tables, and links.
* **Testing:** Handled synchronously with Vitest and the React Testing Library.

### 2. Backend (Server-side)
* **Stack:** Python built on FastAPI, chosen for its speed, stability, and clean routing structure.
* **Virtual Environment:** Uses a standard local `.venv` mapping to isolate dependencies such as `google-genai` and `uvicorn`.
* **Environment Variables:** API keys are stored in a `.env` file (via `python-dotenv`), never hardcoded.
* **AI Provider:** The Google Gemini 2.5 Flash Lite API operates the reasoning logic with Google Search grounding enabled, allowing the AI to access real-time information for up-to-date medical guidance and live health advisories.
* **Conversation History:** Full multi-turn conversation history (up to 20 recent messages) is sent with each request so the AI maintains proper conversational context.
* **Memory Management:** An internal extraction logic interprets incoming prompts, persisting personal details locally so the AI can reference them naturally during future contexts.
* **Specialist Finder:** A dedicated `/api/specialists` endpoint uses Google Search grounding to find real doctors, clinics, and hospitals near the user's location for a specified condition.
* **Testing:** Pytest guarantees reliability and endpoint stability handling incoming requests.

---

## Pages

### Dashboard (`/`)
The landing page features a comprehensive health dashboard with three main sections:
* **User Profile Tile** - Displays the user's name, age, gender, location, health conditions, and allergies as tags. Clicking navigates to the Profile page for editing. Shows stats (total chats, profile status).
* **Chat Tile** - A clickable card that navigates to the AI chat interface. Highlights features like AI-powered symptom analysis, personalized responses, and specialist recommendations.
* **Health Advisories Panel** - Uses Google Search grounding to fetch the latest official health advisories, alerts, and public health notices issued by government health authorities in the user's region. Includes current disease outbreaks, vaccination campaigns, air quality alerts, and weather-related health warnings. Each advisory has a severity level (high, medium, low, info) with color-coded indicators.

### Profile Page (`/profile`)
A dedicated page for managing the user's health profile:
* Large avatar display with user initial
* Quick stats (chats, profile status, location)
* Full form with fields for: Full Name, Age, Gender, Location, Weight, Height, Blood Group, Existing Conditions, Known Allergies, Current Medications
* Save button with animated confirmation
* All data is persisted to localStorage and only used to personalize the MediSonar experience

### Chat Interface (`/chat`)
The AI-powered consultation page with:
* Collapsible sidebar showing chat history, profile page link, and user name with location.
* Real-time AI responses with typing indicators.
* Rich markdown rendering of AI responses (headings, lists, bold, code blocks, tables).
* File attachment button (paperclip) for uploading images (PNG, JPG, WebP, GIF).
* Attachment preview with remove capability before sending.
* Specialist recommendations integrated naturally into AI responses.
* When user asks to "find a specialist" or "connect to a doctor", the system automatically searches for real specialists near the user's location and displays them as styled cards in the chat.
* Download Report button for AI-generated consultation reports.

---

## Features

### Data Persistence
All user data is persisted across sessions using Zustand's `persist` middleware with `localStorage`:
* Chat sessions and message history
* Active session selection
* Health profile data
* Sidebar open/close state

Refreshing the page or closing the browser retains all data.

### Health Profile
Users can fill in a comprehensive health form on the dedicated Profile page:
* Name, Age, Gender
* Location (used for localized specialist recommendations and real-time health advisories)
* Weight, Height, Blood Group
* Existing medical conditions
* Known allergies
* Current medications

The profile is editable at any time and is sent with every chat request so the AI can personalize its guidance.

### File Upload (Images)
Users can attach images to their chat messages via the paperclip button in the input area:
* Supports images: PNG, JPG, JPEG, WebP, GIF
* Multiple files can be attached simultaneously
* Attached files are displayed as preview chips before sending
* Files are sent as base64-encoded data to the Gemini API for visual analysis
* Users can remove attachments before sending
* Non-image files (PDFs, etc.) are gracefully rejected with a helpful message

### Conversation History
The frontend sends the last 20 messages of the current chat session with each request. This gives the AI full multi-turn conversational context, allowing it to:
* Reference earlier messages in the conversation
* Ask follow-up questions naturally
* Track the evolution of a patient's symptoms across the conversation

### Google Search Grounding
The Gemini 2.5 Flash Lite model is configured with Google Search grounding, enabling the AI to:
* Access real-time information about diseases, outbreaks, and medical news
* Provide up-to-date health recommendations
* Search for the latest medical guidelines and research
* Fetch current government-issued health advisories for the user's location
* Find real specialist doctors and clinics near the user's location

### Chat Sessions
* Multiple chat sessions with auto-generated titles from the first user message.
* All sessions persist across page refreshes via localStorage.
* Collapsible sidebar showing all previous chats with the user's name and location displayed at the bottom.
* Ability to create new chats and delete existing ones.

### Specialist Finder
When a user asks to find or connect with a specialist during chat:
1. The AI recommends the appropriate specialist type and includes a `[FIND_SPECIALIST]` tag in its response
2. The frontend detects this tag and automatically calls the `/api/specialists` endpoint
3. The endpoint uses Google Search grounding to find real doctors, clinics, and hospitals near the user's location
4. Results are displayed as styled specialist cards in the chat with name, specialty, address, phone, and rating

### Markdown Formatted Responses
AI responses are rendered using `react-markdown` with `remark-gfm` support for:
* Headings (H1, H2, H3)
* Bold and italic text
* Bullet and numbered lists
* Code blocks and inline code
* Tables
* Links and blockquotes

### Health Advisories
The dashboard automatically displays real-time, location-based health advisories generated by the AI using Google Search. These include:
* Current government-issued health alerts and public health notices
* Active disease outbreaks in the user's region
* Air quality and weather-related health warnings
* Vaccination campaigns and seasonal health reminders
* Condition-specific alerts based on the user's health profile

Each advisory is color-coded by severity (high, medium, low, info).

### AI-Generated Report Download
A "Download Report" button in the chat header generates a comprehensive, AI-written health consultation report. The AI analyzes the full conversation and produces a structured report containing:
* Patient summary based on health profile
* Chief complaints extracted from the conversation
* Assessment of symptoms discussed
* Recommended specialists with reasons
* General health suggestions
* Medical disclaimer

The report is downloaded as a text file for sharing with healthcare providers.

---

## AI Response Style
The AI system prompt is configured to:
* Use **markdown formatting** for clear, structured responses
* **NOT** address the user by name in every response (only occasionally, if at all)
* Jump straight into helpful content without generic greetings
* Ask clarifying questions when symptoms are vague
* Suggest appropriate specialist types when relevant
* Include a brief disclaimer about consulting healthcare professionals

---

## Setup

### Environment Variables
Create a `.env` file in the `backend/` directory with your Gemini API key:

```
GEMINI_API_KEY=your_api_key_here
```

Never commit the `.env` file to version control.

### Running the Application

**Backend:**
```bash
cd backend
.venv\Scripts\Activate.ps1  # Windows
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm run dev
```

---

> **Important Disclaimer:** MediSonar is an AI tool intended for informational usage only. It should not be used as a substitute for professional medical advice, diagnosis, or treatment — always seek the advice of a qualified healthcare provider.
