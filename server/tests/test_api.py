from __future__ import annotations

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from server.app import Settings, create_app


@pytest.fixture
def test_client(tmp_path):
    settings = Settings(
        database_path=tmp_path / "test.sqlite",
        uploads_dir=tmp_path / "uploads",
        max_upload_bytes=16,
        max_request_bytes=4096,
        upload_rate_limit=20,
        submit_rate_limit=20,
        rate_limit_window_seconds=60,
        cors_origins=("http://testserver",),
    )
    with TestClient(create_app(settings)) as client:
        yield client, settings


def create_session(client: TestClient) -> str:
    response = client.post("/sessions")
    assert response.status_code == 200
    return response.json()["sessionId"]


def upload(
    client: TestClient, session_id: str, kind: str, content: bytes, content_type: str = "image/jpeg"
):
    return client.post(
        f"/sessions/{session_id}/documents",
        data={"kind": kind},
        files={"file": ("synthetic.jpg", content, content_type)},
    )


def valid_details():
    return {
        "fullName": "Sample Person",
        "dateOfBirth": "1990-01-02",
        "country": "IN",
        "email": "sample@example.test",
    }


def test_health_and_session_creation(test_client):
    client, _ = test_client
    assert client.get("/health").json() == {"status": "ok"}
    session_id = create_session(client)
    assert len(session_id) == 32


def test_upload_rejects_wrong_content_type(test_client):
    client, _ = test_client
    session_id = create_session(client)
    response = upload(client, session_id, "id_front", b"text", "text/plain")
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "unsupported_media_type"


def test_upload_rejects_files_over_configured_limit(test_client):
    client, _ = test_client
    session_id = create_session(client)
    response = upload(client, session_id, "id_front", b"\xff\xd8\xff" + b"x" * 14)
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "file_too_large"


def test_upload_rejects_bad_magic_bytes(test_client):
    client, _ = test_client
    session_id = create_session(client)
    response = upload(client, session_id, "selfie", b"not-a-jpeg")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_image"


def test_submit_requires_both_images(test_client):
    client, _ = test_client
    session_id = create_session(client)
    response = client.post(f"/sessions/{session_id}/submit", json=valid_details())
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "documents_required"


def test_funnel_aggregates_distinct_sessions_and_dropoff(test_client):
    client, _ = test_client
    now = datetime.now(UTC).isoformat()
    events = []
    for session_id, viewed in (("sample-a", ["details", "id_capture"]), ("sample-b", ["details"])):
        events.extend(
            {
                "type": "step_viewed",
                "sessionId": session_id,
                "step": step,
                "timestamp": now,
                "locale": "en",
                "deviceClass": "desktop",
            }
            for step in viewed
        )
    response = client.post("/events", json={"events": events})
    assert response.status_code == 202
    funnel = client.get("/funnel").json()["steps"]
    assert funnel[0] == {"step": "details", "count": 2, "dropOffPercent": 50.0}
    assert funnel[1]["count"] == 1


def test_upload_rate_limit_is_per_ip_and_route(tmp_path):
    settings = Settings(
        database_path=tmp_path / "rate.sqlite",
        uploads_dir=tmp_path / "rate-uploads",
        max_upload_bytes=16,
        max_request_bytes=4096,
        upload_rate_limit=1,
        submit_rate_limit=1,
        rate_limit_window_seconds=60,
        cors_origins=("http://testserver",),
    )
    with TestClient(create_app(settings)) as client:
        session_id = create_session(client)
        first = upload(client, session_id, "id_front", b"\xff\xd8\xffdemo")
        second = upload(client, session_id, "selfie", b"\xff\xd8\xffdemo")
        assert first.status_code == 200
        assert second.status_code == 429
        assert second.json()["error"]["code"] == "rate_limited"


def test_submit_rate_limit_is_per_ip_and_route(tmp_path):
    settings = Settings(
        database_path=tmp_path / "submit-rate.sqlite",
        uploads_dir=tmp_path / "submit-rate-uploads",
        upload_rate_limit=20,
        submit_rate_limit=1,
        rate_limit_window_seconds=60,
        cors_origins=("http://testserver",),
    )
    with TestClient(create_app(settings)) as client:
        session_id = create_session(client)
        first = client.post(f"/sessions/{session_id}/submit", json=valid_details())
        second = client.post(f"/sessions/{session_id}/submit", json=valid_details())
        assert first.status_code == 422
        assert second.status_code == 429
