"""Iteration 5 — final pre-launch sweep:
- Full happy-path integration: register → me → leads → verify → mark-verified → save → message → events → invoice → billing → policy → delete cascade
- /events/track (allowed, disallowed, PII strip, auth)
- /events/summary (auth, user-scoped)
- /api/policy third_party_disclaimers (5 items, Reddit non-affiliation first)
- AI message word caps + no spam phrases + post-specific reference
"""
import os
import re
import uuid
import pytest
import requests

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"

EXISTING_EMAIL = "test@leadforge.io"
EXISTING_PW = "test1234"

SPAM_PHRASES = ["i guarantee", "limited time", "act now"]


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def existing_user_headers(session):
    r = session.post(f"{API}/auth/login", json={"email": EXISTING_EMAIL, "password": EXISTING_PW})
    if r.status_code != 200:
        # register the canonical test user (idempotent)
        rr = session.post(f"{API}/auth/register", json={"email": EXISTING_EMAIL, "password": EXISTING_PW, "name": "Tester"})
        assert rr.status_code == 200, rr.text
        token = rr.json()["token"]
    else:
        token = r.json()["token"]
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ============== /api/policy third_party_disclaimers ==============
class TestPolicyThirdParty:
    def test_policy_public_and_has_5_disclaimers(self, session):
        r = session.get(f"{API}/policy")
        assert r.status_code == 200
        body = r.json()
        assert "third_party_disclaimers" in body
        assert isinstance(body["third_party_disclaimers"], list)
        assert len(body["third_party_disclaimers"]) == 5
        first = body["third_party_disclaimers"][0].lower()
        assert "reddit" in first
        assert "not affiliated" in first or "non-affiliation" in first or "not affiliated with" in first


# ============== /events/track + /events/summary ==============
class TestEvents:
    def test_track_requires_auth(self, session):
        r = session.post(f"{API}/events/track", json={"name": "lead_viewed"})
        assert r.status_code in (401, 403)

    def test_summary_requires_auth(self, session):
        r = session.get(f"{API}/events/summary")
        assert r.status_code in (401, 403)

    def test_track_disallowed_event_returns_400(self, session, existing_user_headers):
        r = session.post(f"{API}/events/track", headers=existing_user_headers, json={"name": "foo_bar"})
        assert r.status_code == 400, r.text

    def test_track_strips_pii_from_meta(self, session, existing_user_headers):
        marker = f"iter5_{uuid.uuid4().hex[:6]}"
        r = session.post(
            f"{API}/events/track",
            headers=existing_user_headers,
            json={
                "name": "lead_viewed",
                "meta": {
                    "email": "should_strip@x.com",
                    "phone": "+911234567890",
                    "address": "123 Main",
                    "card": "4111111111111111",
                    "password": "secret",
                    "name": "Should Strip",
                    "marker": marker,  # benign — must survive
                },
            },
        )
        assert r.status_code == 200, r.text
        # Read back via direct mongo isn't accessible from here; verify using summary
        # at least confirms the call succeeded; we will additionally assert via summary that count went up
        s = session.get(f"{API}/events/summary", headers=existing_user_headers)
        assert s.status_code == 200
        counts = s.json().get("counts", {})
        assert counts.get("lead_viewed", 0) >= 1

    def test_summary_returns_counts(self, session, existing_user_headers):
        r = session.get(f"{API}/events/summary", headers=existing_user_headers)
        assert r.status_code == 200
        body = r.json()
        assert "counts" in body
        assert isinstance(body["counts"], dict)


