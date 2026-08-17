import os
import json
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from groq import Groq

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SYSTEM_PROMPT = "You are an advanced, high-quality, and minimal AI assistant. Provide concise, accurate, and helpful answers. Format any code in markdown."

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]

def get_api_key():
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key or api_key == "your_key_here":
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not set in backend environment variables")
    return api_key

def get_chat_model():
    return ChatGroq(
        model="qwen/qwen3.6-27b", 
        api_key=get_api_key(), 
        streaming=True,
        temperature=0.6,
        max_tokens=2048,
        model_kwargs={"top_p": 0.95}
    )

@app.get("/")
@app.get("/api")
async def health_check():
    return {"status": "ok", "service": "FWS Chat API"}

@app.post("/chat")
@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    langchain_messages = [SystemMessage(content=SYSTEM_PROMPT)]
    
    for m in req.messages:
        if m.role == "user":
            langchain_messages.append(HumanMessage(content=m.content))
        elif m.role == "assistant" and m.content.strip() != "":
            langchain_messages.append(AIMessage(content=m.content))

    try:
        chat_model = get_chat_model()
    except Exception as e:
        async def error_generate():
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(error_generate(), media_type="text/event-stream")

    async def generate():
        try:
            async for chunk in chat_model.astream(langchain_messages):
                if chunk.content:
                    yield f"data: {json.dumps({'content': chunk.content})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")

@app.post("/transcribe")
@app.post("/api/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    try:
        content = await file.read()
        client = Groq(api_key=get_api_key())
        transcription = client.audio.transcriptions.create(
            file=(file.filename, content),
            model="whisper-large-v3",
            temperature=0,
            response_format="verbose_json",
        )
        return {"text": transcription.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
