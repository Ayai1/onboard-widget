from __future__ import annotations

import json
import os
import re
import secrets
import sqlite3
import time
import uuid
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Annotated, Protocol

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator
from starlette.exceptions import HTTPException as StarletteHTTPException


class ImageCheck(Protocol):
    def analyze(self, image_bytes: bytes) -> str: ...


class NoOpImageCheck:
    def analyze(self, image_bytes: bytes) -> str:
        return "not_run"


@dataclass(frozen=True)
class Settings:
    database_path: Path
    uploads_dir: Path
    max_upload_bytes: int = 5 * 1024 * 1024
    max_request_bytes: int = 6 * 1024 * 1024
    upload_rate_limit: int = 12
    submit_rate_limit: int = 8
    rate_limit_window_seconds: int = 60
    cors_origins: tuple[str, ...] = ("http://localhost:4173", "http://127.0.0.1:4173")

    @classmethod
    def from_env(cls) -> Settings:
        root = Path(__file__).resolve().parent
        max_upload = int(os.getenv("MAX_UPLOAD_BYTES", str(5 * 1024 * 1024)))
        cors = tuple(origin.strip() for origin in os.getenv(
            "CORS_ORIGINS", "http://localhost:4173,http://127.0.0.1:4173"
        ).split(",") if origin.strip())
        return cls(
            database_path=Path(os.getenv("ONBOARD_DATABASE", str(root / "onboard.db"))),
            uploads_dir=Path(os.getenv("UPLOADS_DIR", str(root / "uploads"))),
            max_upload_bytes=max_upload,
            max_request_bytes=int(os.getenv("MAX_REQUEST_BYTES", str(max_upload + 1024 * 1024))),
            upload_rate_limit=int(os.getenv("UPLOAD_RATE_LIMIT", "12")),
            submit_rate_limit=int(os.getenv("SUBMIT_RATE_LIMIT", "8")),
            rate_limit_window_seconds=int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60")),
            cors_origins=cors,
        )


class SubmissionDetails(BaseModel):
    model_config = ConfigDict(alias_generator=lambda name: re.sub(r"_([a-z])", lambda match: match[1].upper(), name), populate_by_name=True, extra="forbid")

    full_name: str = Field(min_length=2, max_length=120)
    date_of_birth: date
    country: str = Field(pattern=r"^[A-Z]{2}$")
    email: str = Field(min_length=3, max_length=254)

    @field_validator("full_name")
    @classmethod
    def clean_full_name(cls, value: str) -> str:
        value = " ".join(value.split())
        if len(value) < 2:
            raise ValueError("Enter a full name with at least two characters.")
        return value

    @field_validator("date_of_birth")
    @classmethod
    def date_is_not_in_future(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("Date of birth cannot be in the future.")
        return value

    @field_validator("email")
    @classmethod
    def valid_email(cls, value: str) -> str:
        value = value.strip()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Enter a valid email address.")
        return value


class AnalyticsEvent(BaseModel):
    model_config = ConfigDict(alias_generator=lambda name: re.sub(r"_([a-z])", lambda match: match[1].upper(), name), populate_by_name=True, extra="ignore")

    type: str = Field(min_length=1, max_length=48)
    session_id: str = Field(min_length=1, max_length=80)
    step: str = Field(min_length=1, max_length=32)
    timestamp: datetime
    locale: str = Field(pattern=r"^(en|ar)$")
    device_class: str = Field(pattern=r"^(ios|android|desktop)$")
    reason: str | None = Field(default=None, max_length=80)


class EventBatch(BaseModel):
    events: list[AnalyticsEvent] = Field(max_length=100)


class RateLimiter:
    def __init__(self, window_seconds: int) -> None:
        self.window_seconds = window_seconds
        self.hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)

    def allow(self, ip: str, route: str, limit: int) -> bool:
        now = time.monotonic()
        key = (ip, route)
        hits = self.hits[key]
        while hits and now - hits[0] >= self.window_seconds:
            hits.popleft()
        if len(hits) >= limit:
            return False
        hits.append(now)
        return True


