# LeadForge AI — Product Requirements Document

## Overview
LeadForge AI is a mobile-first (React Native + Expo) freelancer lead generation tool. It pulls client opportunities from Reddit, uses AI to qualify them, generates personalised outreach messages, manages a mini CRM, and produces PDF invoices.

## Stack
- **Frontend:** Expo SDK 54, expo-router (file-based routing), TypeScript, React Native
- **Backend:** FastAPI + Motor (async MongoDB), JWT auth (Bearer tokens), httpx for Reddit, emergentintegrations for Gemini
- **AI:** Gemini 3 Flash Preview via Emergent Universal LLM Key (lowest-cost option per user choice)
- **DB:** MongoDB (collections: users, leads, user_leads, messages, invoices)

## Implemented Modules (MVP)

### 1. Authentication (JWT)
- `POST /api/auth/register` — email + password + name → returns JWT (30 day expiry)
- `POST /api/auth/login` — returns JWT
- `GET /api/auth/me` — current user
- `PUT /api/auth/profile` — update profession/skills/experience/portfolio/pricing/tone
- `POST /api/auth/check-in` — daily streak update
- `POST /api/auth/toggle-premium` — flip free/premium feature flag

### 2. Profile Setup (Onboarding wizard)
Profession chips · multi-select skills · experience level · portfolio links · pricing range · outreach tone (Formal/Casual/Persuasive)

### 3. Reddit Lead Fetching
- `POST /api/leads/fetch` — pulls from r/forhire, r/freelance, r/slavelabour via public JSON
- Keyword filter: hire, looking for, need, designer, developer
- 72h recency window
- **Demo fallback:** if Reddit blocks the request (e.g., dev container IP), backend serves 10 realistic seed leads marked `demo_mode: true`. In production deployments with un-blocked IPs, real Reddit data flows through.

### 4. AI Lead Qualification (Gemini 3 Flash)
For each post: returns score (0–100), intent (High/Medium/Low), one-line summary. Cached in MongoDB to avoid re-scoring.

### 5. Lead Feed UI
Cards with subreddit tag · score badge (colour-coded) · intent pill · time-ago · AI summary · status chip if saved.

### 6. AI Message Generator
Returns Reddit DM (4-6 lines) + Email (with subject line). Personalised with user profile + lead content + selected tone. Editable. Copy-to-clipboard with haptic feedback. Tone can be re-selected to regenerate.

### 7. Mini CRM
Kanban-style horizontal tabs (New / Saved / Contacted / Replied / Closed) with counts. Per-lead notes. Status updates award XP (contacted +10, replied +20, closed +50).

### 8. Invoice Generator
Form (client name, description, amount, date) → backend creates invoice → frontend renders PDF via `expo-print` and shares via `expo-sharing`. Past invoices listed and re-shareable.

### 9. Paywall (Feature Flag)
- Free tier: 10 leads/day, 5 AI messages/day
- Premium tier: 1000/day (effectively unlimited)
- Toggle via `is_premium` flag (no payment integration per MVP scope)

### 10. Gamification
- XP awarded for: fetching leads (+2 each), generating messages (+5), status transitions (+10/+20/+50)
- Daily streak via `/auth/check-in`
- Top-20 leaderboard by XP on Profile screen

## Design System
Per `/app/design_guidelines.json` — "Tactical Minimalism" archetype:
- Background `#0A0A0A`, surface `#141414`, border `#262626`
- Primary: Forge Orange `#FF5C00`
- Fonts: Sora (heading), Geist (body), Geist Mono (scores/XP)
- 1px borders, no soft shadows, kebab-case testIDs on all interactive elements

## Tech Decisions / Notes
- **Mobile-first:** Bearer tokens (not cookies) for auth — works with AsyncStorage
- **Reddit:** Public JSON endpoints (no OAuth) → graceful demo fallback
- **PDFs:** `expo-print` HTML→PDF + `expo-sharing` for cross-platform share sheet
- **No payment integration** in MVP per spec section 10

## Future / Backlog
- Real Stripe integration for premium upgrade
- Reddit OAuth credentials (when user provides them) for un-blocked access
- Push notifications for new high-score leads
- LinkedIn / Upwork / X integrations
- Web dashboard (current spec is mobile-only)

## Files of Interest
- `backend/server.py` — single-file FastAPI app
- `frontend/app/_layout.tsx` — root layout (fonts, AuthProvider)
- `frontend/app/(tabs)/{feed,crm,invoice,profile}.tsx` — tab screens
- `frontend/app/lead/[id].tsx`, `frontend/app/message/[id].tsx`, `frontend/app/upgrade.tsx` — modal/stack screens
- `frontend/src/contexts/AuthContext.tsx` — auth state
- `frontend/src/lib/api.ts` — API client with token injection
- `frontend/src/theme.ts` — design tokens