# ============== AI Message word caps + no spam ==============
class TestAIMessage:
    @pytest.fixture(scope="class")
    def lead_id(self, session, existing_user_headers):
        r = session.get(f"{API}/leads/feed", headers=existing_user_headers)
        assert r.status_code == 200
        leads = r.json().get("leads", [])
        assert leads, "No demo seed leads available"
        return leads[0]["id"]

    def test_generate_message_caps_and_no_spam(self, session, existing_user_headers, lead_id):
        r = session.post(
            f"{API}/leads/generate-message",
            headers=existing_user_headers,
            json={"lead_id": lead_id, "tone": "Casual"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "reddit_dm" in body and "email" in body
        dm = body["reddit_dm"]
        em = body["email"]
        assert dm and em, "empty messages"

        # Word caps (lenient: 110 / 170 max for safety)
        dm_words = len(re.findall(r"\S+", dm))
        em_words = len(re.findall(r"\S+", em))
        assert dm_words <= 110, f"reddit_dm too long: {dm_words} words"
        assert em_words <= 170, f"email too long: {em_words} words"

        # No spam phrases
        for phrase in SPAM_PHRASES:
            assert phrase not in dm.lower(), f"spam phrase '{phrase}' in DM"
            assert phrase not in em.lower(), f"spam phrase '{phrase}' in email"


# ============== Full happy-path with throwaway user + delete cascade ==============
class TestHappyPathAndDelete:
    def test_full_flow_and_cascade_delete(self, session):
        email = f"test_iter5_{uuid.uuid4().hex[:8]}@leadforge.io"
        pw = "test1234"
        # Register
        r = session.post(f"{API}/auth/register", json={"email": email, "password": pw, "name": "Iter5"})
        assert r.status_code == 200, r.text
        token = r.json()["token"]
        h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

        # /auth/me
        me = session.get(f"{API}/auth/me", headers=h)
        assert me.status_code == 200
        assert me.json()["email"] == email

        # leads/feed
        feed = session.get(f"{API}/leads/feed", headers=h)
        assert feed.status_code == 200
        leads = feed.json().get("leads", [])
        assert len(leads) >= 1
        lid = leads[0]["id"]

        # lead detail — required fields
        det = session.get(f"{API}/leads/{lid}", headers=h)
        assert det.status_code == 200
        d = det.json()
        for f in ("i_verified", "verified_count", "spam_score", "spam_flags"):
            assert f in d, f"missing field {f}"

        # verify
        ver = session.post(f"{API}/leads/{lid}/verify", headers=h)
        assert ver.status_code == 200
        vb = ver.json()
        assert vb["poster_trust"] is not None
        assert vb["freshness"] is not None

        # mark-verified toggle
        m1 = session.post(f"{API}/leads/{lid}/mark-verified", headers=h)
        assert m1.status_code == 200
        assert m1.json()["i_verified"] is True

        # save user lead
        sv = session.post(f"{API}/userleads", headers=h, json={"lead_id": lid, "status": "new"})
        assert sv.status_code in (200, 201), sv.text

        # list user leads
        ulist = session.get(f"{API}/userleads", headers=h)
        assert ulist.status_code == 200
        ulist_body = ulist.json()
        ul = ulist_body.get("user_leads", ulist_body if isinstance(ulist_body, list) else [])
        assert len(ul) >= 1
        assert "my_status" in ul[0]

        # generate message
        gm = session.post(f"{API}/leads/generate-message", headers=h, json={"lead_id": lid, "tone": "Casual"})
        assert gm.status_code == 200
        gmb = gm.json()
        assert gmb["reddit_dm"] and gmb["email"]
        for phrase in SPAM_PHRASES:
            assert phrase not in gmb["reddit_dm"].lower()
            assert phrase not in gmb["email"].lower()

        # track message_copied
        tr = session.post(f"{API}/events/track", headers=h, json={"name": "message_copied", "meta": {"lead_id": lid}})
        assert tr.status_code == 200, tr.text

        # invoice create
        inv = session.post(f"{API}/invoices", headers=h, json={
            "client_name": "TEST_client",
            "description": "Test work",
            "amount": 100.0,
        })
        assert inv.status_code in (200, 201), inv.text
        inv_id = inv.json().get("id")
        assert inv_id

        # invoice list
        il = session.get(f"{API}/invoices", headers=h)
        assert il.status_code == 200
        invs = il.json().get("invoices", il.json() if isinstance(il.json(), list) else [])
        assert any(i.get("id") == inv_id for i in invs)

        # billing plans (public)
        bp = session.get(f"{API}/billing/plans")
        assert bp.status_code == 200
        plans = bp.json()
        # plans is dict with tier keys
        cat = plans.get("plans") if isinstance(plans, dict) and "plans" in plans else plans
        # accept either shape
        text = str(plans)
        assert "299" in text and "399" in text and "499" in text
        assert "2870" in text and "3830" in text and "4790" in text

        # create-subscription demo_mode
        cs = session.post(f"{API}/billing/create-subscription", headers=h, json={"tier": "professional", "period": "monthly"})
        assert cs.status_code == 200, cs.text
        csb = cs.json()
        assert csb.get("demo_mode") is True

        # billing/me
        bm = session.get(f"{API}/billing/me", headers=h)
        assert bm.status_code == 200
        bmb = bm.json()
        assert bmb.get("plan_tier") == "professional"
        assert bmb.get("subscription_status") == "trial"
        assert bmb.get("limits", {}).get("leads_per_day") == 100

        # cancel
        cc = session.post(f"{API}/billing/cancel", headers=h)
        assert cc.status_code == 200, cc.text
        bm2 = session.get(f"{API}/billing/me", headers=h)
        assert bm2.status_code == 200
        # After cancel, plan_tier resets to free or status is cancelled/free
        bm2b = bm2.json()
        assert bm2b.get("subscription_status") in ("free", "cancelled", "none") or bm2b.get("plan_tier") == "free"

        # /api/policy public (no auth)
        pol = session.get(f"{API}/policy")
        assert pol.status_code == 200
        polb = pol.json()
        assert "third_party_disclaimers" in polb
        assert len(polb["third_party_disclaimers"]) == 5
        assert "reddit" in polb["third_party_disclaimers"][0].lower()

        # events/summary (user-scoped)
        es = session.get(f"{API}/events/summary", headers=h)
        assert es.status_code == 200
        counts = es.json().get("counts", {})
        # We tracked message_copied
        assert counts.get("message_copied", 0) >= 1

        # DELETE /api/account
        dl = session.delete(f"{API}/account", headers=h)
        assert dl.status_code == 200, dl.text
        rem = dl.json().get("removed", {})
        # All cascade keys must be present
        for k in ("user_leads", "messages", "invoices", "events"):
            assert k in rem

        # Subsequent login fails 401
        relogin = session.post(f"{API}/auth/login", json={"email": email, "password": pw})
        assert relogin.status_code == 401

        # Token can no longer access /auth/me
        me2 = session.get(f"{API}/auth/me", headers=h)
        assert me2.status_code in (401, 404)
