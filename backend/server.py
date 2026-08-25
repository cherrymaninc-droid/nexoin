from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, UploadFile, File, Query, Request
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import ipaddress
import logging
import hmac
import secrets
import httpx
import requests
import jwt
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="NEXOIN API")
api_router = APIRouter(prefix="/api")

# ---- Email (Emergent managed Resend) --------------------------------------
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "NEXOIN")
OWNER_EMAIL = os.environ.get("OWNER_EMAIL")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str, reply_to: Optional[str] = None) -> Optional[str]:
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if reply_to or EMAIL_REPLY_TO:
        payload["contact_email"] = reply_to or EMAIL_REPLY_TO
    async with httpx.AsyncClient(timeout=30) as http_client:
        resp = await http_client.post(
            f"{EMAIL_BASE_URL}/api/v1/email/send",
            headers={"X-Email-Key": EMAIL_KEY},
            json=payload,
        )
    resp.raise_for_status()
    return resp.json().get("id")


def _quote_email_html(quote: "Quote") -> str:
    def row(label, value):
        return (
            f'<tr><td style="padding:6px 16px 6px 0;color:#71717a;font-size:13px;'
            f'font-family:Arial,sans-serif;white-space:nowrap;vertical-align:top">{escape(label)}</td>'
            f'<td style="padding:6px 0;color:#0a0a0a;font-size:14px;font-family:Arial,sans-serif;'
            f'font-weight:600">{escape(str(value)) if value else "&mdash;"}</td></tr>'
        )
    rows = "".join([
        row("Company", quote.company),
        row("Contact", quote.name),
        row("Email", quote.email),
        row("Phone", quote.phone),
        row("Origin", quote.origin),
        row("Destination", quote.destination),
        row("Cargo type", quote.cargoType),
        row("Weight", f"{quote.weight} kg" if quote.weight else ""),
        row("Frequency", quote.frequency),
        row("Language", (quote.language or "en").upper()),
        row("Message", quote.message),
    ])
    return (
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        f'style="background:#f4f3ef;padding:32px"><tr><td align="center">'
        f'<table role="presentation" width="560" cellpadding="0" cellspacing="0" '
        f'style="background:#ffffff;border:1px solid #e4e4e7">'
        f'<tr><td style="background:#0a0a0a;padding:20px 28px">'
        f'<span style="color:#ffffff;font-family:Arial,sans-serif;font-size:20px;font-weight:800;'
        f'letter-spacing:-0.5px">NEXOIN<span style="color:#0044ff">.</span></span>'
        f'<div style="color:#a1a1aa;font-family:Arial,sans-serif;font-size:11px;'
        f'letter-spacing:2px;margin-top:4px">NEW QUOTE REQUEST</div></td></tr>'
        f'<tr><td style="padding:28px"><table role="presentation" width="100%" '
        f'cellpadding="0" cellspacing="0">{rows}</table></td></tr>'
        f'<tr><td style="padding:16px 28px;border-top:1px solid #e4e4e7">'
        f'<span style="color:#a1a1aa;font-family:Arial,sans-serif;font-size:12px">'
        f'Sent by {escape(EMAIL_FROM_NAME)} B2B Transport. This is an internal notification &mdash; '
        f'we never ask for passwords or payment details by email.</span></td></tr>'
        f'</table></td></tr></table>'
    )


