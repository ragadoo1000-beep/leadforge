"""
LeadForge AI — Security hardening backend tests.

Covers:
  1. Security HTTP headers
  2. Rate limiting on /api/early-access/signup  (5/min)
  3. Rate limiting on /api/auth/login           (10/min)
  4. Honeypot anti-bot field
  5. Generic 5xx error handler — no stack-trace leak
  6. Attack-surface reduction (/docs, /openapi.json disabled)
  7. Regression: existing endpoints still work
"""
import time
import uuid
import sys
import requests

BASE = "https://leadforge-ai-4.preview.emergentagent.com"
API = f"{BASE}/api"
TEST_EMAIL = "test@leadforge.io"
TEST_PASSWORD = "test1234"

results = []   # list of (name, passed, detail)


def record(name, passed, detail=""):
    icon = "PASS" if passed else "FAIL"
    print(f"[{icon}] {name}")
    if detail:
        for line in str(detail).splitlines():
            print(f"       {line}")
    results.append((name, passed, detail))


def hdr(title):
    bar = "=" * 80
    print(f"\n{bar}\n  {title}\n{bar}")


# ---------------------------------------------------------------------------
# 1. Security HTTP Headers
# ---------------------------------------------------------------------------
def test_security_headers():
    hdr("1. Security HTTP Headers")
    r = requests.get(f"{API}/early-access/count", timeout=15)
    expected = {
        "x-frame-options": "DENY",
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
        "strict-transport-security": "max-age=31536000; includeSubDomains",
        "content-security-policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
        "permissions-policy": "camera=(), microphone=(), geolocation=()",
    }
    headers_lower = {k.lower(): v for k, v in r.headers.items()}
    for key, want in expected.items():
        got = headers_lower.get(key)
        if got is None:
            record(f"Header present: {key}", False, "Header missing entirely")
            continue
        if got.strip().lower() == want.strip().lower():
            record(f"Header value: {key}", True, f"got '{got}'")
        else:
            record(f"Header value: {key}", False, f"expected '{want}', got '{got}'")


# ---------------------------------------------------------------------------
# 6. Attack-surface reduction
# ---------------------------------------------------------------------------
def test_attack_surface():
    hdr("6. Attack-surface reduction (docs/openapi disabled)")
    for path in ["/api/docs", "/api/openapi.json", "/docs", "/openapi.json", "/redoc"]:
        try:
            r = requests.get(f"{BASE}{path}", timeout=10, allow_redirects=False)
            ok = r.status_code == 404
            record(f"GET {path} -> 404", ok, f"got {r.status_code}")
        except Exception as e:
            record(f"GET {path} -> 404", False, f"error: {e}")


# ---------------------------------------------------------------------------
# 7. Regression
# ---------------------------------------------------------------------------
def test_regression():
    hdr("7. Regression — existing endpoints")
    state = {}

    r = requests.get(f"{API}/billing/plans", timeout=15)
    record("GET /api/billing/plans -> 200", r.status_code == 200,
           f"status={r.status_code}, plans={len(r.json().get('plans', [])) if r.status_code==200 else 'n/a'}")

    r = requests.get(f"{API}/policy", timeout=15)
    record("GET /api/policy -> 200", r.status_code == 200,
           f"status={r.status_code}, version={r.json().get('version') if r.status_code==200 else 'n/a'}")

    r = requests.get(f"{API}/early-access/count", timeout=15)
    record("GET /api/early-access/count -> 200", r.status_code == 200,
           f"status={r.status_code}, count={r.json().get('count') if r.status_code==200 else 'n/a'}")

    r = requests.post(f"{API}/auth/login",
                      json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
                      timeout=15)
    if r.status_code == 200 and r.json().get("token"):
        state["token"] = r.json()["token"]
        record("POST /api/auth/login (valid creds) -> 200 + token", True,
               f"user={r.json().get('user',{}).get('email')}")
    else:
        record("POST /api/auth/login (valid creds) -> 200 + token", False,
               f"status={r.status_code}, body={r.text[:300]}")
        return state

    auth = {"Authorization": f"Bearer {state['token']}"}
    r = requests.get(f"{API}/auth/me", headers=auth, timeout=15)
    record("GET /api/auth/me with token -> 200",
           r.status_code == 200 and r.json().get("email") == TEST_EMAIL,
           f"status={r.status_code}")

    r = requests.get(f"{API}/leads/feed", headers=auth, timeout=20)
    record("GET /api/leads/feed with token -> 200",
           r.status_code == 200 and "leads" in r.json(),
           f"status={r.status_code}, leads={len(r.json().get('leads', [])) if r.status_code==200 else 'n/a'}")

    email = f"reg_{uuid.uuid4().hex[:10]}@leadforge-test.io"
    pre = requests.get(f"{API}/early-access/count", timeout=15).json().get("count", -1)
    r = requests.post(f"{API}/early-access/signup",
                      json={"email": email, "role": "founder", "source": "regression"},
                      timeout=15)
    post = requests.get(f"{API}/early-access/count", timeout=15).json().get("count", -2)
    ok = (r.status_code == 200
          and r.json().get("ok") is True
          and r.json().get("already_registered") is False
          and post == pre + 1)
    record("POST /api/early-access/signup (normal) -> 200 + count incremented", ok,
           f"status={r.status_code}, body={r.json() if r.status_code==200 else r.text[:200]}, pre={pre}, post={post}")
    return state


