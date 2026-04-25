"""Iteration 4 tests — Compliance & Safety Layer.

Covers:
- GET /api/policy (public, full POLICY_DOC schema)
- DELETE /api/account (auth-gated, hard delete cascade)
- AI generate-message has no spam/guarantee phrases
- AI lead scoring still emits spam_score + spam_flags
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://ai-outreach-17.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# ----- Module-level fixtures -----

@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def main_user_token(session):
    """Login the existing main test user."""
    r = session.post(f"{API}/auth/login", json={"email": "test@leadforge.io", "password": "test1234"})
    if r.status_code != 200:
        pytest.skip(f"Main test user login failed: {r.status_code} {r.text}")
    return r.json()["token"]


def _register_throwaway(session):
    email = f"TEST_compliance_{uuid.uuid4().hex[:8]}@leadforge.io"
    pwd = "throwAway123!"
    r = session.post(f"{API}/auth/register", json={"email": email, "password": pwd, "name": "TEST Compliance"})
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    body = r.json()
    return email, pwd, body["token"], body["user"]["id"]


# ===== /api/policy =====

class TestPolicyEndpoint:
    """GET /api/policy — public, full document schema."""

    def test_policy_is_public_no_auth(self, session):
        r = session.get(f"{API}/policy")
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"

    def test_policy_full_schema(self, session):
        r = session.get(f"{API}/policy")
        doc = r.json()
        required_keys = [
            "version", "disclaimer", "principles", "data_collected",
            "data_not_collected", "how_reddit_works", "how_ai_works",
            "user_rights", "rate_limits", "terms_summary", "support_email",
        ]
        for k in required_keys:
            assert k in doc, f"missing key: {k}"
        assert isinstance(doc["principles"], list) and len(doc["principles"]) >= 3
        assert isinstance(doc["data_collected"], list) and len(doc["data_collected"]) >= 1
        assert isinstance(doc["data_not_collected"], list) and len(doc["data_not_collected"]) >= 1
        assert isinstance(doc["user_rights"], list) and len(doc["user_rights"]) >= 1
        assert isinstance(doc["rate_limits"], dict)
        for tier in ["free", "minimum", "professional", "expert"]:
            assert tier in doc["rate_limits"], f"missing rate_limit tier: {tier}"
        assert "@" in doc["support_email"]

    def test_first_principle_exact(self, session):
        r = session.get(f"{API}/policy")
        principles = r.json()["principles"]
        assert principles[0] == "User must always initiate outreach manually.", \
            f"expected exact first principle, got: {principles[0]!r}"


# ===== DELETE /api/account =====

class TestDeleteAccount:
    """DELETE /api/account — auth required + hard delete cascade."""

    def test_delete_requires_auth(self, session):
        r = session.delete(f"{API}/account")
        assert r.status_code in (401, 403), f"expected 401/403 without token, got {r.status_code}"

    def test_delete_with_invalid_token(self, session):
        r = session.delete(f"{API}/account", headers={"Authorization": "Bearer invalid.bad.token"})
        assert r.status_code == 401, f"expected 401 for bad token, got {r.status_code}"

    def test_full_delete_cascade(self, session):
        """Register throwaway -> save lead + create invoice + verify lead -> delete -> assert cleanup."""
        email, pwd, token, user_id = _register_throwaway(session)
        auth = {"Authorization": f"Bearer {token}"}

        # Fetch a lead so we can save+verify it
        leads_r = session.get(f"{API}/leads/feed", headers=auth)
        assert leads_r.status_code == 200
        leads = leads_r.json().get("leads") or []
        lead_id = leads[0]["id"] if leads else None

        if lead_id:
            # save (creates user_lead)
            save_r = session.post(f"{API}/userleads", headers=auth,
                                  json={"lead_id": lead_id, "status": "saved", "notes": "TEST"})
            assert save_r.status_code == 200, save_r.text
            # mark-verified (puts user_id in lead.verified_by)
            v_r = session.post(f"{API}/leads/{lead_id}/mark-verified", headers=auth)
            assert v_r.status_code == 200
            assert v_r.json().get("i_verified") is True

        # Create an invoice
        inv_r = session.post(f"{API}/invoices", headers=auth, json={
            "client_name": "TEST Client", "description": "TEST line item",
            "amount": 100, "currency": "USD", "status": "draft"
        })
        assert inv_r.status_code == 200, inv_r.text

        # Sanity: /auth/me works pre-delete
        me_r = session.get(f"{API}/auth/me", headers=auth)
        assert me_r.status_code == 200

        # DELETE the account
        del_r = session.delete(f"{API}/account", headers=auth)
        assert del_r.status_code == 200, f"delete failed: {del_r.status_code} {del_r.text}"
        body = del_r.json()
        assert body.get("deleted") is True
        removed = body.get("removed", {})
        assert "user_leads" in removed and "messages" in removed and "invoices" in removed
        if lead_id:
            assert removed["user_leads"] >= 1
        assert removed["invoices"] >= 1

        # Subsequent login with same creds returns 401
        login_r = session.post(f"{API}/auth/login", json={"email": email, "password": pwd})
        assert login_r.status_code == 401, f"expected 401 after delete, got {login_r.status_code}"
        assert "invalid" in login_r.json().get("detail", "").lower()

        # Old token must no longer work
        me2_r = session.get(f"{API}/auth/me", headers=auth)
        assert me2_r.status_code == 401

        # Lead's verified_by no longer contains user_id
        if lead_id:
            # use main user token to fetch lead detail
            main_login = session.post(f"{API}/auth/login",
                                      json={"email": "test@leadforge.io", "password": "test1234"})
            if main_login.status_code == 200:
                main_token = main_login.json()["token"]
                ld_r = session.get(f"{API}/leads/{lead_id}",
                                   headers={"Authorization": f"Bearer {main_token}"})
                if ld_r.status_code == 200:
                    verified_by = ld_r.json().get("verified_by") or []
                    assert user_id not in verified_by, \
                        "deleted user still present in lead.verified_by"


# ===== AI: generate-message anti-spam =====

SPAM_PHRASES = ["i guarantee", "limited time", "act now", "100% guaranteed",
                "guaranteed results", "money-back guarantee"]


class TestAIComplianceMessages:
    """AI prompts must avoid guarantees/urgency/spam tactics."""

    def test_generate_message_no_spam_phrases(self, session, main_user_token):
        auth = {"Authorization": f"Bearer {main_user_token}"}
        leads_r = session.get(f"{API}/leads/feed", headers=auth)
        if leads_r.status_code != 200 or not leads_r.json().get("leads"):
            pytest.skip("No leads available to test AI message generation")
        lead_id = leads_r.json()["leads"][0]["id"]

        r = session.post(f"{API}/leads/generate-message", headers=auth,
                         json={"lead_id": lead_id, "tone": "Casual"}, timeout=60)
        if r.status_code == 429:
            pytest.skip("Daily message cap hit on main test user")
        assert r.status_code == 200, f"generate-message failed: {r.status_code} {r.text}"
        data = r.json()
        assert "reddit_dm" in data and "email" in data
        reddit = (data.get("reddit_dm") or "").strip()
        email = (data.get("email") or "").strip()
        assert len(reddit) > 0, "reddit_dm empty"
        assert len(email) > 0, "email empty"

        combined = f"{reddit}\n{email}".lower()
        offenders = [p for p in SPAM_PHRASES if p in combined]
        assert not offenders, f"AI output contains forbidden spam phrases: {offenders}\n---\n{combined[:500]}"

    def test_lead_scoring_emits_spam_fields(self, session, main_user_token):
        """Lead listing should still surface spam_score / spam_flags from scoring."""
        auth = {"Authorization": f"Bearer {main_user_token}"}
        r = session.get(f"{API}/leads/feed", headers=auth)
        assert r.status_code == 200
        leads = r.json().get("leads") or []
        if not leads:
            pytest.skip("No leads available")
        # At least one scored lead should have spam_score/spam_flags
        scored = [l for l in leads if "spam_score" in l or "spam_flags" in l]
        assert scored, "No lead exposes spam_score/spam_flags fields"
        sample = scored[0]
        assert isinstance(sample.get("spam_score"), (int, float)), \
            f"spam_score is not numeric: {sample.get('spam_score')!r}"
        assert isinstance(sample.get("spam_flags"), list), \
            f"spam_flags is not a list: {sample.get('spam_flags')!r}"
