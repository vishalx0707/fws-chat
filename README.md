# FWS Chat

A full-stack AI chatbot built with React and FastAPI, powered by Groq's LLM and Whisper APIs.

## Tech Stack

**Frontend:** React, Vite, Lucide Icons, React Markdown, React Syntax Highlighter

**Backend:** Python, FastAPI, LangChain, Groq SDK

**AI Models:** Qwen 27B (chat), Whisper Large V3 (speech-to-text)

## Features

- Streaming responses — tokens arrive in real time
- Conversation memory — the AI remembers context within a session
- Multi-chat sessions — create and switch between multiple chats
- Voice dictation — record and transcribe via Whisper (`Ctrl+Shift+D`)
- Markdown rendering with syntax-highlighted code blocks
- Edit sent prompts, regenerate responses, copy text
- Collapsible sidebar with chat history
- Custom system prompt
- Clean, minimal dark UI

## Project Structure

```
fsw-chatbot/
├── backend/
│   ├── main.py            # FastAPI server (chat + transcribe endpoints)
│   └── .env               # GROQ_API_KEY goes here
├── fws-chat/
│   └── src/
│       ├── App.jsx         # Main app component
│       └── index.css       # Styling
├── requirements.txt        # Python dependencies
└── README.md
```

## Setup

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Mac/Linux
pip install -r ../requirements.txt
```

Create a `.env` file inside `backend/`:

```
GROQ_API_KEY=your_groq_api_key
```

Start the server:

```bash
python main.py
```

Runs on `http://localhost:8001`

### 2. Frontend

```bash
cd fws-chat
npm install
npm run dev
```

Runs on `http://localhost:5173`

## Usage

1. Start the backend first, then the frontend.
2. Open `http://localhost:5173` in your browser.
3. Type a message or press `Ctrl+Shift+D` to dictate.
