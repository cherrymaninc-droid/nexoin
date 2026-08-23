import os
import time

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")

DEFAULTS = {
    "notification_email": "",
    "contact_email": "ops@nexoin.eu",
    "contact_phone": "+32 10 000 000",
    "contact_locations": "Rotterdam · Frankfurt · Lyon",
}


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module", autouse=True)
def restore_settings(api):
    yield
    r = api.put(f"{BASE_URL}/api/settings", json=DEFAULTS, timeout=60)
    assert r.status_code == 200


# ---- health ----
class TestHealth:
    def test_root(self, api):
        r = api.get(f"{BASE_URL}/api/", timeout=30)
        assert r.status_code == 200
        assert "NEXOIN" in r.json()["message"]


# ---- settings ----
class TestSettings:
    def test_get_settings_shape(self, api):
        r = api.get(f"{BASE_URL}/api/settings", timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in DEFAULTS:
            assert k in d, f"missing {k}"
        assert "_id" not in d

    def test_put_settings_persists(self, api):
        payload = {
            "notification_email": "delivered@resend.dev",
            "contact_email": "TEST_ops@resend.dev",
            "contact_phone": "+32 99 111 222",
            "contact_locations": "TEST_Antwerp · Munich",
        }
        r = api.put(f"{BASE_URL}/api/settings", json=payload, timeout=60)
        assert r.status_code == 200
        assert r.json() == payload
        g = api.get(f"{BASE_URL}/api/settings", timeout=30)
        assert g.status_code == 200
        assert g.json() == payload

    def test_put_settings_reset_to_defaults(self, api):
        r = api.put(f"{BASE_URL}/api/settings", json=DEFAULTS, timeout=60)
        assert r.status_code == 200
        g = api.get(f"{BASE_URL}/api/settings", timeout=30)
        assert g.json()["contact_email"] == "ops@nexoin.eu"


# ---- quotes ----
class TestQuotes:
    quote_id = None

    def test_create_quote_sends_emails_and_returns_200(self, api):
        # notification email set to a deliverable recipient
        api.put(f"{BASE_URL}/api/settings", json={**DEFAULTS, "notification_email": "delivered@resend.dev"}, timeout=60)
        payload = {
            "company": "TEST_Logistics BV",
            "name": "TEST QA",
            "email": "delivered@resend.dev",
            "phone": "+32 400 000",
            "origin": "Rotterdam",
            "destination": "Lyon",
            "cargoType": "Palletised",
            "weight": "1200",
            "frequency": "weekly",
            "message": "TEST message",
            "language": "fr",
        }
        t0 = time.time()
        r = api.post(f"{BASE_URL}/api/quotes", json=payload, timeout=120)
        elapsed = time.time() - t0
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "new"
        assert isinstance(d["id"], str) and d["id"]
        assert d["email"] == payload["email"]
        assert d["company"] == payload["company"]
        assert "_id" not in d
        TestQuotes.quote_id = d["id"]
        print(f"quote create latency {elapsed:.1f}s")

    def test_quote_persisted_in_list(self, api):
        r = api.get(f"{BASE_URL}/api/quotes", timeout=60)
        assert r.status_code == 200
        ids = [q["id"] for q in r.json()]
        assert TestQuotes.quote_id in ids

    def test_create_quote_with_undeliverable_notification_still_200(self, api):
        api.put(f"{BASE_URL}/api/settings", json={**DEFAULTS, "notification_email": "ops@nexoin.eu"}, timeout=60)
        payload = {
            "company": "TEST_Undeliverable",
            "name": "TEST QA2",
            "email": "ops@nexoin.eu",
            "origin": "Frankfurt",
            "destination": "Lille",
            "cargoType": "Reefer",
            "language": "en",
        }
        r = api.post(f"{BASE_URL}/api/quotes", json=payload, timeout=120)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "new"

    def test_create_quote_invalid_email_422(self, api):
        r = api.post(f"{BASE_URL}/api/quotes", json={
            "company": "x", "name": "y", "email": "not-an-email",
            "origin": "a", "destination": "b", "cargoType": "c"}, timeout=60)
        assert r.status_code == 422

    def test_patch_status_contacted_and_closed(self, api):
        qid = TestQuotes.quote_id
        for st in ("contacted", "closed"):
            r = api.patch(f"{BASE_URL}/api/quotes/{qid}", json={"status": st}, timeout=60)
            assert r.status_code == 200, r.text
            assert r.json()["status"] == st
            g = api.get(f"{BASE_URL}/api/quotes", timeout=60)
            match = [q for q in g.json() if q["id"] == qid][0]
            assert match["status"] == st

    def test_patch_invalid_status_400(self, api):
        r = api.patch(f"{BASE_URL}/api/quotes/{TestQuotes.quote_id}", json={"status": "bogus"}, timeout=60)
        assert r.status_code == 400
        assert "Invalid" in r.json().get("detail", "")

    def test_patch_unknown_quote_404(self, api):
        r = api.patch(f"{BASE_URL}/api/quotes/does-not-exist", json={"status": "closed"}, timeout=60)
        assert r.status_code == 404


# ---- contacts ----
class TestContacts:
    contact_id = None

    def test_create_contact(self, api):
        payload = {
            "name": "TEST Contact",
            "email": "delivered@resend.dev",
            "company": "TEST_Co",
            "message": "TEST enquiry message",
            "language": "de",
        }
        r = api.post(f"{BASE_URL}/api/contacts", json=payload, timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d["id"], str) and d["id"]
        assert d["name"] == payload["name"]
        assert d["email"] == payload["email"]
        assert d["company"] == payload["company"]
        assert d["message"] == payload["message"]
        assert d["language"] == "de"
        assert "_id" not in d
        TestContacts.contact_id = d["id"]

    def test_list_contacts_contains_created(self, api):
        r = api.get(f"{BASE_URL}/api/contacts", timeout=60)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        found = [c for c in rows if c["id"] == TestContacts.contact_id]
        assert found, "created contact not returned by GET /api/contacts"
        assert found[0]["message"] == "TEST enquiry message"

    def test_contact_missing_message_422(self, api):
        r = api.post(f"{BASE_URL}/api/contacts", json={"name": "a", "email": "a@b.co"}, timeout=60)
        assert r.status_code == 422
