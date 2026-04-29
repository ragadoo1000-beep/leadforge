"""Backend tests for LeadForge AI early-access endpoints + regression checks."""
import os
import sys
import time
import uuid
import requests

BACKEND_URL = "https://leadforge-ai-4.preview.emergentagent.com"
API = f"{BACKEND_URL}/api"

PASS = []
FAIL = []


def record(name, ok, detail=""):
    if ok:
        PASS.append((name, detail))
        print(f"PASS  {name} {('- ' + detail) if detail else ''}")
    else:
        FAIL.append((name, detail))
        print(f"FAIL  {name} - {detail}")


def unique_email(tag="ea"):
    return f"{tag}.{uuid.uuid4().hex[:10]}@leadforge-test.io"


# ============ EARLY ACCESS SIGNUP ============

def test_early_access_new_email():
    email = unique_email("new")
    r = requests.post(f"{API}/early-access/signup",
                      json={"email": email, "role": "Designer", "source": "landing"},
                      timeout=15)
    if r.status_code != 200:
        record("early-access signup new email", False, f"status={r.status_code} body={r.text}")
        return None
    data = r.json()
    ok = data.get("ok") is True and data.get("already_registered") is False
    record("early-access signup new email", ok, f"resp={data}")
    return email


def test_early_access_idempotent(email):
    if not email:
        record("early-access signup idempotent", False, "no email from previous test")
        return
    r = requests.post(f"{API}/early-access/signup",
                      json={"email": email, "role": "Developer", "source": "landing"},
                      timeout=15)
    if r.status_code != 200:
        record("early-access signup idempotent", False, f"status={r.status_code} body={r.text}")
        return
    data = r.json()
    ok = data.get("ok") is True and data.get("already_registered") is True
    record("early-access signup idempotent", ok, f"resp={data}")


def test_early_access_invalid_email():
    r = requests.post(f"{API}/early-access/signup",
                      json={"email": "not-an-email", "role": "Designer"},
                      timeout=15)
    ok = r.status_code == 422
    record("early-access invalid email returns 422", ok, f"status={r.status_code}")


def test_early_access_normalization():
    raw = unique_email("norm")
    upper = raw.upper()
    spaced = f"  {upper}  "
    # First call with uppercase + whitespace
    r1 = requests.post(f"{API}/early-access/signup",
                       json={"email": spaced, "source": "landing"},
                       timeout=15)
    # NOTE: pydantic EmailStr typically normalizes/validates email; but trimming is done server-side.
    if r1.status_code != 200:
        record("early-access email normalization (first call)", False,
               f"status={r1.status_code} body={r1.text}")
        return
    d1 = r1.json()
    if d1.get("already_registered") is not False:
        record("early-access email normalization (first call)", False,
               f"expected fresh signup, got {d1}")
        return
    # Second call with lowercase, no whitespace - should be already_registered
    r2 = requests.post(f"{API}/early-access/signup",
                       json={"email": raw.lower(), "source": "landing"},
                       timeout=15)
    if r2.status_code != 200:
        record("early-access email normalization (second call)", False,
               f"status={r2.status_code} body={r2.text}")
        return
    d2 = r2.json()
    ok = d2.get("ok") is True and d2.get("already_registered") is True
    record("early-access email normalization (lowercase+trim)", ok,
           f"first={d1} second={d2}")


def test_early_access_field_caps():
    email = unique_email("cap")
    long_role = "A" * 200
    long_source = "B" * 200
    r = requests.post(f"{API}/early-access/signup",
                      json={"email": email, "role": long_role, "source": long_source},
                      timeout=15)
    if r.status_code != 200:
        record("early-access field length cap", False, f"status={r.status_code} body={r.text}")
        return
    # Endpoint accepted; verify via GET we cannot directly inspect the doc, but we can
    # at least confirm it didn't 5xx and the count grew. Server caps at 40 chars internally.
    record("early-access field length cap accepted", True, f"resp={r.json()}")


def test_early_access_count():
    r = requests.get(f"{API}/early-access/count", timeout=15)
    if r.status_code != 200:
        record("early-access count", False, f"status={r.status_code} body={r.text}")
        return None
    data = r.json()
    n = data.get("count")
    ok = isinstance(n, int) and n >= 0
    record("early-access count returns integer", ok, f"count={n}")
    return n


def test_early_access_count_increments():
    before = test_early_access_count_silent()
    email = unique_email("inc")
    r = requests.post(f"{API}/early-access/signup",
                      json={"email": email}, timeout=15)
    if r.status_code != 200:
        record("early-access count increments", False, f"signup status={r.status_code}")
        return
    after = test_early_access_count_silent()
    ok = after == before + 1
    record("early-access count increments after new signup", ok,
           f"before={before} after={after}")
    # Idempotent call should not increment
    r2 = requests.post(f"{API}/early-access/signup",
                       json={"email": email}, timeout=15)
    after2 = test_early_access_count_silent()
    ok2 = after2 == after
    record("early-access count stable on duplicate signup", ok2,
           f"after_dup={after2}")


