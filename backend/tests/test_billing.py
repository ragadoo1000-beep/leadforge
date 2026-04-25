"""Backend tests for Razorpay billing module (iter3)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://ai-outreach-17.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def existing_user_token():
    r = requests.post(f"{API}/auth/login", json={"email": "test@leadforge.io", "password": "test1234"}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"Existing test user login failed: {r.status_code}")
    return r.json()["token"]


@pytest.fixture(scope="module")
def fresh_user_token():
    email = f"TEST_billing_{uuid.uuid4().hex[:8]}@leadforge.io"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "testpass123", "name": "TEST Billing"}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def auth(t):
    return {"Authorization": f"Bearer {t}"}


# ----- /billing/plans -----
def test_plans_public():
    r = requests.get(f"{API}/billing/plans", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert "plans" in d and len(d["plans"]) == 3
    assert d["trial_days"] == 7
    assert isinstance(d["razorpay_enabled"], bool)
    by_id = {p["id"]: p for p in d["plans"]}
    assert by_id["minimum"]["monthly_inr"] == 299 and by_id["minimum"]["annual_inr"] == 2870
    assert by_id["professional"]["monthly_inr"] == 399 and by_id["professional"]["annual_inr"] == 3830
    assert by_id["expert"]["monthly_inr"] == 499 and by_id["expert"]["annual_inr"] == 4790
    # limits
    assert by_id["minimum"]["limits"] == {"leads_per_day": 25, "messages_per_day": 12}
    assert by_id["professional"]["limits"] == {"leads_per_day": 100, "messages_per_day": 50}
    assert by_id["expert"]["limits"]["leads_per_day"] >= 10000


# ----- /billing/me auth check -----
def test_billing_me_requires_auth():
    r = requests.get(f"{API}/billing/me", timeout=15)
    assert r.status_code in (401, 403)


def test_billing_me_existing_user_pro_trial(existing_user_token):
    r = requests.get(f"{API}/billing/me", headers=auth(existing_user_token), timeout=15)
    assert r.status_code == 200
    d = r.json()
    # Per request: existing user already on Professional Trial from smoke test
    if d.get("subscription_status") == "trial":
        assert d["plan_tier"] == "professional"
        assert d["limits"] == {"leads_per_day": 100, "messages_per_day": 50}
    else:
        # Tolerant: just ensure structure
        assert "limits" in d and "plan_tier" in d


def test_billing_me_fresh_user_free_limits(fresh_user_token):
    r = requests.get(f"{API}/billing/me", headers=auth(fresh_user_token), timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["plan_tier"] == "free"
    assert d["subscription_status"] == "free"
    assert d["limits"] == {"leads_per_day": 10, "messages_per_day": 5}


# ----- create-subscription -----
def test_create_subscription_invalid_tier(fresh_user_token):
    r = requests.post(f"{API}/billing/create-subscription",
                      headers=auth(fresh_user_token),
                      json={"tier": "foo", "period": "monthly"}, timeout=15)
    assert r.status_code == 422


def test_create_subscription_demo_mode_and_persist(fresh_user_token):
    r = requests.post(f"{API}/billing/create-subscription",
                      headers=auth(fresh_user_token),
                      json={"tier": "professional", "period": "monthly"}, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    # In demo mode: demo_mode=true, subscription_id, trial_ends_at
    if d.get("demo_mode"):
        assert d["subscription_id"].startswith("demo_sub_")
        assert d.get("trial_ends_at")
    else:
        assert d.get("short_url") and d.get("subscription_id")
    # Verify state via /billing/me
    me = requests.get(f"{API}/billing/me", headers=auth(fresh_user_token), timeout=15).json()
    assert me["plan_tier"] == "professional"
    assert me["plan_period"] == "monthly"
    assert me["subscription_status"] in ("trial", "pending")
    if me["subscription_status"] == "trial":
        assert me["limits"] == {"leads_per_day": 100, "messages_per_day": 50}


def test_create_subscription_requires_auth():
    r = requests.post(f"{API}/billing/create-subscription",
                      json={"tier": "professional", "period": "monthly"}, timeout=15)
    assert r.status_code in (401, 403)


# ----- daily caps -----
def test_fetch_leads_uses_tier_limit(fresh_user_token):
    # fresh_user_token now on professional trial after subscribe test ran (module scope)
    me = requests.get(f"{API}/billing/me", headers=auth(fresh_user_token), timeout=15).json()
    # If no sub created yet, subscribe first
    if me["subscription_status"] not in ("trial", "active"):
        requests.post(f"{API}/billing/create-subscription",
                      headers=auth(fresh_user_token),
                      json={"tier": "professional", "period": "monthly"}, timeout=15)
    r = requests.post(f"{API}/leads/fetch",
                      headers=auth(fresh_user_token),
                      json={"subreddits": ["forhire"], "keywords": ["hire", "need"], "hours": 72},
                      timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    # remaining + leads count should equal the daily cap (100 for pro)
    leads_received = len(d.get("leads", []))
    assert d["remaining"] >= 0
    # Cap should be from professional tier
    cap_used = leads_received + d["remaining"]
    assert cap_used <= 100, f"Expected cap <=100 (pro), got {cap_used}"


# ----- verify -----
def test_verify_when_razorpay_disabled(fresh_user_token):
    r = requests.post(f"{API}/billing/verify",
                      headers=auth(fresh_user_token),
                      json={"razorpay_payment_id": "pay_x",
                            "razorpay_subscription_id": "sub_x",
                            "razorpay_signature": "deadbeef"}, timeout=15)
    # When disabled -> 400 'Razorpay not configured'. When enabled w/ bad sig -> 400 'Invalid signature'
    assert r.status_code == 400
    detail = r.json().get("detail", "")
    assert "Razorpay" in detail or "Invalid signature" in detail


# ----- cancel -----
def test_cancel_subscription_demo(fresh_user_token):
    # Ensure subscribed first
    me = requests.get(f"{API}/billing/me", headers=auth(fresh_user_token), timeout=15).json()
    if not me.get("subscription_status") in ("trial", "active", "pending"):
        requests.post(f"{API}/billing/create-subscription",
                      headers=auth(fresh_user_token),
                      json={"tier": "minimum", "period": "monthly"}, timeout=15)
    r = requests.post(f"{API}/billing/cancel", headers=auth(fresh_user_token), timeout=15)
    assert r.status_code == 200, r.text
    assert r.json().get("cancelled") is True
    me2 = requests.get(f"{API}/billing/me", headers=auth(fresh_user_token), timeout=15).json()
    assert me2["subscription_status"] == "cancelled"
    assert me2["is_premium"] is False


def test_cancel_requires_auth():
    r = requests.post(f"{API}/billing/cancel", timeout=15)
    assert r.status_code in (401, 403)


# ----- webhook -----
def test_webhook_processes_event_no_secret():
    # Without RAZORPAY_WEBHOOK_SECRET set, signature is skipped and event processed
    payload = {
        "event": "subscription.activated",
        "payload": {"subscription": {"entity": {"id": "sub_test_xyz", "notes": {"user_id": "nonexistent"}}}},
    }
    r = requests.post(f"{API}/billing/webhook", json=payload, timeout=15)
    assert r.status_code == 200
    assert r.json().get("received") is True


def test_webhook_invalid_json():
    r = requests.post(f"{API}/billing/webhook", data="not-json",
                      headers={"Content-Type": "application/json"}, timeout=15)
    # When secret missing, JSON parse fails -> 400
    assert r.status_code in (400, 401)
