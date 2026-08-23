# NEXOIN — Product Requirements Document

## Original Problem Statement
Build the official website for **NEXOIN**, a modern European B2B transport & logistics startup. Brand name "NEXOIN" must appear consistently everywhere (logo, header, nav, hero, footer, contact, SEO/OG metadata, favicon, mobile nav) and remain identical across FR/DE/EN — never translated. Typographic minimalist logo, no generic truck/road icons. Premium, precise, technology-oriented, scalable identity. Awwwards-level art direction with kinetic hero, masked reveals, editorial marquee, numbered manifesto chapters, deliberate photography, smooth momentum scrolling and purposeful motion.

## User Choices
- Pages: Landing + dedicated Quote/Devis page.
- Other choices (email, default language, theme, colors) skipped → defaults applied: French default language, dark premium theme, brand palette chosen by design agent, quote form persists to MongoDB (no email integration).

## Architecture
- **Frontend**: React 19 + React Router 7, Tailwind, framer-motion (reveals/parallax/masked hero), lenis (smooth scroll), sonner (toasts), Shadcn UI (form primitives). i18n via LanguageContext + translations.js (FR/DE/EN, persisted to localStorage).
- **Backend**: FastAPI + Motor/MongoDB. Routes prefixed `/api`.
- **Fonts**: Cabinet Grotesk (display), Manrope (body), JetBrains Mono (technical labels).

## Implemented (2026-08-23)
- Landing: kinetic masked-line hero with parallax bg, editorial marquee, stats strip, interactive services accordion with clipped image frames, numbered manifesto chapters (blueprint grid), network section with parallax highway image + European hubs, CTA + footer.
- Dedicated `/quote` (Devis) page: split sticky layout, Shadcn form (company, name, email, phone, origin, destination, cargo type, weight, frequency, message), submit → success state + toast, redirect home.
- Trilingual FR/DE/EN switcher (desktop + mobile) on both pages; NEXOIN wordmark never translated.
- SEO/OG/Twitter metadata, SVG favicon, theme-color, grain overlay, custom scrollbar.
- Backend: `POST /api/quotes`, `GET /api/quotes`, `GET /api/status`. Quotes persisted to MongoDB (verified).

## Verified
- Backend: quote create + list via curl (2 records persisted).
- Frontend: hero/services/manifesto/network/footer render; quote form filled + submitted successfully; language switch EN↔FR↔DE works. No console errors.

## Implemented (2026-08-23, iteration 2)
- **Light theme**: entire site converted from dark to a warm light theme (#f4f3ef paper, #0a0a0a text, #0044ff accent, dark marquee + footer as intentional contrast bands).
- **Admin console** at `/admin` (open URL, no auth per user choice): lists all quotes, search, status filter tabs (all/new/contacted/closed), and per-quote status update (PATCH /api/quotes/{id}).
- **Email alerts**: on new quote, backend sends an internal notification via Emergent-managed Resend (`send_email` + guardrail gate). Send verified working with test recipient; wrapped in try/except so quote save never breaks.
- **Startup repositioning**: removed Warehousing service; services now FTL / Groupage & LTL / Time-Critical / Cross-Border Network (asset-light carrier network). Stats reframed to startup-appropriate (<2h quote, 24/7 tracking, 100% vetted carriers, 1 dedicated contact). Manifesto/network copy de-emphasise owned facilities. All 3 languages updated.

## Known Pending
- OWNER_EMAIL is a placeholder (`ops@nexoin.eu`, undeliverable domain → send returns 422). Needs the user's REAL notification email in backend/.env for alerts to actually deliver.
- `/admin` is unprotected (open URL) per user choice.

## Backlog
- P1: Set real OWNER_EMAIL so alerts deliver.
- P2: Optional password protection for /admin.
- P2: Interactive European route map in Network section.
- P2: Cookie/consent + legal page content.