# ---------------------------------------------------------------------------
# 4. Honeypot
# ---------------------------------------------------------------------------
def test_honeypot_part_a():
    hdr("4a. Honeypot — silent accept, not stored")
    n_before = requests.get(f"{API}/early-access/count", timeout=15).json().get("count", -1)
    bot_email = f"bot_{uuid.uuid4().hex[:10]}@evil.com"
    r = requests.post(f"{API}/early-access/signup",
                      json={"email": bot_email, "company": "AcmeBot"},
                      timeout=15)
    body = {}
    try:
        body = r.json()
    except Exception:
        pass
    silent_ok = (r.status_code == 200
                 and body.get("ok") is True
                 and body.get("already_registered") is False)
    record("POST /api/early-access/signup with honeypot -> 200 silent ok:true",
           silent_ok, f"status={r.status_code}, body={body}")

    n_after = requests.get(f"{API}/early-access/count", timeout=15).json().get("count", -2)
    record("Honeypot did NOT increment count (record not stored)",
           n_after == n_before,
           f"before={n_before}, after={n_after}")
    return n_before, n_after, bot_email


def test_honeypot_part_b(n_after_honeypot):
    hdr("4b. Honeypot — normal email after wait, count must increment")
    print("   waiting 65s for the 5/min signup rate-limit window to reset...")
    time.sleep(65)
    email = f"honeypot_followup_{uuid.uuid4().hex[:10]}@leadforge-test.io"
    r = requests.post(f"{API}/early-access/signup",
                      json={"email": email, "role": "freelancer"},
                      timeout=15)
    body = {}
    try:
        body = r.json()
    except Exception:
        pass
    n_final = requests.get(f"{API}/early-access/count", timeout=15).json().get("count", -3)
    ok = (r.status_code == 200
          and body.get("ok") is True
          and body.get("already_registered") is False
          and n_final == n_after_honeypot + 1)
    record("Normal email after honeypot increments count by 1", ok,
           f"status={r.status_code}, post_honeypot={n_after_honeypot}, final={n_final}, body={body}")


# ---------------------------------------------------------------------------
# 2. Rate limit signup
# ---------------------------------------------------------------------------
def test_rate_limit_signup():
    hdr("2. Rate limit on POST /api/early-access/signup (5/min)")
    print("   waiting 65s for clean signup rate-limit window...")
    time.sleep(65)
    ts = int(time.time())
    statuses = []
    bodies = []
    for i in range(8):
        email = f"ratelimit_{i}_{ts}_{uuid.uuid4().hex[:6]}@test.com"
        r = requests.post(f"{API}/early-access/signup",
                          json={"email": email, "role": "qa"},
                          timeout=15)
        statuses.append(r.status_code)
        try:
            bodies.append(r.json())
        except Exception:
            bodies.append({"raw": r.text[:120]})
    print(f"   statuses across 8 sequential POSTs: {statuses}")

    first5_ok = all(s == 200 for s in statuses[:5])
    record("First 5 signups return 200", first5_ok, f"first5={statuses[:5]}")

    last3 = statuses[5:]
    last3_429 = all(s == 429 for s in last3)
    record("Requests 6-8 return 429", last3_429, f"last3={last3}, bodies={bodies[5:]}")

    if last3 and any(s == 429 for s in last3):
        idx = next(i for i, s in enumerate(statuses[5:], start=5) if s == 429)
        b = bodies[idx]
        body_ok = isinstance(b, dict) and "detail" in b and "Too many requests" in str(b.get("detail", ""))
        record("429 body contains 'Too many requests' detail", body_ok, f"body={b}")


