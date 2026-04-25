"""Tests for iteration 2 new features: social auth + lead verification."""
import os
import uuid
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://ai-outreach-17.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

EXISTING_EMAIL = "test@leadforge.io"
EXISTING_PW = "test1234"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def headers(session):
    # Try login with existing test user; if missing, register fresh
    r = session.post(f"{API}/auth/login", json={"email": EXISTING_EMAIL, "password": EXISTING_PW})
    if r.status_code != 200:
        email = f"TEST_{uuid.uuid4().hex[:8]}@leadforge.io"
        rr = session.post(f"{API}/auth/register", json={"email": email, "password": "test1234", "name": "TEST"})
        assert rr.status_code == 200, rr.text
        token = rr.json()["token"]
    else:
        token = r.json()["token"]
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ============== Social Auth ==============
class TestSocialAuth:
    def test_google_session_invalid_id_returns_401(self, session):
        r = session.post(f"{API}/auth/google-session", json={"session_id": "definitely_invalid_xyz"})
        # backend either returns 401 (Emergent says invalid) or 502 (network down)
        assert r.status_code in (401, 502), f"got {r.status_code} {r.text}"

    def test_google_session_missing_session_id(self, session):
        r = session.post(f"{API}/auth/google-session", json={})
        assert r.status_code == 422  # pydantic validation

    def test_apple_invalid_token_returns_401(self, session):
        r = session.post(f"{API}/auth/apple", json={"identity_token": "not.a.real.jwt"})
        assert r.status_code == 401, f"got {r.status_code} {r.text}"

    def test_apple_missing_token(self, session):
        r = session.post(f"{API}/auth/apple", json={})
        assert r.status_code == 422


# ============== Lead Verification ==============
class TestLeadVerification:
    @pytest.fixture(scope="class")
    def lead_id(self, session, headers):
        # Get a lead from feed (10 fresh leads should already exist)
        r = session.get(f"{API}/leads/feed", headers=headers)
        assert r.status_code == 200
        leads = r.json().get("leads", [])
        if not leads:
            # fetch some
            r2 = session.post(f"{API}/leads/fetch", headers=headers,
                              json={"subreddits": ["forhire"], "keywords": ["hire", "need"], "hours": 72})
            leads = r2.json().get("leads", [])
        assert leads, "no leads available"
        return leads[0]["id"]

    def test_fetch_returns_spam_fields(self, session, headers, lead_id):
        r = session.get(f"{API}/leads/{lead_id}", headers=headers)
        assert r.status_code == 200
        body = r.json()
        # New schema fields
        assert "spam_score" in body
        assert "spam_flags" in body
        assert "verified_by" in body
        assert isinstance(body["spam_flags"], list)
        assert isinstance(body["verified_by"], list)
        assert 0 <= body["spam_score"] <= 100
        assert "i_verified" in body
        assert "verified_count" in body
        assert isinstance(body["i_verified"], bool)
        assert isinstance(body["verified_count"], int)

    def test_run_verification_demo_mode(self, session, headers, lead_id):
        r = session.post(f"{API}/leads/{lead_id}/verify", headers=headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["poster_profile"] is not None
        assert "karma" in body["poster_profile"]
        assert "age_days" in body["poster_profile"]
        assert body["poster_trust"] is not None
        assert body["poster_trust"]["label"] in ("Trusted", "Caution", "Risky")
        assert 0 <= body["poster_trust"]["score"] <= 100
        assert body["freshness"] is not None
        assert "alive" in body["freshness"]
        assert body["freshness"]["alive"] is True  # demo mode short-circuits to True

    def test_mark_verified_toggle(self, session, headers, lead_id):
        # Get current state
        r0 = session.get(f"{API}/leads/{lead_id}", headers=headers)
        initial_count = r0.json().get("verified_count", 0)
        initially_verified = r0.json().get("i_verified", False)

        # First call: toggle
        r1 = session.post(f"{API}/leads/{lead_id}/mark-verified", headers=headers)
        assert r1.status_code == 200
        b1 = r1.json()
        assert "action" in b1 and "verified_count" in b1 and "i_verified" in b1
        if initially_verified:
            assert b1["action"] == "unmarked"
            assert b1["i_verified"] is False
            assert b1["verified_count"] == initial_count - 1
        else:
            assert b1["action"] == "marked"
            assert b1["i_verified"] is True
            assert b1["verified_count"] == initial_count + 1

        # Second call: opposite toggle
        r2 = session.post(f"{API}/leads/{lead_id}/mark-verified", headers=headers)
        assert r2.status_code == 200
        b2 = r2.json()
        assert b2["i_verified"] != b1["i_verified"]
        assert b2["verified_count"] == initial_count

    def test_verify_endpoints_require_auth(self, session, lead_id):
        r1 = session.post(f"{API}/leads/{lead_id}/verify")
        assert r1.status_code in (401, 403)
        r2 = session.post(f"{API}/leads/{lead_id}/mark-verified")
        assert r2.status_code in (401, 403)

    def test_verify_404_for_missing_lead(self, session, headers):
        r1 = session.post(f"{API}/leads/nonexistent_xyz/verify", headers=headers)
        assert r1.status_code == 404
        r2 = session.post(f"{API}/leads/nonexistent_xyz/mark-verified", headers=headers)
        assert r2.status_code == 404
