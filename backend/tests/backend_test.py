"""NEXOIN backend tests — auth, RBAC, user management, regression."""
import os
import uuid

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = ("admin@nexoin.eu", "nexoin-admin-2026")
MANAGER = ("manager@nexoin.eu", "manager123")
EMPLOYEE = ("employee@nexoin.eu", "employee123")


def login(email, password):
    return requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)


def token_of(creds):
    r = login(*creds)
    if r.status_code != 200:
        pytest.fail(f"Login failed for {creds[0]}: {r.status_code} {r.text[:300]}")
    tok = r.json().get("token")
    assert tok
    return tok


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="session")
def admin_token():
    return token_of(ADMIN)


@pytest.fixture(scope="session")
def manager_token():
    return token_of(MANAGER)


@pytest.fixture(scope="session")
def employee_token():
    return token_of(EMPLOYEE)


# ---- Auth ----------------------------------------------------------------
class TestAuth:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=30)
        assert r.status_code == 200
        assert "message" in r.json()

    def test_login_admin(self):
        r = login(*ADMIN)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d["token"], str) and len(d["token"]) > 20
        assert d["user"]["email"] == ADMIN[0]
        assert d["user"]["role"] == "admin"
        assert "password_hash" not in d["user"]

    def test_login_wrong_password(self):
        r = login(ADMIN[0], "wrong-pass")
        assert r.status_code == 401

    def test_login_unknown_email(self):
        r = login("nope_notexist@nexoin.eu", "whatever")
        assert r.status_code == 401

    def test_me_with_token(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=H(admin_token), timeout=30)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN[0]
        assert r.json()["role"] == "admin"

    def test_me_no_token(self):
        assert requests.get(f"{API}/auth/me", timeout=30).status_code == 401

    def test_me_bad_token(self):
        r = requests.get(f"{API}/auth/me", headers=H("garbage.token.xx"), timeout=30)
        assert r.status_code == 401

    def test_brute_force_lockout(self):
        """Playbook check: repeated failed logins should lock/throttle.

        Uses a dedicated throwaway email so a parallel worker's successful
        login (which clears attempts) cannot race and wipe the lockout.
        """
        victim = "bruteforce-probe@nexoin.eu"
        codes = [login(victim, "badpass").status_code for _ in range(6)]
        assert 429 in codes or 423 in codes, f"No lockout/throttle after 6 bad logins: {codes}"


