"""FastAPI server for Brain Dump — WebSocket proxy between frontend and Gemini via ADK."""

import asyncio
import json
import os
from pathlib import Path

import firebase_admin
from firebase_admin import auth as firebase_auth, credentials
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.adk.runners import Runner, RunConfig
from google.adk.sessions import InMemorySessionService
from google.genai import types

from backend.agents.companion import create_companion_agent

# Load .env from project root (same VITE_GOOGLE_API_KEY used by frontend)
load_dotenv(Path(__file__).parent.parent / ".env")

# Ensure the Gemini API key is available to the ADK
api_key = os.getenv("VITE_GOOGLE_API_KEY") or os.getenv("GOOGLE_API_KEY")
if api_key:
    os.environ["GOOGLE_API_KEY"] = api_key

# Initialize Firebase Admin SDK (optional — runs without auth if not configured)
_firebase_ready = False
_service_account_path = Path(__file__).parent.parent / "service-account-key.json"
try:
    if _service_account_path.exists():
        cred = credentials.Certificate(str(_service_account_path))
        firebase_admin.initialize_app(cred)
    else:
        firebase_admin.initialize_app()
    _firebase_ready = True
    print("[firebase] Admin SDK initialized")
except Exception as e:
    print(f"[firebase] Admin SDK not available ({e}). Auth verification disabled.")

# FastAPI app
app = FastAPI(title="Brain Dump Backend")

