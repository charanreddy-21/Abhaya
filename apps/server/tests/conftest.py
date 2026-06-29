import os
import asyncio
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

TEST_DB = Path("abhaya_pytest.db")
TEST_UPLOADS = Path("uploads_pytest")

for suffix in ("", "-shm", "-wal"):
    path = Path(f"{TEST_DB}{suffix}")
    if path.exists():
        path.unlink()
if TEST_UPLOADS.exists():
    for child in TEST_UPLOADS.iterdir():
        if child.is_file():
            child.unlink()
    TEST_UPLOADS.rmdir()

os.environ["ABHAYA_DATABASE_URL"] = f"sqlite+aiosqlite:///./{TEST_DB}"
os.environ["ABHAYA_EVIDENCE_UPLOAD_DIR"] = str(TEST_UPLOADS)
os.environ["ABHAYA_CORS_ORIGINS"] = "http://localhost:3000"

from apps.server.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def cleanup_test_artifacts():
    yield
    from apps.server.app.core.database import engine

    asyncio.run(engine.dispose())
    for suffix in ("", "-shm", "-wal"):
        path = Path(f"{TEST_DB}{suffix}")
        if path.exists():
            path.unlink()
    if TEST_UPLOADS.exists():
        for child in TEST_UPLOADS.iterdir():
            if child.is_file():
                child.unlink()
        TEST_UPLOADS.rmdir()


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


def register_user(client: TestClient, email: str, password: str = "Strong1234") -> dict:
    response = client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "display_name": "Test User"},
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture()
def auth_headers(client):
    user = register_user(client, "user@example.com")
    token = user["token"]["access_token"]
    return {"Authorization": f"Bearer {token}"}