# ---- RBAC ----------------------------------------------------------------
class TestRBAC:
    def test_employee_read_allowed(self, employee_token):
        for path in ("/dashboard", "/quotes", "/clients", "/vehicles", "/contacts", "/applications"):
            r = requests.get(f"{API}{path}", headers=H(employee_token), timeout=30)
            assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"

    def test_employee_denied_writes(self, employee_token):
        h = H(employee_token)
        assert requests.get(f"{API}/users", headers=h, timeout=30).status_code == 403
        assert requests.put(f"{API}/settings", headers=h, json={"notification_email": "x@y.eu"}, timeout=30).status_code == 403
        assert requests.post(f"{API}/clients", headers=h, json={"company_name": "TEST_x"}, timeout=30).status_code == 403
        assert requests.delete(f"{API}/clients/{uuid.uuid4()}", headers=h, timeout=30).status_code == 403

    def test_manager_permissions(self, manager_token):
        h = H(manager_token)
        assert requests.get(f"{API}/quotes", headers=h, timeout=30).status_code == 200
        r = requests.post(f"{API}/clients", headers=h, json={"company_name": "TEST_mgr_client"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        cid = r.json()["id"]
        assert requests.delete(f"{API}/clients/{cid}", headers=h, timeout=30).status_code == 200
        assert requests.get(f"{API}/users", headers=h, timeout=30).status_code == 403
        assert requests.put(f"{API}/settings", headers=h, json={"notification_email": "x@y.eu"}, timeout=30).status_code == 403

    def test_admin_permissions(self, admin_token):
        h = H(admin_token)
        assert requests.get(f"{API}/users", headers=h, timeout=30).status_code == 200
        r = requests.post(f"{API}/clients", headers=h, json={"company_name": "TEST_admin_client"}, timeout=30)
        assert r.status_code == 200
        assert requests.delete(f"{API}/clients/{r.json()['id']}", headers=h, timeout=30).status_code == 200

    def test_unauthenticated_protected_endpoints(self):
        for path in ("/dashboard", "/quotes", "/users", "/clients", "/vehicles"):
            assert requests.get(f"{API}{path}", timeout=30).status_code == 401, path


# ---- User management -----------------------------------------------------
class TestUsers:
    created = []

    def test_create_list_update_delete_user(self, admin_token):
        h = H(admin_token)
        email = f"test_user_{uuid.uuid4().hex[:8]}@nexoin.eu"
        r = requests.post(f"{API}/users", headers=h, json={
            "email": email, "name": "TEST User", "role": "employee", "password": "secret123"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        u = r.json()
        assert u["email"] == email and u["role"] == "employee" and u["status"] == "active"
        assert "password_hash" not in u
        uid = u["id"]
        TestUsers.created.append(uid)

        # list contains it
        lst = requests.get(f"{API}/users", headers=h, timeout=30)
        assert lst.status_code == 200
        assert any(x["id"] == uid for x in lst.json())

        # new user can log in
        assert login(email, "secret123").status_code == 200

        # update role + password
        r = requests.put(f"{API}/users/{uid}", headers=h, json={
            "email": email, "name": "TEST User 2", "role": "manager", "password": "newsecret1"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["role"] == "manager" and r.json()["name"] == "TEST User 2"
        got = [x for x in requests.get(f"{API}/users", headers=h, timeout=30).json() if x["id"] == uid][0]
        assert got["role"] == "manager" and got["name"] == "TEST User 2"
        assert login(email, "newsecret1").status_code == 200
        assert login(email, "secret123").status_code == 401

        # delete
        assert requests.delete(f"{API}/users/{uid}", headers=h, timeout=30).status_code == 200
        TestUsers.created.remove(uid)
        assert not any(x["id"] == uid for x in requests.get(f"{API}/users", headers=h, timeout=30).json())
        assert login(email, "newsecret1").status_code == 401

    def test_disabled_user_cannot_login(self, admin_token):
        h = H(admin_token)
        email = f"test_dis_{uuid.uuid4().hex[:8]}@nexoin.eu"
        r = requests.post(f"{API}/users", headers=h, json={
            "email": email, "name": "TEST Dis", "role": "employee", "password": "secret123"}, timeout=30)
        assert r.status_code == 200
        uid = r.json()["id"]
        try:
            up = requests.put(f"{API}/users/{uid}", headers=h, json={
                "email": email, "name": "TEST Dis", "role": "employee", "status": "disabled"}, timeout=30)
            assert up.status_code == 200
            assert login(email, "secret123").status_code == 403
        finally:
            requests.delete(f"{API}/users/{uid}", headers=h, timeout=30)

    def test_validation_guards(self, admin_token):
        h = H(admin_token)
        # duplicate email
        r = requests.post(f"{API}/users", headers=h, json={
            "email": ADMIN[0], "name": "Dup", "role": "employee", "password": "secret123"}, timeout=30)
        assert r.status_code == 400
        # invalid role
        r = requests.post(f"{API}/users", headers=h, json={
            "email": f"test_r_{uuid.uuid4().hex[:6]}@nexoin.eu", "name": "R", "role": "superuser", "password": "secret123"}, timeout=30)
        assert r.status_code == 400
        # short password
        r = requests.post(f"{API}/users", headers=h, json={
            "email": f"test_p_{uuid.uuid4().hex[:6]}@nexoin.eu", "name": "P", "role": "employee", "password": "abc"}, timeout=30)
        assert r.status_code == 400
        # missing password
        r = requests.post(f"{API}/users", headers=h, json={
            "email": f"test_n_{uuid.uuid4().hex[:6]}@nexoin.eu", "name": "N", "role": "employee"}, timeout=30)
        assert r.status_code == 400
        # update non-existent
        r = requests.put(f"{API}/users/{uuid.uuid4()}", headers=h, json={
            "email": "x@y.eu", "name": "X", "role": "employee"}, timeout=30)
        assert r.status_code == 404
        assert requests.delete(f"{API}/users/{uuid.uuid4()}", headers=h, timeout=30).status_code == 404

    def test_update_to_duplicate_email(self, admin_token):
        """PUT /users/{id} with an email already taken should be 400, not 500."""
        h = H(admin_token)
        email = f"test_dup_{uuid.uuid4().hex[:8]}@nexoin.eu"
        uid = requests.post(f"{API}/users", headers=h, json={
            "email": email, "name": "TEST Dup", "role": "employee", "password": "secret123"}, timeout=30).json()["id"]
        try:
            r = requests.put(f"{API}/users/{uid}", headers=h, json={
                "email": ADMIN[0], "name": "TEST Dup", "role": "employee"}, timeout=30)
            assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"
        finally:
            requests.delete(f"{API}/users/{uid}", headers=h, timeout=30)

    def test_cannot_delete_self(self, admin_token):
        h = H(admin_token)
        me = requests.get(f"{API}/auth/me", headers=h, timeout=30).json()
        r = requests.delete(f"{API}/users/{me['id']}", headers=h, timeout=30)
        assert r.status_code == 400
        assert "own account" in r.json().get("detail", "").lower()

    def test_cannot_demote_last_admin(self, admin_token):
        h = H(admin_token)
        me = requests.get(f"{API}/auth/me", headers=h, timeout=30).json()
        admins = [u for u in requests.get(f"{API}/users", headers=h, timeout=30).json()
                  if u["role"] == "admin" and u.get("status") != "disabled"]
        if len(admins) > 1:
            pytest.skip("More than one active admin present; last-admin guard not exercisable")
        r = requests.put(f"{API}/users/{me['id']}", headers=h, json={
            "email": me["email"], "name": me["name"], "role": "manager"}, timeout=30)
        assert r.status_code == 400, r.text[:300]
        # confirm still admin
        assert requests.get(f"{API}/auth/me", headers=h, timeout=30).json()["role"] == "admin"


# ---- Regression: quotes / contacts / applications / settings / dashboard --
class TestRegression:
    def test_public_quote_create_and_admin_flow(self, admin_token):
        h = H(admin_token)
        payload = {"company": "TEST_Co", "name": "TEST Tester", "email": "test_qa@example.com",
                   "origin": "Brussels", "destination": "Paris", "cargoType": "Pallets",
                   "weight": "1000", "language": "en"}
        r = requests.post(f"{API}/quotes", json=payload, timeout=60)
        assert r.status_code == 200, r.text[:300]
        qid = r.json()["id"]
        assert r.json()["status"] == "new"
        try:
            lst = requests.get(f"{API}/quotes", headers=h, timeout=30)
            assert lst.status_code == 200 and any(q["id"] == qid for q in lst.json())
            # status update
            p = requests.patch(f"{API}/quotes/{qid}", headers=h, json={"status": "contacted"}, timeout=30)
            assert p.status_code == 200 and p.json()["status"] == "contacted"
            assert requests.patch(f"{API}/quotes/{qid}", headers=h, json={"status": "bogus"}, timeout=30).status_code == 400
            # edit
            e = requests.put(f"{API}/quotes/{qid}", headers=h, json={**payload, "company": "TEST_Co2", "status": "closed"}, timeout=30)
            assert e.status_code == 200 and e.json()["company"] == "TEST_Co2"
            got = [q for q in requests.get(f"{API}/quotes", headers=h, timeout=30).json() if q["id"] == qid][0]
            assert got["company"] == "TEST_Co2" and got["status"] == "closed"
        finally:
            assert requests.delete(f"{API}/quotes/{qid}", headers=h, timeout=30).status_code == 200
        assert not any(q["id"] == qid for q in requests.get(f"{API}/quotes", headers=h, timeout=30).json())

    def test_employee_can_update_quote_status_but_not_edit(self, admin_token, employee_token):
        payload = {"company": "TEST_Co3", "name": "TEST T", "email": "test_qa2@example.com",
                   "origin": "A", "destination": "B", "cargoType": "Box"}
        qid = requests.post(f"{API}/quotes", json=payload, timeout=60).json()["id"]
        try:
            eh = H(employee_token)
            assert requests.patch(f"{API}/quotes/{qid}", headers=eh, json={"status": "closed"}, timeout=30).status_code == 200
            assert requests.put(f"{API}/quotes/{qid}", headers=eh, json={**payload, "status": "new"}, timeout=30).status_code == 403
            assert requests.delete(f"{API}/quotes/{qid}", headers=eh, timeout=30).status_code == 403
        finally:
            requests.delete(f"{API}/quotes/{qid}", headers=H(admin_token), timeout=30)

    def test_contacts_flow(self, admin_token, manager_token):
        r = requests.post(f"{API}/contacts", json={"name": "TEST C", "email": "test_c@example.com",
                                                   "company": "TEST", "message": "hello"}, timeout=60)
        assert r.status_code == 200
        cid = r.json()["id"]
        lst = requests.get(f"{API}/contacts", headers=H(admin_token), timeout=30)
        assert lst.status_code == 200 and any(c["id"] == cid for c in lst.json())
        assert requests.delete(f"{API}/contacts/{cid}", headers=H(manager_token), timeout=30).status_code == 200

    def test_applications_flow(self, admin_token):
        r = requests.post(f"{API}/applications", json={"name": "TEST A", "email": "test_a@example.com",
                                                       "role": "Driver", "message": "hi"}, timeout=60)
        assert r.status_code == 200
        aid = r.json()["id"]
        lst = requests.get(f"{API}/applications", headers=H(admin_token), timeout=30)
        assert lst.status_code == 200 and any(a["id"] == aid for a in lst.json())
        assert requests.delete(f"{API}/applications/{aid}", headers=H(admin_token), timeout=30).status_code == 200

    def test_settings_public_read_and_admin_write(self, admin_token):
        pub = requests.get(f"{API}/settings", timeout=30)
        assert pub.status_code == 200
        original = pub.json()
        upd = {**original, "contact_phone": "+32 10 999 999"}
        w = requests.put(f"{API}/settings", headers=H(admin_token), json=upd, timeout=30)
        assert w.status_code == 200 and w.json()["contact_phone"] == "+32 10 999 999"
        assert requests.get(f"{API}/settings", timeout=30).json()["contact_phone"] == "+32 10 999 999"
        # restore
        requests.put(f"{API}/settings", headers=H(admin_token), json=original, timeout=30)

    def test_dashboard_shape(self, admin_token):
        r = requests.get(f"{API}/dashboard", headers=H(admin_token), timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ("clients", "vehicles", "quotes", "applications", "contacts",
                  "recent_clients", "recent_quotes"):
            assert k in d, k
        assert isinstance(d["clients"], int)
        assert isinstance(d["recent_quotes"], list)
        for q in d["recent_quotes"]:
            assert "_id" not in q

    def test_clients_vehicles_crud_admin(self, admin_token):
        h = H(admin_token)
        r = requests.post(f"{API}/clients", headers=h, json={"company_name": "TEST_CrudCo", "email": "test@c.eu"}, timeout=30)
        assert r.status_code == 200
        cid = r.json()["id"]
        u = requests.put(f"{API}/clients/{cid}", headers=h, json={"company_name": "TEST_CrudCo2"}, timeout=30)
        assert u.status_code == 200 and u.json()["company_name"] == "TEST_CrudCo2"
        assert requests.delete(f"{API}/clients/{cid}", headers=h, timeout=30).status_code == 200
        assert requests.delete(f"{API}/clients/{cid}", headers=h, timeout=30).status_code == 404

        v = requests.post(f"{API}/vehicles", headers=h, json={"make": "TEST_Volvo", "registration": "TEST-1"}, timeout=30)
        assert v.status_code == 200
        vid = v.json()["id"]
        assert requests.put(f"{API}/vehicles/{vid}", headers=h, json={"make": "TEST_Scania"}, timeout=30).json()["make"] == "TEST_Scania"
        assert requests.delete(f"{API}/vehicles/{vid}", headers=h, timeout=30).status_code == 200


# ---- Seeding / hash format ----------------------------------------------
class TestSeed:
    def test_bcrypt_hash_format(self):
        import subprocess
        out = subprocess.run([
            "python", "-c",
            "import os,asyncio;from motor.motor_asyncio import AsyncIOMotorClient;"
            "from dotenv import load_dotenv;load_dotenv('/app/backend/.env');"
            "c=AsyncIOMotorClient(os.environ['MONGO_URL']);d=c[os.environ['DB_NAME']];"
            "print(asyncio.get_event_loop().run_until_complete(d.users.find_one({'email':'admin@nexoin.eu'}))['password_hash'])"
        ], capture_output=True, text=True, timeout=60)
        assert out.returncode == 0, out.stderr[:500]
        assert out.stdout.strip().startswith("$2b$"), out.stdout.strip()[:20]