_CONFIRM_COPY = {
    "en": {
        "subject": "We've received your NEXOIN quote request",
        "hi": "Hi",
        "body": "Thanks for reaching out to NEXOIN. We've received your request and will get back to you with a tailored quote as soon as possible.",
        "route": "Route",
        "cargo": "Cargo",
        "foot": "Sent by NEXOIN B2B Transport. We never ask for passwords or payment details by email.",
    },
    "fr": {
        "subject": "Nous avons bien recu votre demande de devis NEXOIN",
        "hi": "Bonjour",
        "body": "Merci d'avoir contacte NEXOIN. Nous avons bien recu votre demande et reviendrons vers vous avec un devis adapte dans les meilleurs delais.",
        "route": "Trajet",
        "cargo": "Marchandise",
        "foot": "Envoye par NEXOIN B2B Transport. Nous ne demandons jamais de mot de passe ou de coordonnees bancaires par e-mail.",
    },
    "de": {
        "subject": "Wir haben Ihre NEXOIN-Angebotsanfrage erhalten",
        "hi": "Hallo",
        "body": "Danke fuer Ihre Anfrage bei NEXOIN. Wir haben Ihre Anfrage erhalten und melden uns schnellstmoeglich mit einem passenden Angebot.",
        "route": "Strecke",
        "cargo": "Fracht",
        "foot": "Gesendet von NEXOIN B2B Transport. Wir fragen niemals per E-Mail nach Passwoertern oder Zahlungsdaten.",
    },
}


def _confirmation_email_html(quote: "Quote") -> str:
    c = _CONFIRM_COPY.get((quote.language or "en"), _CONFIRM_COPY["en"])
    return (
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        f'style="background:#f4f3ef;padding:32px"><tr><td align="center">'
        f'<table role="presentation" width="560" cellpadding="0" cellspacing="0" '
        f'style="background:#ffffff;border:1px solid #e4e4e7">'
        f'<tr><td style="background:#0a0a0a;padding:20px 28px">'
        f'<span style="color:#ffffff;font-family:Arial,sans-serif;font-size:20px;font-weight:800;'
        f'letter-spacing:-0.5px">NEXOIN<span style="color:#0044ff">.</span></span></td></tr>'
        f'<tr><td style="padding:28px;font-family:Arial,sans-serif;color:#0a0a0a">'
        f'<p style="font-size:16px;margin:0 0 12px">{escape(c["hi"])} {escape(quote.name)},</p>'
        f'<p style="font-size:14px;line-height:1.6;color:#3f3f46;margin:0 0 20px">{escape(c["body"])}</p>'
        f'<p style="font-size:13px;margin:0 0 6px"><strong>{escape(c["route"])}:</strong> '
        f'{escape(quote.origin)} &rarr; {escape(quote.destination)}</p>'
        f'<p style="font-size:13px;margin:0"><strong>{escape(c["cargo"])}:</strong> {escape(quote.cargoType)}</p>'
        f'</td></tr>'
        f'<tr><td style="padding:16px 28px;border-top:1px solid #e4e4e7">'
        f'<span style="color:#a1a1aa;font-family:Arial,sans-serif;font-size:12px">{escape(c["foot"])}</span>'
        f'</td></tr></table></td></tr></table>'
    )


def _contact_email_html(contact: "Contact") -> str:
    return (
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        f'style="background:#f4f3ef;padding:32px"><tr><td align="center">'
        f'<table role="presentation" width="560" cellpadding="0" cellspacing="0" '
        f'style="background:#ffffff;border:1px solid #e4e4e7">'
        f'<tr><td style="background:#0a0a0a;padding:20px 28px">'
        f'<span style="color:#ffffff;font-family:Arial,sans-serif;font-size:20px;font-weight:800">'
        f'NEXOIN<span style="color:#0044ff">.</span></span>'
        f'<div style="color:#a1a1aa;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;'
        f'margin-top:4px">NEW ENQUIRY</div></td></tr>'
        f'<tr><td style="padding:28px;font-family:Arial,sans-serif;color:#0a0a0a">'
        f'<p style="font-size:14px;margin:0 0 6px"><strong>Name:</strong> {escape(contact.name)}</p>'
        f'<p style="font-size:14px;margin:0 0 6px"><strong>Email:</strong> {escape(contact.email)}</p>'
        f'<p style="font-size:14px;margin:0 0 6px"><strong>Company:</strong> '
        f'{escape(contact.company) if contact.company else "&mdash;"}</p>'
        f'<p style="font-size:14px;margin:16px 0 0;line-height:1.6;color:#3f3f46">{escape(contact.message)}</p>'
        f'</td></tr>'
        f'<tr><td style="padding:16px 28px;border-top:1px solid #e4e4e7">'
        f'<span style="color:#a1a1aa;font-family:Arial,sans-serif;font-size:12px">'
        f'Sent by NEXOIN B2B Transport.</span></td></tr></table></td></tr></table>'
    )


