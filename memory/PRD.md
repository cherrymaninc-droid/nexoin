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

## Backlog
- P1: Real email notification on new quote (Resend) — currently DB-only, no email sent.
- P1: Admin view to browse submitted quotes.
- P2: Interactive European route map / globe in Network section.
- P2: Cookie/consent + legal page content.