# ---------------------------------------------------------------------------
# 3. Rate limit login
# ---------------------------------------------------------------------------
def test_rate_limit_login():
    hdr("3. Rate limit on POST /api/auth/login (10/min)")
    print("   waiting 65s for clean login rate-limit window...")
    time.sleep(65)
    statuses = []
    for i in range(12):
        if i % 2 == 0:
            payload = {"email": TEST_EMAIL, "password": TEST_PASSWORD}
        else:
            payload = {"email": TEST_EMAIL, "password": "wrong-password"}
        try:
            r = requests.post(f"{API}/auth/login", json=payload, timeout=15)
            statuses.append(r.status_code)
        except Exception as e:
            statuses.append(f"ERR:{e}")
    print(f"   statuses across 12 sequential POSTs: {statuses}")

    first10_ok = all(s in (200, 401) for s in statuses[:10])
    record("First ~10 logins return 200 or 401", first10_ok, f"first10={statuses[:10]}")

    last2 = statuses[10:]
    last2_429 = all(s == 429 for s in last2)
    record("Requests 11-12 return 429", last2_429, f"last2={last2}")


# ---------------------------------------------------------------------------
# 5. Error handler
# ---------------------------------------------------------------------------
def test_error_handler():
    hdr("5. Generic 5xx error handler — no stack-trace leak")
    print("   waiting 65s, then re-logging in...")
    time.sleep(65)
    r = requests.post(f"{API}/auth/login",
                      json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
                      timeout=15)
    if r.status_code != 200:
        record("Could not obtain token for error-handler test", False,
               f"status={r.status_code}, body={r.text[:200]}")
        return
    token = r.json().get("token")
    auth = {"Authorization": f"Bearer {token}"}

    bogus_id = "definitely-does-not-exist-in-db"

    # POST /api/leads/generate-message
    r = requests.post(f"{API}/leads/generate-message",
                      headers=auth,
                      json={"lead_id": bogus_id},
                      timeout=20)
    body_text = r.text or ""
    no_trace = ("Traceback" not in body_text
                and "Exception" not in body_text
                and "/app/" not in body_text)
    if r.status_code == 404:
        try:
            ok = r.json().get("detail") == "Lead not found"
        except Exception:
            ok = False
        record("POST /leads/generate-message bogus id -> 404 'Lead not found'",
               ok, f"status={r.status_code}, body={body_text[:200]}")
        record("No stack-trace in response (generate-message)", no_trace,
               f"body={body_text[:200]}")
    elif r.status_code == 500:
        try:
            ok = r.json() == {"detail": "Something went wrong. Please try again."}
        except Exception:
            ok = False
        record("500 body == generic 'Something went wrong' message", ok,
               f"status={r.status_code}, body={body_text[:200]}")
        record("No stack-trace in 500 response (generate-message)", no_trace,
               f"body={body_text[:200]}")
    else:
        record("Bogus lead_id returned 404 or 500", False,
               f"status={r.status_code}, body={body_text[:200]}")

    # GET /api/leads/{invalid_uuid}
    invalid = str(uuid.uuid4())
    r = requests.get(f"{API}/leads/{invalid}", headers=auth, timeout=15)
    body_text = r.text or ""
    no_trace = ("Traceback" not in body_text
                and "Exception" not in body_text
                and "/app/" not in body_text)
    if r.status_code == 404:
        try:
            ok = r.json().get("detail") == "Lead not found"
        except Exception:
            ok = False
        record("GET /leads/{invalid_uuid} -> 404 'Lead not found'", ok,
               f"status={r.status_code}, body={body_text[:200]}")
        record("No stack-trace on unknown lead GET", no_trace,
               f"body={body_text[:200]}")
    elif r.status_code == 500:
        try:
            ok = r.json() == {"detail": "Something went wrong. Please try again."}
        except Exception:
            ok = False
        record("500 body == generic message (GET unknown lead)", ok,
               f"status={r.status_code}, body={body_text[:200]}")
    else:
        record("Unknown lead GET returned 404 or 500", False,
               f"status={r.status_code}, body={body_text[:200]}")


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------
def main():
    print(f"Target: {BASE}")
    print(f"Started at: {time.strftime('%Y-%m-%d %H:%M:%S')}")

    test_security_headers()
    test_attack_surface()
    state = test_regression()
    _ = state.get("token")

    n_before, n_after, _bot_email = test_honeypot_part_a()
    test_honeypot_part_b(n_after)

    test_rate_limit_signup()
    test_rate_limit_login()
    test_error_handler()

    print("\n" + "=" * 80)
    print("  SUMMARY")
    print("=" * 80)
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    for name, ok, _detail in results:
        icon = "PASS" if ok else "FAIL"
        print(f"  [{icon}] {name}")
    print(f"\n  {passed}/{total} assertions passed")
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
