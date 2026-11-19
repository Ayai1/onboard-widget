import uuid
from datetime import UTC, datetime, timedelta

from .app import Settings, _connect


def seed() -> int:
    settings = Settings.from_env()
    steps = ["details", "id_capture", "selfie", "review"]
    now = datetime.now(UTC)
    records = []
    for completed_count in (4, 3, 2, 1):
        session_id = f"demo-{uuid.uuid4().hex[:12]}"
        for index, step in enumerate(steps[:completed_count]):
            records.append(
                (
                    "step_viewed",
                    session_id,
                    step,
                    (now - timedelta(minutes=index)).isoformat(),
                    "en",
                    "desktop",
                    None,
                )
            )
    with _connect(settings.database_path) as connection:
        connection.executemany(
            "INSERT INTO events (event_type, session_id, step, timestamp, locale, device_class, reason) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            records,
        )
    return len(records)


if __name__ == "__main__":
    print(f"Inserted {seed()} synthetic funnel events.")