# Allow Vite dev server to connect (localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ADK session service (in-memory for Phase 1)
session_service = InMemorySessionService()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Main WebSocket endpoint for live audio sessions.

    Protocol:
      Frontend → Backend:
        - JSON text:  {"type": "start", "fuel_level": 3, "language": "en"}
        - JSON text:  {"type": "stop"}
        - Binary:     raw 16-bit PCM audio at 16kHz (1024 bytes/chunk)

      Backend → Frontend:
        - Binary:     AI voice audio — raw 24kHz 16-bit PCM
        - JSON text:  {"type": "transcription", "role": "user"|"ai", "text": "...", "finished": bool}
        - JSON text:  {"type": "categorize", "category": "task", "text": "..."}
        - JSON text:  {"type": "stress_reset"}
        - JSON text:  {"type": "task_steps", "task": "...", "steps": [...]}
        - JSON text:  {"type": "suggestions", "fuel_level": 3, "guidance": "..."}
        - JSON text:  {"type": "turn_complete"}
        - JSON text:  {"type": "interrupted"}
        - JSON text:  {"type": "connected"}
        - JSON text:  {"type": "error", "message": "..."}
    """
    await websocket.accept()

    live_queue: LiveRequestQueue | None = None
    forward_task: asyncio.Task | None = None

    # ── after_tool_callback — intercepts tool results and forwards to frontend ──
    async def after_tool_cb(tool, args, tool_context, tool_response):
        """Called by ADK after every tool execution.

        Tool results in run_live() are consumed internally (sent back to Gemini
        as function responses) and do NOT surface as event.content.parts[].text.
        This callback is the correct interception point.
        """
        try:
            # tool_response is a dict (ADK auto-parses the JSON string our tools return)
            data = tool_response
            if isinstance(data, str):
                data = json.loads(data)
            if isinstance(data, dict) and "_tool_event" in data:
                event_type = data.pop("_tool_event")
                print(f"[after_tool] Forwarding tool event: {event_type}")
                await websocket.send_json({"type": event_type, **data})
            else:
                print(f"[after_tool] Tool '{tool.name}' returned (no _tool_event): {data}")
        except Exception as e:
            print(f"[after_tool] Error forwarding tool event: {e}")
        return None  # Don't modify the response sent to the model

    async def forward_events(
        runner: Runner,
        session_id: str,
        user_id: str,
        lq: LiveRequestQueue,
        run_config: RunConfig,
    ):
        """Stream ADK events back to the frontend via WebSocket."""
        try:
            async for event in runner.run_live(
                user_id=user_id,
                session_id=session_id,
                live_request_queue=lq,
                run_config=run_config,
            ):
                # ── AI audio chunks ──
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        # Audio data → send as binary frame
                        if part.inline_data and part.inline_data.data:
                            await websocket.send_bytes(part.inline_data.data)

                        # Text from model (unlikely in audio-only mode, but log it)
                        elif part.text:
                            print(f"[forward_events] Model text: {part.text[:200]}")

                # ── Transcriptions ──
                if event.input_transcription and event.input_transcription.text:
                    await websocket.send_json({
                        "type": "transcription",
                        "role": "user",
                        "text": event.input_transcription.text,
                        "finished": bool(getattr(event.input_transcription, "finished", False)),
                    })

                if event.output_transcription and event.output_transcription.text:
                    await websocket.send_json({
                        "type": "transcription",
                        "role": "ai",
                        "text": event.output_transcription.text,
                        "finished": bool(getattr(event.output_transcription, "finished", False)),
                    })

                # ── Turn signals ──
                if event.interrupted:
                    await websocket.send_json({"type": "interrupted"})

                if event.turn_complete:
                    await websocket.send_json({"type": "turn_complete"})

                # ── Tool events are handled by after_tool_callback above ──

        except WebSocketDisconnect:
            pass
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"[forward_events] Error: {e}")
            import traceback
            traceback.print_exc()
            try:
                await websocket.send_json({"type": "error", "message": str(e)})
            except Exception:
                pass

    try:
        while True:
            data = await websocket.receive()

            # ── Binary audio frame ──
            if "bytes" in data:
                if live_queue:
                    live_queue.send_realtime(
                        blob=types.Blob(
                            data=data["bytes"],
                            mime_type="audio/pcm;rate=16000",
                        )
                    )
                continue

            # ── JSON text message ──
            if "text" in data:
                msg = json.loads(data["text"])
                msg_type = msg.get("type")

                if msg_type == "start":
                    # Verify Firebase ID token (if Firebase is configured)
                    token = msg.get("token")
                    uid = "anonymous"
                    if token and _firebase_ready:
                        try:
                            decoded = firebase_auth.verify_id_token(token)
                            uid = decoded["uid"]
                            print(f"[websocket] Authenticated user: {uid}")
                        except Exception as e:
                            print(f"[websocket] Token verification failed: {e}")
                            await websocket.send_json({"type": "error", "message": "auth_failed"})
                            continue
                    elif not _firebase_ready:
                        print("[websocket] Firebase not configured, using anonymous")
                    else:
                        print("[websocket] No token provided, using anonymous")

                    fuel_level = msg.get("fuel_level")
                    language = msg.get("language", "en")

                    # Create a fresh agent with this session's config
                    agent = create_companion_agent(
                        fuel_level, language,
                        after_tool_callback=after_tool_cb,
                    )
                    runner = Runner(
                        agent=agent,
                        app_name="brain_dump",
                        session_service=session_service,
                    )

                    session = await session_service.create_session(
                        app_name="brain_dump",
                        user_id=uid,
                    )

                    # ADK run config — mirrors the hard-won settings from useGeminiLive.js
                    run_config = RunConfig(
                        response_modalities=["AUDIO"],
                        speech_config=types.SpeechConfig(
                            voice_config=types.VoiceConfig(
                                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                    voice_name="Kore",
                                )
                            )
                        ),
                        input_audio_transcription=types.AudioTranscriptionConfig(),
                        output_audio_transcription=types.AudioTranscriptionConfig(),
                    )

                    live_queue = LiveRequestQueue()

                    # Start forwarding events in background
                    forward_task = asyncio.create_task(
                        forward_events(runner, session.id, session.user_id, live_queue, run_config)
                    )

                    await websocket.send_json({"type": "connected"})

                elif msg_type == "stop":
                    if live_queue:
                        live_queue.close()
                        live_queue = None
                    if forward_task:
                        forward_task.cancel()
                        try:
                            await forward_task
                        except asyncio.CancelledError:
                            pass
                        forward_task = None

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[websocket] Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if live_queue:
            live_queue.close()
        if forward_task:
            forward_task.cancel()
            try:
                await forward_task
            except asyncio.CancelledError:
                pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