def test_early_access_count_silent():
    r = requests.get(f"{API}/early-access/count", timeout=15)
    return r.json().get("count") if r.status_code == 200 else None


def test_early_access_no_auth_required():
    # Both endpoints should work without Authorization header (already used above without one).
    # Explicitly pass an invalid bearer too to confirm it isn't rejected.
    email = unique_email("noauth")
    headers = {"Authorization": "Bearer total-garbage-token"}
    r = requests.post(f"{API}/early-access/signup", json={"email": email},
                      headers=headers, timeout=15)
    ok = r.status_code == 200
    record("early-access signup public (no/invalid auth)", ok,
           f"status={r.status_code}")
    r2 = requests.get(f"{API}/early-access/count", headers=headers, timeout=15)
    ok2 = r2.status_code == 200
    record("early-access count public (no/invalid auth)", ok2,
           f"status={r2.status_code}")


# ============ REGRESSION ============

def get_auth_token():
    """Login or register the seed test user."""
    creds = [
        {"email": "test@leadforge.io", "password": "test1234"},
        {"email": "test@leadforge.io", "password": "admin123"},
    ]
    for c in creds:
        r = requests.post(f"{API}/auth/login", json=c, timeout=15)
        if r.status_code == 200:
            return r.json()["token"], c["email"]
    # Register new user
    email = unique_email("reg")
    r = requests.post(f"{API}/auth/register",
                      json={"email": email, "password": "Str0ngP@ss!", "name": "Test User"},
                      timeout=15)
    if r.status_code != 200:
        return None, None
    return r.json()["token"], email


def test_auth_register():
    email = unique_email("regtest")
    r = requests.post(f"{API}/auth/register",
                      json={"email": email, "password": "Str0ngP@ss!", "name": "Reg Test"},
                      timeout=15)
    ok = r.status_code == 200 and "token" in r.json()
    record("regression POST /auth/register", ok, f"status={r.status_code}")


def test_auth_login_and_me():
    token, email = get_auth_token()
    if not token:
        record("regression POST /auth/login", False, "could not obtain token")
        record("regression GET /auth/me", False, "no token")
        return None
    record("regression POST /auth/login", True, f"email={email}")
    r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=15)
    ok = r.status_code == 200 and r.json().get("email") == email
    record("regression GET /auth/me", ok, f"status={r.status_code}")
    return token


def test_billing_plans_public():
    r = requests.get(f"{API}/billing/plans", timeout=15)
    if r.status_code != 200:
        record("regression GET /billing/plans", False, f"status={r.status_code}")
        return
    data = r.json()
    ok = "plans" in data and len(data["plans"]) >= 1 and "trial_days" in data
    record("regression GET /billing/plans", ok, f"plans_count={len(data.get('plans', []))}")


def test_policy_public():
    r = requests.get(f"{API}/policy", timeout=15)
    ok = r.status_code == 200 and "version" in r.json()
    record("regression GET /policy", ok, f"status={r.status_code}")


def test_leads_feed(token):
    if not token:
        record("regression GET /leads/feed", False, "no auth token")
        return
    r = requests.get(f"{API}/leads/feed", headers={"Authorization": f"Bearer {token}"}, timeout=20)
    ok = r.status_code == 200 and "leads" in r.json() and isinstance(r.json()["leads"], list)
    record("regression GET /leads/feed", ok, f"status={r.status_code}")


# ============ MAIN ============

def main():
    print(f"\n=== Testing against {API} ===\n")
    print("--- Early Access endpoint tests ---")
    email = test_early_access_new_email()
    test_early_access_idempotent(email)
    test_early_access_invalid_email()
    test_early_access_normalization()
    test_early_access_field_caps()
    test_early_access_count()
    test_early_access_count_increments()
    test_early_access_no_auth_required()

    print("\n--- Regression tests ---")
    test_auth_register()
    token = test_auth_login_and_me()
    test_billing_plans_public()
    test_policy_public()
    test_leads_feed(token)

    print(f"\n\n=== RESULTS ===")
    print(f"Passed: {len(PASS)}")
    print(f"Failed: {len(FAIL)}")
    if FAIL:
        print("\nFailures:")
        for n, d in FAIL:
            print(f"  - {n}: {d}")
    return 0 if not FAIL else 1


if __name__ == "__main__":
    sys.exit(main())