# ---- Staff auth (email/password accounts + roles) -------------------------
import bcrypt

JWT_SECRET = os.environ["JWT_SECRET"]
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@nexoin.eu")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
JWT_ALGORITHM = "HS256"
ROLES = ("admin", "manager", "employee")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_token(user: dict) -> str:
    payload = {
        "sub": user["id"],
        "email": user["email"],
        "role": user["role"],
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(authorization: str = Header(default="")) -> dict:
    token = authorization[7:] if authorization.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = await db.users.find_one({"id": payload.get("sub")}, {"_id": 0, "password_hash": 0})
    if not user or user.get("status") == "disabled":
        raise HTTPException(status_code=401, detail="User not found or disabled")
    return user


def require_roles(*allowed):
    async def _dep(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in allowed:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return _dep


# Convenience dependencies
staff_any = require_roles(*ROLES)          # any authenticated staff
staff_manage = require_roles("admin", "manager")  # can mutate operational data
admin_only = require_roles("admin")        # admin-only (settings, user mgmt)
require_admin = admin_only                 # backward-compat alias


class LoginInput(BaseModel):
    email: EmailStr
    password: str


# ---- Brute-force protection (per-email login throttling) -------------------
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


async def check_lockout(email: str):
    doc = await db.login_attempts.find_one({"identifier": email})
    if not doc:
        return
    locked_until = doc.get("locked_until")
    if locked_until and datetime.now(timezone.utc) < datetime.fromisoformat(locked_until):
        raise HTTPException(status_code=429, detail="Too many failed attempts. Try again later.")


async def register_failed_login(email: str):
    doc = await db.login_attempts.find_one({"identifier": email})
    count = (doc.get("count", 0) if doc else 0) + 1
    update = {"count": count}
    if count >= MAX_LOGIN_ATTEMPTS:
        update["locked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)).isoformat()
        update["count"] = 0
    await db.login_attempts.update_one({"identifier": email}, {"$set": update}, upsert=True)


async def clear_login_attempts(email: str):
    await db.login_attempts.delete_one({"identifier": email})


class UserInput(BaseModel):
    email: EmailStr
    name: str
    role: str = "employee"
    password: Optional[str] = None
    status: Optional[str] = "active"


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str
    status: str = "active"
    created_at: Optional[str] = None


# ---- Object storage (CV uploads) ------------------------------------------
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "nexoin"
_storage_key = None

CV_EXTS = {"pdf", "doc", "docx"}
CV_MIME = {
    "pdf": "application/pdf",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_CV_BYTES = 5 * 1024 * 1024


def init_storage(force: bool = False):
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120,
        )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---- Models ---------------------------------------------------------------
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


class QuoteCreate(BaseModel):
    company: str
    name: str
    email: EmailStr
    phone: Optional[str] = ""
    origin: str
    destination: str
    cargoType: str
    weight: Optional[str] = ""
    frequency: Optional[str] = ""
    message: Optional[str] = ""
    language: Optional[str] = "en"


class Quote(QuoteCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: str = "new"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class QuoteStatusUpdate(BaseModel):
    status: str


class QuoteEdit(QuoteCreate):
    status: str = "new"


ALLOWED_STATUSES = {"new", "contacted", "closed"}


DEFAULT_SETTINGS = {
    "id": "site",
    "notification_email": "",
    "contact_email": "ops@nexoin.eu",
    "contact_phone": "+32 10 000 000",
    "contact_locations": "",
}


class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    notification_email: str = ""
    contact_email: str = "ops@nexoin.eu"
    contact_phone: str = "+32 10 000 000"
    contact_locations: str = ""


async def get_settings() -> dict:
    doc = await db.settings.find_one({"id": "site"}, {"_id": 0})
    if not doc:
        await db.settings.insert_one(dict(DEFAULT_SETTINGS))
        return dict(DEFAULT_SETTINGS)
    return doc


class ContactCreate(BaseModel):
    name: str
    email: EmailStr
    company: Optional[str] = ""
    message: str
    language: Optional[str] = "en"


class Contact(ContactCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ApplicationCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = ""
    role: str
    message: Optional[str] = ""
    language: Optional[str] = "en"
    cv_path: Optional[str] = ""
    cv_filename: Optional[str] = ""


class Application(ApplicationCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ---- Routes ---------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"message": "NEXOIN API - operational"}


@api_router.post("/auth/login")
async def auth_login(payload: LoginInput):
    email = payload.email.lower().strip()
    await check_lockout(email)
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        await register_failed_login(email)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.get("status") == "disabled":
        raise HTTPException(status_code=403, detail="Account disabled")
    await clear_login_attempts(email)
    safe = {k: v for k, v in user.items() if k not in ("_id", "password_hash")}
    return {"token": create_token(safe), "user": UserOut(**safe)}


@api_router.get("/auth/me", response_model=UserOut)
async def auth_me(user: dict = Depends(get_current_user)):
    return UserOut(**user)


# ---- Staff user management (admin only) -----------------------------------
@api_router.get("/users", response_model=List[UserOut])
async def list_users(_admin: dict = Depends(admin_only)):
    docs = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    return [UserOut(**d) for d in docs]


@api_router.post("/users", response_model=UserOut)
async def create_user(payload: UserInput, _admin: dict = Depends(admin_only)):
    if payload.role not in ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")
    if not payload.password or len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already exists")
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": payload.name,
        "role": payload.role,
        "status": payload.status or "active",
        "password_hash": hash_password(payload.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    return UserOut(**doc)


@api_router.put("/users/{user_id}", response_model=UserOut)
async def update_user(user_id: str, payload: UserInput, _admin: dict = Depends(admin_only)):
    existing = await db.users.find_one({"id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.role not in ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")
    new_email = payload.email.lower().strip()
    if await db.users.find_one({"email": new_email, "id": {"$ne": user_id}}):
        raise HTTPException(status_code=400, detail="Email already exists")
    update = {
        "email": new_email,
        "name": payload.name,
        "role": payload.role,
        "status": payload.status or "active",
    }
    # Guard: never lock out the last active admin
    if existing.get("role") == "admin" and (payload.role != "admin" or update["status"] == "disabled"):
        active_admins = await db.users.count_documents({"role": "admin", "status": {"$ne": "disabled"}})
        if active_admins <= 1:
            raise HTTPException(status_code=400, detail="Cannot demote or disable the last admin")
    if payload.password:
        if len(payload.password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        update["password_hash"] = hash_password(payload.password)
    await db.users.update_one({"id": user_id}, {"$set": update})
    merged = {**existing, **update}
    return UserOut(**{k: v for k, v in merged.items() if k not in ("_id", "password_hash")})


@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(admin_only)):
    existing = await db.users.find_one({"id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    if existing["id"] == admin["id"]:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    if existing.get("role") == "admin":
        active_admins = await db.users.count_documents({"role": "admin", "status": {"$ne": "disabled"}})
        if active_admins <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last admin")
    await db.users.delete_one({"id": user_id})
    return {"status": "deleted"}


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_obj = StatusCheck(**input.model_dump())
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.status_checks.insert_one(doc)
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    return status_checks


@api_router.post("/quotes", response_model=Quote)
async def create_quote(payload: QuoteCreate):
    quote = Quote(**payload.model_dump())
    await db.quotes.insert_one(quote.model_dump())
    logger.info("New quote request from %s (%s)", quote.company, quote.email)

    if EMAIL_KEY:
        settings = await get_settings()
        notify_to = settings.get("notification_email") or OWNER_EMAIL
        # Internal notification to the ops team.
        if notify_to:
            try:
                subject = f"New quote: {quote.company} - {quote.origin} to {quote.destination}"
                await send_email(to=notify_to, subject=subject, html=_quote_email_html(quote))
                logger.info("Quote notification email sent to %s", notify_to)
            except Exception as e:
                logger.error("Quote notification email failed: %s", str(e))
        # Instant confirmation to the customer who submitted the request.
        try:
            c = _CONFIRM_COPY.get((quote.language or "en"), _CONFIRM_COPY["en"])
            await send_email(to=quote.email, subject=c["subject"], html=_confirmation_email_html(quote))
            logger.info("Confirmation email sent to %s", quote.email)
        except Exception as e:
            logger.error("Confirmation email failed: %s", str(e))

    return quote


@api_router.get("/quotes", response_model=List[Quote])
async def list_quotes(_u: dict = Depends(staff_any)):
    quotes = await db.quotes.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Quote(**q) for q in quotes]


@api_router.patch("/quotes/{quote_id}", response_model=Quote)
async def update_quote_status(quote_id: str, payload: QuoteStatusUpdate, _u: dict = Depends(staff_any)):
    if payload.status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    result = await db.quotes.find_one_and_update(
        {"id": quote_id},
        {"$set": {"status": payload.status}},
        projection={"_id": 0},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Quote not found")
    return Quote(**result)


@api_router.put("/quotes/{quote_id}", response_model=Quote)
async def edit_quote(quote_id: str, payload: QuoteEdit, _u: dict = Depends(staff_manage)):
    if payload.status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    existing = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Quote not found")
    data = payload.model_dump()
    await db.quotes.update_one({"id": quote_id}, {"$set": data})
    return Quote(**{**existing, **data})


@api_router.delete("/quotes/{quote_id}")
async def delete_quote(quote_id: str, _u: dict = Depends(staff_manage)):
    res = await db.quotes.delete_one({"id": quote_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Quote not found")
    return {"status": "deleted"}


@api_router.get("/settings", response_model=Settings)
async def read_settings():
    return Settings(**await get_settings())


@api_router.put("/settings", response_model=Settings)
async def update_settings(payload: Settings, _u: dict = Depends(admin_only)):
    data = payload.model_dump()
    data["id"] = "site"
    await db.settings.update_one({"id": "site"}, {"$set": data}, upsert=True)
    return Settings(**data)


@api_router.post("/contacts", response_model=Contact)
async def create_contact(payload: ContactCreate):
    contact = Contact(**payload.model_dump())
    await db.contacts.insert_one(contact.model_dump())
    logger.info("New enquiry from %s (%s)", contact.name, contact.email)
    if EMAIL_KEY:
        settings = await get_settings()
        notify_to = settings.get("notification_email") or OWNER_EMAIL
        if notify_to:
            try:
                await send_email(
                    to=notify_to,
                    subject=f"New enquiry from {contact.name}",
                    html=_contact_email_html(contact),
                )
                logger.info("Contact notification email sent to %s", notify_to)
            except Exception as e:
                logger.error("Contact notification email failed: %s", str(e))
    return contact


@api_router.get("/contacts", response_model=List[Contact])
async def list_contacts(_u: dict = Depends(staff_any)):
    contacts = await db.contacts.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Contact(**c) for c in contacts]


@api_router.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: str, _u: dict = Depends(staff_manage)):
    res = await db.contacts.delete_one({"id": contact_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"status": "deleted"}


def _application_email_html(app_obj: "Application", cv_link: str = None) -> str:
    cv_row = ""
    if cv_link:
        cv_row = (
            f'<p style="margin:18px 0 0"><a href="{cv_link}" '
            f'style="display:inline-block;background:#0044ff;color:#ffffff;text-decoration:none;'
            f'font-family:Arial,sans-serif;font-size:13px;font-weight:700;padding:11px 20px">'
            f'Download CV</a></p>'
        )
    return (
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        f'style="background:#f4f3ef;padding:32px"><tr><td align="center">'
        f'<table role="presentation" width="560" cellpadding="0" cellspacing="0" '
        f'style="background:#ffffff;border:1px solid #e4e4e7">'
        f'<tr><td style="background:#0a0a0a;padding:20px 28px">'
        f'<span style="color:#ffffff;font-family:Arial,sans-serif;font-size:20px;font-weight:800">'
        f'NEXOIN<span style="color:#0044ff">.</span></span>'
        f'<div style="color:#a1a1aa;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;'
        f'margin-top:4px">NEW APPLICATION</div></td></tr>'
        f'<tr><td style="padding:28px;font-family:Arial,sans-serif;color:#0a0a0a">'
        f'<p style="font-size:14px;margin:0 0 6px"><strong>Name:</strong> {escape(app_obj.name)}</p>'
        f'<p style="font-size:14px;margin:0 0 6px"><strong>Email:</strong> {escape(app_obj.email)}</p>'
        f'<p style="font-size:14px;margin:0 0 6px"><strong>Phone:</strong> '
        f'{escape(app_obj.phone) if app_obj.phone else "&mdash;"}</p>'
        f'<p style="font-size:14px;margin:0 0 6px"><strong>Role:</strong> {escape(app_obj.role)}</p>'
        f'<p style="font-size:14px;margin:16px 0 0;line-height:1.6;color:#3f3f46">'
        f'{escape(app_obj.message) if app_obj.message else ""}</p>'
        f'{cv_row}'
        f'</td></tr>'
        f'<tr><td style="padding:16px 28px;border-top:1px solid #e4e4e7">'
        f'<span style="color:#a1a1aa;font-family:Arial,sans-serif;font-size:12px">'
        f'Sent by NEXOIN B2B Transport.</span></td></tr></table></td></tr></table>'
    )


_APPLY_CONFIRM = {
    "en": {
        "subject": "We've received your application - NEXOIN",
        "hi": "Hi",
        "body": "Thanks for your interest in joining NEXOIN. We've received your application and will get back to you.",
        "role": "Role",
        "foot": "Sent by NEXOIN B2B Transport. We never ask for passwords or payment details by email.",
    },
    "fr": {
        "subject": "Nous avons bien recu votre candidature - NEXOIN",
        "hi": "Bonjour",
        "body": "Merci de votre interet pour NEXOIN. Nous avons bien recu votre candidature et reviendrons vers vous.",
        "role": "Poste",
        "foot": "Envoye par NEXOIN B2B Transport. Nous ne demandons jamais de mot de passe ou de coordonnees bancaires par e-mail.",
    },
    "de": {
        "subject": "Wir haben Ihre Bewerbung erhalten - NEXOIN",
        "hi": "Hallo",
        "body": "Danke fuer Ihr Interesse an NEXOIN. Wir haben Ihre Bewerbung erhalten und melden uns bei Ihnen.",
        "role": "Position",
        "foot": "Gesendet von NEXOIN B2B Transport. Wir fragen niemals per E-Mail nach Passwoertern oder Zahlungsdaten.",
    },
}


def _application_confirmation_html(app_obj: "Application") -> str:
    ac = _APPLY_CONFIRM.get((app_obj.language or "en"), _APPLY_CONFIRM["en"])
    return (
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        f'style="background:#f4f3ef;padding:32px"><tr><td align="center">'
        f'<table role="presentation" width="560" cellpadding="0" cellspacing="0" '
        f'style="background:#ffffff;border:1px solid #e4e4e7">'
        f'<tr><td style="background:#0a0a0a;padding:20px 28px">'
        f'<span style="color:#ffffff;font-family:Arial,sans-serif;font-size:20px;font-weight:800">'
        f'NEXOIN<span style="color:#0044ff">.</span></span></td></tr>'
        f'<tr><td style="padding:28px;font-family:Arial,sans-serif;color:#0a0a0a">'
        f'<p style="font-size:16px;margin:0 0 12px">{escape(ac["hi"])} {escape(app_obj.name)},</p>'
        f'<p style="font-size:14px;line-height:1.6;color:#3f3f46;margin:0 0 16px">{escape(ac["body"])}</p>'
        f'<p style="font-size:13px;margin:0"><strong>{escape(ac["role"])}:</strong> {escape(app_obj.role)}</p>'
        f'</td></tr>'
        f'<tr><td style="padding:16px 28px;border-top:1px solid #e4e4e7">'
        f'<span style="color:#a1a1aa;font-family:Arial,sans-serif;font-size:12px">{escape(ac["foot"])}</span>'
        f'</td></tr></table></td></tr></table>'
    )


@api_router.post("/applications", response_model=Application)
async def create_application(payload: ApplicationCreate, request: Request):
    application = Application(**payload.model_dump())
    await db.applications.insert_one(application.model_dump())
    logger.info("New application from %s (%s) for %s", application.name, application.email, application.role)
    if EMAIL_KEY:
        settings = await get_settings()
        notify_to = settings.get("notification_email") or OWNER_EMAIL
        cv_link = None
        if application.cv_path:
            origin = (request.headers.get("origin") or str(request.base_url)).rstrip("/")
            dl = secrets.token_urlsafe(20)
            await db.files.update_one({"storage_path": application.cv_path}, {"$set": {"download_token": dl}})
            cv_link = f"{origin}/api/applications/cv/{application.cv_path}?t={dl}"
        if notify_to:
            try:
                await send_email(
                    to=notify_to,
                    subject=f"New application: {application.role} - {application.name}",
                    html=_application_email_html(application, cv_link),
                )
                logger.info("Application notification sent to %s", notify_to)
            except Exception as e:
                logger.error("Application notification failed: %s", str(e))
        try:
            await send_email(
                to=application.email,
                subject=_APPLY_CONFIRM.get((application.language or "en"), _APPLY_CONFIRM["en"])["subject"],
                html=_application_confirmation_html(application),
            )
            logger.info("Applicant confirmation sent to %s", application.email)
        except Exception as e:
            logger.error("Applicant confirmation failed: %s", str(e))
    return application


@api_router.get("/applications", response_model=List[Application])
async def list_applications(_u: dict = Depends(staff_any)):
    apps = await db.applications.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Application(**a) for a in apps]


@api_router.delete("/applications/{application_id}")
async def delete_application(application_id: str, _u: dict = Depends(staff_manage)):
    res = await db.applications.delete_one({"id": application_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Application not found")
    return {"status": "deleted"}


@api_router.post("/upload/cv")
async def upload_cv(file: UploadFile = File(...)):
    ext = (file.filename.rsplit(".", 1)[-1] if "." in file.filename else "").lower()
    if ext not in CV_EXTS:
        raise HTTPException(status_code=400, detail="Only PDF, DOC or DOCX files are allowed")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > MAX_CV_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")
    path = f"{APP_NAME}/cv/{uuid.uuid4()}.{ext}"
    content_type = CV_MIME.get(ext, file.content_type or "application/octet-stream")
    try:
        result = put_object(path, data, content_type)
    except Exception as e:
        logger.error("CV upload failed: %s", str(e))
        raise HTTPException(status_code=502, detail="Upload failed, please try again")
    stored_path = result.get("path", path)
    await db.files.insert_one({
        "id": str(uuid.uuid4()),
        "storage_path": stored_path,
        "original_filename": file.filename,
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"path": stored_path, "filename": file.filename, "content_type": content_type, "size": result.get("size", len(data))}


@api_router.get("/applications/cv/{path:path}")
async def download_cv(path: str, authorization: str = Header(default=""), auth: str = Query(default=None), t: str = Query(default=None)):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    authorized = False
    if t and record and record.get("download_token") and hmac.compare_digest(t, record["download_token"]):
        authorized = True
    else:
        token = authorization[7:] if authorization.startswith("Bearer ") else (auth or None)
        if token:
            try:
                payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
                authorized = payload.get("role") in ROLES
            except jwt.PyJWTError:
                authorized = False
    if not authorized:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        data, content_type = get_object(path)
    except Exception:
        raise HTTPException(status_code=404, detail="File not found")
    ct = (record or {}).get("content_type", content_type)
    fname = (record or {}).get("original_filename", "cv")
    return Response(content=data, media_type=ct, headers={"Content-Disposition": f'attachment; filename="{fname}"'})


class ClientInput(BaseModel):
    company_name: str
    contact_person: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    vat_number: Optional[str] = ""
    notes: Optional[str] = ""
    status: Optional[str] = "active"


class Client(ClientInput):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class VehicleInput(BaseModel):
    make: str
    model: Optional[str] = ""
    registration: Optional[str] = ""
    vin: Optional[str] = ""
    year: Optional[str] = ""
    vehicle_type: Optional[str] = ""
    cargo_capacity: Optional[str] = ""
    max_weight: Optional[str] = ""
    mileage: Optional[str] = ""
    inspection_expiry: Optional[str] = ""
    insurance_expiry: Optional[str] = ""
    assigned_driver: Optional[str] = ""
    notes: Optional[str] = ""
    status: Optional[str] = "available"


class Vehicle(VehicleInput):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


def _crud_routes(name: str, coll, model, input_model):
    @api_router.post(f"/{name}", response_model=model, name=f"create_{name}")
    async def _create(payload: input_model, _u: dict = Depends(staff_manage)):
        obj = model(**payload.model_dump())
        await coll.insert_one(obj.model_dump())
        return obj

    @api_router.get(f"/{name}", response_model=List[model], name=f"list_{name}")
    async def _list(_u: dict = Depends(staff_any)):
        docs = await coll.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
        return [model(**d) for d in docs]

    @api_router.put(f"/{name}/{{item_id}}", response_model=model, name=f"update_{name}")
    async def _update(item_id: str, payload: input_model, _u: dict = Depends(staff_manage)):
        existing = await coll.find_one({"id": item_id}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Not found")
        data = payload.model_dump()
        await coll.update_one({"id": item_id}, {"$set": data})
        return model(**{**existing, **data})

    @api_router.delete(f"/{name}/{{item_id}}", name=f"delete_{name}")
    async def _delete(item_id: str, _u: dict = Depends(staff_manage)):
        res = await coll.delete_one({"id": item_id})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Not found")
        return {"status": "deleted"}


_crud_routes("clients", db.clients, Client, ClientInput)
_crud_routes("vehicles", db.vehicles, Vehicle, VehicleInput)


@api_router.get("/dashboard")
async def dashboard(_u: dict = Depends(staff_any)):
    return {
        "clients": await db.clients.count_documents({}),
        "clients_active": await db.clients.count_documents({"status": "active"}),
        "vehicles": await db.vehicles.count_documents({}),
        "vehicles_available": await db.vehicles.count_documents({"status": "available"}),
        "quotes": await db.quotes.count_documents({}),
        "quotes_new": await db.quotes.count_documents({"status": "new"}),
        "applications": await db.applications.count_documents({}),
        "contacts": await db.contacts.count_documents({}),
        "recent_clients": await db.clients.find({}, {"_id": 0}).sort("created_at", -1).to_list(5),
        "recent_quotes": await db.quotes.find({}, {"_id": 0}).sort("created_at", -1).to_list(5),
    }


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


async def seed_admin():
    """Idempotently ensure a default admin account exists and matches .env."""
    if not ADMIN_PASSWORD:
        logger.warning("ADMIN_PASSWORD not set; skipping admin seed")
        return
    email = ADMIN_EMAIL.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing is None:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": email,
            "name": "Administrator",
            "role": "admin",
            "status": "active",
            "password_hash": hash_password(ADMIN_PASSWORD),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Seeded default admin account: %s", email)
    elif not verify_password(ADMIN_PASSWORD, existing.get("password_hash", "")):
        await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(ADMIN_PASSWORD), "role": "admin", "status": "active"}})
        logger.info("Updated default admin password from .env")


@app.on_event("startup")
async def _startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.login_attempts.create_index("identifier", unique=True)
        await seed_admin()
    except Exception as e:
        logger.error("Admin seed failed: %s", str(e))
    try:
        init_storage()
        logger.info("Object storage initialized")
    except Exception as e:
        logger.error("Storage init failed: %s", str(e))


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
