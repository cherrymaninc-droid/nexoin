from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import ipaddress
import logging
import httpx
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone


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


class Application(ApplicationCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ---- Routes ---------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"message": "NEXOIN API - operational"}


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
async def list_quotes():
    quotes = await db.quotes.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Quote(**q) for q in quotes]


@api_router.patch("/quotes/{quote_id}", response_model=Quote)
async def update_quote_status(quote_id: str, payload: QuoteStatusUpdate):
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
async def edit_quote(quote_id: str, payload: QuoteEdit):
    if payload.status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    existing = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Quote not found")
    data = payload.model_dump()
    await db.quotes.update_one({"id": quote_id}, {"$set": data})
    return Quote(**{**existing, **data})


@api_router.delete("/quotes/{quote_id}")
async def delete_quote(quote_id: str):
    res = await db.quotes.delete_one({"id": quote_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Quote not found")
    return {"status": "deleted"}


@api_router.get("/settings", response_model=Settings)
async def read_settings():
    return Settings(**await get_settings())


@api_router.put("/settings", response_model=Settings)
async def update_settings(payload: Settings):
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
async def list_contacts():
    contacts = await db.contacts.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Contact(**c) for c in contacts]


@api_router.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: str):
    res = await db.contacts.delete_one({"id": contact_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"status": "deleted"}


def _application_email_html(app_obj: "Application") -> str:
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
        f'</td></tr>'
        f'<tr><td style="padding:16px 28px;border-top:1px solid #e4e4e7">'
        f'<span style="color:#a1a1aa;font-family:Arial,sans-serif;font-size:12px">'
        f'Sent by NEXOIN B2B Transport.</span></td></tr></table></td></tr></table>'
    )


@api_router.post("/applications", response_model=Application)
async def create_application(payload: ApplicationCreate):
    application = Application(**payload.model_dump())
    await db.applications.insert_one(application.model_dump())
    logger.info("New application from %s (%s) for %s", application.name, application.email, application.role)
    if EMAIL_KEY:
        settings = await get_settings()
        notify_to = settings.get("notification_email") or OWNER_EMAIL
        if notify_to:
            try:
                await send_email(
                    to=notify_to,
                    subject=f"New application: {application.role} - {application.name}",
                    html=_application_email_html(application),
                )
                logger.info("Application notification sent to %s", notify_to)
            except Exception as e:
                logger.error("Application notification failed: %s", str(e))
    return application


@api_router.get("/applications", response_model=List[Application])
async def list_applications():
    apps = await db.applications.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Application(**a) for a in apps]


@api_router.delete("/applications/{application_id}")
async def delete_application(application_id: str):
    res = await db.applications.delete_one({"id": application_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Application not found")
    return {"status": "deleted"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