def _connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def _initialize_database(path: Path) -> None:
    with _connect(path) as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                submitted_at TEXT,
                reference TEXT UNIQUE,
                image_check_results TEXT
            );
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                kind TEXT NOT NULL CHECK(kind IN ('id_front', 'selfie')),
                path TEXT NOT NULL,
                content_type TEXT NOT NULL,
                byte_size INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(session_id, kind)
            );
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                session_id TEXT NOT NULL,
                step TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                locale TEXT NOT NULL,
                device_class TEXT NOT NULL,
                reason TEXT
            );
            CREATE INDEX IF NOT EXISTS events_step_type ON events(step, event_type);
            CREATE INDEX IF NOT EXISTS events_session ON events(session_id);
            """
        )


def _problem(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status, detail={"code": code, "message": message})


def _now() -> str:
    return datetime.now(UTC).isoformat()


def create_app(settings: Settings | None = None, image_check: ImageCheck | None = None) -> FastAPI:
    config = settings or Settings.from_env()
    config.uploads_dir.mkdir(parents=True, exist_ok=True)
    _initialize_database(config.database_path)
    app = FastAPI(title="Onboard Widget API", version="0.1.0")
    app.state.settings = config
    app.state.image_check = image_check or NoOpImageCheck()
    app.state.rate_limiter = RateLimiter(config.rate_limit_window_seconds)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(config.cors_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "X-Public-Key"],
    )

    @app.middleware("http")
    async def enforce_request_size(request: Request, call_next):
        length = request.headers.get("content-length")
        if length and length.isdecimal() and int(length) > config.max_request_bytes:
            return JSONResponse(
                status_code=413,
                content={"error": {"code": "request_too_large", "message": "Request body exceeds the configured size limit."}},
            )
        return await call_next(request)

    @app.exception_handler(StarletteHTTPException)
    async def structured_http_error(_: Request, exc: StarletteHTTPException):
        detail = exc.detail
        if isinstance(detail, dict):
            error = {"code": str(detail.get("code", "request_error")), "message": str(detail.get("message", "Request failed."))}
        else:
            error = {"code": "request_error", "message": str(detail)}
        return JSONResponse(status_code=exc.status_code, content={"error": error}, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def structured_validation_error(_: Request, exc: RequestValidationError):
        details = [{"field": ".".join(str(part) for part in error["loc"]), "message": error["msg"]} for error in exc.errors()]
        return JSONResponse(status_code=422, content={"error": {"code": "validation_error", "message": "Request validation failed.", "details": details}})

    def check_rate(request: Request, route: str, limit: int) -> None:
        ip = request.client.host if request.client else "unknown"
        if not app.state.rate_limiter.allow(ip, route, limit):
            raise _problem(429, "rate_limited", "Too many requests. Try again later.")

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    @app.post("/sessions")
    async def create_session():
        session_id = uuid.uuid4().hex
        with _connect(config.database_path) as connection:
            connection.execute("INSERT INTO sessions (id, created_at) VALUES (?, ?)", (session_id, _now()))
        return {"sessionId": session_id}

    @app.post("/sessions/{session_id}/documents")
    async def upload_document(
        session_id: str,
        request: Request,
        kind: Annotated[str, Form()],
        file: Annotated[UploadFile, File()],
    ):
        check_rate(request, "upload", config.upload_rate_limit)
        if kind not in {"id_front", "selfie"}:
            raise _problem(422, "invalid_document_kind", "kind must be id_front or selfie.")
        with _connect(config.database_path) as connection:
            if connection.execute("SELECT 1 FROM sessions WHERE id = ?", (session_id,)).fetchone() is None:
                raise _problem(404, "session_not_found", "Session was not found.")
        data = await file.read(config.max_upload_bytes + 1)
        if len(data) > config.max_upload_bytes:
            raise _problem(413, "file_too_large", "The uploaded file exceeds the configured size limit.")
        content_type = (file.content_type or "").lower().split(";", maxsplit=1)[0]
        signatures = {
            "image/jpeg": (b"\xff\xd8\xff", ".jpg"),
            "image/png": (b"\x89PNG\r\n\x1a\n", ".png"),
        }
        signature = signatures.get(content_type)
        if signature is None:
            raise _problem(415, "unsupported_media_type", "Only JPEG and PNG images are accepted.")
        magic, extension = signature
        if not data.startswith(magic):
            raise _problem(400, "invalid_image", "The file signature does not match its JPEG or PNG content type.")
        document_id = uuid.uuid4().hex
        target = config.uploads_dir / f"{session_id}_{kind}_{document_id}{extension}"
        target.write_bytes(data)
        with _connect(config.database_path) as connection:
            existing = connection.execute("SELECT path FROM documents WHERE session_id = ? AND kind = ?", (session_id, kind)).fetchone()
            connection.execute(
                "INSERT INTO documents (id, session_id, kind, path, content_type, byte_size, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(session_id, kind) DO UPDATE SET "
                "id=excluded.id, path=excluded.path, content_type=excluded.content_type, "
                "byte_size=excluded.byte_size, created_at=excluded.created_at",
                (document_id, session_id, kind, str(target), content_type, len(data), _now()),
            )
        if existing:
            Path(existing["path"]).unlink(missing_ok=True)
        return {"documentId": document_id, "kind": kind, "byteSize": len(data)}

    @app.post("/sessions/{session_id}/submit")
    async def submit_session(session_id: str, details: SubmissionDetails, request: Request):
        check_rate(request, "submit", config.submit_rate_limit)
        with _connect(config.database_path) as connection:
            session = connection.execute("SELECT id, reference FROM sessions WHERE id = ?", (session_id,)).fetchone()
            if session is None:
                raise _problem(404, "session_not_found", "Session was not found.")
            documents = connection.execute("SELECT kind, path FROM documents WHERE session_id = ?", (session_id,)).fetchall()
            kinds = {row["kind"] for row in documents}
            absent = {"id_front", "selfie"} - kinds
            if absent:
                names = ", ".join(sorted(absent))
                raise _problem(422, "documents_required", f"Upload both required documents before submitting. Missing: {names}.")
            results = {
                row["kind"]: app.state.image_check.analyze(Path(row["path"]).read_bytes())
                for row in documents
            }
            reference = session["reference"] or f"ONB-{secrets.token_hex(6).upper()}"
            connection.execute(
                "UPDATE sessions SET submitted_at = ?, reference = ?, image_check_results = ? WHERE id = ?",
                (_now(), reference, json.dumps(results), session_id),
            )
        return {"reference": reference}

    @app.post("/events", status_code=202)
    async def receive_events(batch: EventBatch):
        if len(batch.events) > 100:
            raise _problem(422, "event_batch_too_large", "A batch may contain at most 100 events.")
        with _connect(config.database_path) as connection:
            connection.executemany(
                "INSERT INTO events (event_type, session_id, step, timestamp, locale, device_class, reason) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                [
                    (event.type, event.session_id, event.step, event.timestamp.isoformat(), event.locale, event.device_class, event.reason)
                    for event in batch.events
                ],
            )
        return {"accepted": len(batch.events)}

    @app.get("/funnel")
    async def get_funnel():
        order = ["details", "id_capture", "selfie", "review"]
        with _connect(config.database_path) as connection:
            counts = {
                row["step"]: row["count"]
                for row in connection.execute(
                    "SELECT step, COUNT(DISTINCT session_id) AS count FROM events "
                    "WHERE event_type = 'step_viewed' GROUP BY step"
                )
            }
        steps = []
        for index, step in enumerate(order):
            current = int(counts.get(step, 0))
            next_count = int(counts.get(order[index + 1], 0)) if index + 1 < len(order) else current
            drop_off = round(max(0, (current - next_count) / current * 100), 1) if current else 0.0
            steps.append({"step": step, "count": current, "dropOffPercent": drop_off})
        return {"steps": steps}

    return app


app = create_app()
