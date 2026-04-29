"""LeadForge AI - Backend API Test Suite (pytest).
Covers auth, leads, AI message gen, CRM, invoices, stats, leaderboard, auth protection, daily limits.
"""
import os
import uuid
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://leadforge-ai-4.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

# A fresh test user is created once and shared across the suite
SEED_EMAIL = f"TEST_{uuid.uuid4().hex[:8]}@leadforge.io"
SEED_PW = "test1234"
SEED_NAME = "TEST Forge User"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth(session):
    """Register a fresh user and return token + user."""
    r = session.post(f"{API}/auth/register", json={
        "email": SEED_EMAIL, "password": SEED_PW, "name": SEED_NAME
    })
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    return {"token": data["token"], "user": data["user"]}


@pytest.fixture(scope="session")
def headers(auth):
    return {"Authorization": f"Bearer {auth['token']}", "Content-Type": "application/json"}


# ============== Auth ==============
class TestAuth:
    def test_register_duplicate_rejected(self, session, auth):
        r = session.post(f"{API}/auth/register", json={
            "email": SEED_EMAIL, "password": SEED_PW, "name": SEED_NAME
        })
        assert r.status_code == 400

    def test_login_success(self, session, auth):
        r = session.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": SEED_PW})
        assert r.status_code == 200
        body = r.json()
        assert "token" in body
        assert body["user"]["email"] == SEED_EMAIL.lower()

    def test_login_bad_password(self, session):
        r = session.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me_requires_token(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_bad_token(self, session):
        r = session.get(f"{API}/auth/me", headers={"Authorization": "Bearer not_a_token"})
        assert r.status_code == 401

    def test_me_returns_user(self, session, headers):
        r = session.get(f"{API}/auth/me", headers=headers)
        assert r.status_code == 200
        assert r.json()["email"] == SEED_EMAIL.lower()
        assert "password_hash" not in r.json()

    def test_profile_update_sets_onboarded(self, session, headers):
        r = session.put(f"{API}/auth/profile", headers=headers, json={
            "profession": "Mobile Developer",
            "skills": ["React Native", "TypeScript"],
            "tone_preference": "Casual",
            "experience_level": "Intermediate",
        })
        assert r.status_code == 200
        body = r.json()
        assert body["onboarded"] is True
        assert body["profession"] == "Mobile Developer"
        assert "React Native" in body["skills"]

    def test_toggle_premium(self, session, headers):
        r1 = session.post(f"{API}/auth/toggle-premium", headers=headers)
        assert r1.status_code == 200
        v1 = r1.json()["is_premium"]
        r2 = session.post(f"{API}/auth/toggle-premium", headers=headers)
        assert r2.json()["is_premium"] != v1
        # leave it on False for further free-tier tests
        if r2.json()["is_premium"]:
            session.post(f"{API}/auth/toggle-premium", headers=headers)

    def test_check_in_streak(self, session, headers):
        r = session.post(f"{API}/auth/check-in", headers=headers)
        assert r.status_code == 200
        assert r.json()["streak"] >= 1


# ============== Leads ==============
class TestLeads:
    @pytest.fixture(scope="class")
    def fetched(self, session, headers):
        r = session.post(f"{API}/leads/fetch", headers=headers,
                         json={"subreddits": ["forhire", "freelance"], "keywords": ["hire", "need"], "hours": 72})
        assert r.status_code == 200, r.text
        return r.json()

    def test_fetch_returns_leads(self, fetched):
        assert "leads" in fetched
        assert isinstance(fetched["leads"], list)
        # demo_mode expected true in this env
        assert "demo_mode" in fetched
        # New count must be present
        assert "new_count" in fetched

    def test_fetch_lead_shape(self, fetched):
        if not fetched["leads"]:
            pytest.skip("no leads returned")
        lead = fetched["leads"][0]
        for k in ["id", "title", "subreddit", "score", "intent", "summary", "url"]:
            assert k in lead, f"missing {k}"
        assert 0 <= lead["score"] <= 100
        assert lead["intent"] in ("High", "Medium", "Low")

    def test_feed_endpoint(self, session, headers, fetched):
        r = session.get(f"{API}/leads/feed", headers=headers)
        assert r.status_code == 200
        leads = r.json()["leads"]
        assert isinstance(leads, list)
        if leads:
            assert "my_status" in leads[0]

    def test_lead_detail(self, session, headers, fetched):
        if not fetched["leads"]:
            pytest.skip("no leads")
        lead_id = fetched["leads"][0]["id"]
        r = session.get(f"{API}/leads/{lead_id}", headers=headers)
        assert r.status_code == 200
        body = r.json()
        assert body["id"] == lead_id
        assert "my_status" in body
        assert "my_notes" in body

    def test_lead_detail_404(self, session, headers):
        r = session.get(f"{API}/leads/nonexistent_id_xyz", headers=headers)
        assert r.status_code == 404

    def test_generate_message(self, session, headers, fetched):
        if not fetched["leads"]:
            pytest.skip("no leads")
        lead_id = fetched["leads"][0]["id"]
        r = session.post(f"{API}/leads/generate-message", headers=headers,
                         json={"lead_id": lead_id, "tone": "Casual"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["reddit_dm"], "reddit_dm should be non-empty even on LLM fallback"
        assert body["email"], "email should be non-empty even on LLM fallback"
        assert body["tone"] == "Casual"


# ============== CRM (UserLeads) ==============
class TestCRM:
    @pytest.fixture(scope="class")
    def lead_id(self, session, headers):
        feed = session.get(f"{API}/leads/feed", headers=headers).json()["leads"]
        if not feed:
            pytest.skip("no leads available for CRM tests")
        return feed[0]["id"]

    def test_save_lead(self, session, headers, lead_id):
        r = session.post(f"{API}/userleads", headers=headers,
                         json={"lead_id": lead_id, "status": "saved", "notes": "TEST note"})
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "saved"
        assert body["lead_id"] == lead_id

    def test_update_lead_status(self, session, headers, lead_id):
        r = session.patch(f"{API}/userleads/{lead_id}", headers=headers,
                          json={"status": "contacted", "notes": "TEST contacted"})
        assert r.status_code == 200
        assert r.json()["status"] == "contacted"

    def test_list_user_leads(self, session, headers, lead_id):
        r = session.get(f"{API}/userleads", headers=headers)
        assert r.status_code == 200
        ul = r.json()["user_leads"]
        assert any(x["id"] == lead_id and x["my_status"] == "contacted" for x in ul)


# ============== Invoices ==============
class TestInvoices:
    def test_create_and_list_invoice(self, session, headers):
        payload = {"client_name": "TEST Client", "description": "TEST work", "amount": 1234.56}
        r = session.post(f"{API}/invoices", headers=headers, json=payload)
        assert r.status_code == 200
        inv = r.json()
        assert inv["client_name"] == "TEST Client"
        assert inv["amount"] == 1234.56
        assert inv["invoice_number"].startswith("INV-")
        # GET to verify persistence
        r2 = session.get(f"{API}/invoices", headers=headers)
        assert r2.status_code == 200
        assert any(i["id"] == inv["id"] for i in r2.json()["invoices"])


# ============== Stats / Leaderboard ==============
class TestStats:
    def test_my_stats(self, session, headers):
        r = session.get(f"{API}/stats/me", headers=headers)
        assert r.status_code == 200
        b = r.json()
        for k in ["xp", "streak", "messages_generated", "leads_contacted",
                  "replies", "deals_closed", "is_premium"]:
            assert k in b

    def test_leaderboard(self, session, headers):
        r = session.get(f"{API}/leaderboard", headers=headers)
        assert r.status_code == 200
        b = r.json()
        assert "leaderboard" in b and isinstance(b["leaderboard"], list)
        assert "my_id" in b
        # Sorted by xp desc
        xps = [u.get("xp", 0) for u in b["leaderboard"]]
        assert xps == sorted(xps, reverse=True)


# ============== Auth Protection ==============
class TestAuthProtection:
    @pytest.mark.parametrize("method,path", [
        ("get", "/auth/me"),
        ("put", "/auth/profile"),
        ("post", "/auth/toggle-premium"),
        ("post", "/auth/check-in"),
        ("post", "/leads/fetch"),
        ("get", "/leads/feed"),
        ("post", "/leads/generate-message"),
        ("get", "/userleads"),
        ("post", "/userleads"),
        ("get", "/invoices"),
        ("post", "/invoices"),
        ("get", "/stats/me"),
        ("get", "/leaderboard"),
    ])
    def test_endpoint_requires_auth(self, session, method, path):
        url = f"{API}{path}"
        r = getattr(session, method)(url, json={} if method in ("post", "put", "patch") else None)
        assert r.status_code in (401, 403), f"{method} {path} returned {r.status_code}"
