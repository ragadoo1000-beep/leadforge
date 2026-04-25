from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import re
import uuid
import json
import logging
import bcrypt
import jwt
import httpx
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

from emergentintegrations.llm.chat import LlmChat, UserMessage

# ============== Setup ==============
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = "HS256"
EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']

app = FastAPI(title="LeadForge AI API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ============== Helpers ==============
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    if not creds or not creds.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ============== Models ==============
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    profession: Optional[str] = None
    skills: Optional[List[str]] = None
    experience_level: Optional[Literal["Beginner", "Intermediate", "Advanced"]] = None
    portfolio_links: Optional[List[str]] = None
    pricing_range: Optional[str] = None
    tone_preference: Optional[Literal["Formal", "Casual", "Persuasive"]] = None


class FetchLeadsIn(BaseModel):
    subreddits: List[str] = Field(default_factory=lambda: ["forhire", "freelance", "slavelabour"])
    keywords: List[str] = Field(default_factory=lambda: ["hire", "looking for", "need", "designer", "developer"])
    hours: int = 72


class GenerateMessageIn(BaseModel):
    lead_id: str
    tone: Optional[Literal["Formal", "Casual", "Persuasive"]] = None


class SaveLeadIn(BaseModel):
    lead_id: str
    status: Literal["new", "saved", "contacted", "replied", "closed"] = "saved"
    notes: Optional[str] = ""


class UpdateUserLeadIn(BaseModel):
    status: Optional[Literal["new", "saved", "contacted", "replied", "closed"]] = None
    notes: Optional[str] = None


class InvoiceIn(BaseModel):
    client_name: str
    description: str
    amount: float
    date: Optional[str] = None


# ============== Auth Endpoints ==============
@api_router.post("/auth/register")
async def register(payload: RegisterIn):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": email,
        "name": payload.name,
        "password_hash": hash_password(payload.password),
        "profession": "",
        "skills": [],
        "experience_level": "Beginner",
        "portfolio_links": [],
        "pricing_range": "",
        "tone_preference": "Casual",
        "is_premium": False,
        "xp": 0,
        "streak": 0,
        "last_active_date": None,
        "messages_today": 0,
        "leads_today": 0,
        "today_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "onboarded": False,
    }
    await db.users.insert_one(user_doc)
    token = create_token(user_id, email)
    user_doc.pop("_id", None)
    user_doc.pop("password_hash", None)
    return {"token": token, "user": user_doc}


@api_router.post("/auth/login")
async def login(payload: LoginIn):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"], email)
    user.pop("_id", None)
    user.pop("password_hash", None)
    return {"token": token, "user": user}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@api_router.put("/auth/profile")
async def update_profile(payload: ProfileUpdate, user: dict = Depends(get_current_user)):
    update = {k: v for k, v in payload.dict().items() if v is not None}
    if update:
        update["onboarded"] = True
        await db.users.update_one({"id": user["id"]}, {"$set": update})
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return fresh


@api_router.post("/auth/toggle-premium")
async def toggle_premium(user: dict = Depends(get_current_user)):
    new_val = not user.get("is_premium", False)
    await db.users.update_one({"id": user["id"]}, {"$set": {"is_premium": new_val}})
    return {"is_premium": new_val}


# ============== Reddit Fetching ==============
async def fetch_reddit_posts(subreddit: str, hours: int = 72) -> List[dict]:
    url = f"https://www.reddit.com/r/{subreddit}/new.json?limit=25&raw_json=1"
    headers = {
        "User-Agent": "web:LeadForgeAI:v1.0 (by /u/leadforge_app)",
        "Accept": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as hc:
            r = await hc.get(url, headers=headers)
            if r.status_code != 200:
                logger.warning(f"Reddit {subreddit} returned {r.status_code}")
                return []
            try:
                data = r.json()
            except Exception:
                logger.warning(f"Reddit {subreddit} non-JSON response")
                return []
        cutoff = datetime.now(timezone.utc).timestamp() - hours * 3600
        out = []
        for child in data.get("data", {}).get("children", []):
            p = child.get("data", {})
            if p.get("created_utc", 0) < cutoff:
                continue
            out.append({
                "title": p.get("title", ""),
                "content": p.get("selftext", "")[:1500],
                "subreddit": subreddit,
                "url": f"https://reddit.com{p.get('permalink', '')}",
                "author": p.get("author", "[deleted]"),
                "created_utc": p.get("created_utc", 0),
                "reddit_id": p.get("id", ""),
            })
        return out
    except Exception as e:
        logger.error(f"Reddit fetch error {subreddit}: {e}")
        return []


def keyword_match(post: dict, keywords: List[str]) -> bool:
    text = (post.get("title", "") + " " + post.get("content", "")).lower()
    return any(kw.lower() in text for kw in keywords)


# Demo seed leads — used when Reddit is unreachable (e.g., dev container IP blocked)
DEMO_LEADS = [
    {
        "title": "[Hiring] Looking for a React Native developer for fitness app — $3k-5k",
        "content": "We're a YC-backed startup building a fitness tracking app. Need a senior RN dev to help us ship our MVP in 6 weeks. Budget is $3-5k for the contract. Must have experience with HealthKit and Reanimated. DM me your portfolio and rate.",
        "subreddit": "forhire",
        "author": "founder_jake",
        "permalink": "/r/forhire/comments/demo1",
        "id": "demo_lead_1",
    },
    {
        "title": "[HIRING] Need a logo designer for SaaS product launching next month",
        "content": "Launching a B2B analytics SaaS in 3 weeks. Need a clean, modern logo + minimal brand guide (colors, typography). Budget $400-600. Looking for someone who can deliver 3 concepts within a week. Show me your latest work.",
        "subreddit": "forhire",
        "author": "saas_builder",
        "permalink": "/r/forhire/comments/demo2",
        "id": "demo_lead_2",
    },
    {
        "title": "Looking for a copywriter to write landing page + 5 emails",
        "content": "Need conversion-focused copy for a new productivity tool. Landing page (hero, features, pricing, FAQ) plus 5-email onboarding sequence. SaaS experience strongly preferred. Pay: $800 fixed.",
        "subreddit": "freelance",
        "author": "ops_mary",
        "permalink": "/r/freelance/comments/demo3",
        "id": "demo_lead_3",
    },
    {
        "title": "Need help with SEO audit + technical fixes for ecommerce store",
        "content": "Shopify store doing $20k/mo. Traffic is flat. Looking for an SEO consultant to do a full audit, fix technical issues, and recommend a content strategy. Hourly or project-based.",
        "subreddit": "freelance",
        "author": "shopify_owner",
        "permalink": "/r/freelance/comments/demo4",
        "id": "demo_lead_4",
    },
    {
        "title": "[HIRING] UI/UX designer for a Web3 dashboard (Figma)",
        "content": "Need a designer to redesign our dashboard. ~8-10 screens. Crypto/DeFi experience is a big plus. We have a vague brand kit but want fresh eyes. $1500-2500.",
        "subreddit": "forhire",
        "author": "defi_dan",
        "permalink": "/r/forhire/comments/demo5",
        "id": "demo_lead_5",
    },
    {
        "title": "Looking for a video editor for short-form content (TikTok/Reels)",
        "content": "Personal brand growing fast. Need someone to cut 4 short-form videos per week from long podcast recordings. Add captions, b-roll, hooks. ~$300/week ongoing.",
        "subreddit": "forhire",
        "author": "creator_alex",
        "permalink": "/r/forhire/comments/demo6",
        "id": "demo_lead_6",
    },
    {
        "title": "Need a Python developer to build a data scraping pipeline",
        "content": "Want to scrape 5 e-commerce sites daily, store in Postgres, and email a summary. Should take 1-2 weeks. Budget $1k-1.5k. Bonus if you know AWS.",
        "subreddit": "freelance",
        "author": "data_curious",
        "permalink": "/r/freelance/comments/demo7",
        "id": "demo_lead_7",
    },
    {
        "title": "[HIRING] Full-stack developer for a 3-month MVP build",
        "content": "Building a marketplace for local services. Stack: Next.js + Supabase. Need someone who can own backend + frontend. Budget $8k for 3 months part-time.",
        "subreddit": "forhire",
        "author": "marketplace_mike",
        "permalink": "/r/forhire/comments/demo8",
        "id": "demo_lead_8",
    },
    {
        "title": "Looking for a freelancer for one-off Webflow site",
        "content": "Need a 5-page Webflow site for my consulting business. Have rough wireframes and brand assets. Budget $700.",
        "subreddit": "slavelabour",
        "author": "consult_carla",
        "permalink": "/r/slavelabour/comments/demo9",
        "id": "demo_lead_9",
    },
    {
        "title": "Need a mobile app developer for a meditation app — long term",
        "content": "Indie founder. Built v1 myself but need help scaling. Looking for a Flutter/RN dev for ongoing weekly work, 10-15 hours. $40-60/hr depending on experience.",
        "subreddit": "forhire",
        "author": "mind_founder",
        "permalink": "/r/forhire/comments/demo10",
        "id": "demo_lead_10",
    },
]


def get_demo_posts() -> List[dict]:
    """Return demo leads with current timestamps and unique IDs per call."""
    out = []
    now = datetime.now(timezone.utc).timestamp()
    for i, p in enumerate(DEMO_LEADS):
        out.append({
            "title": p["title"],
            "content": p["content"],
            "subreddit": p["subreddit"],
            "url": f"https://reddit.com{p['permalink']}",
            "author": p["author"],
            "created_utc": now - (i * 1800 + 600),  # spread 30 min apart
            "reddit_id": f"{p['id']}_{int(now)}",
        })
    return out


# ============== AI Lead Scoring ==============
async def ai_score_lead(title: str, body: str) -> dict:
    """Score a lead using Gemini Flash. Returns {score, intent, summary}."""
    system = (
        "You are a lead qualification AI for freelancers. Analyze Reddit posts where "
        "people might be hiring. Return ONLY valid JSON, no markdown, no extra text."
    )
    prompt = f"""Analyze this Reddit post and return JSON with these exact keys:
- "score": integer 0-100 (lead quality; high if clear requirement, budget mentioned, urgency)
- "intent": "High" | "Medium" | "Low"
- "summary": one short sentence describing the client need (max 20 words)

Post Title: {title}
Post Body: {body[:1200]}

Return ONLY JSON like: {{"score": 85, "intent": "High", "summary": "..."}}"""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"score-{uuid.uuid4()}",
            system_message=system,
        ).with_model("gemini", "gemini-3-flash-preview")
        resp = await chat.send_message(UserMessage(text=prompt))
        # Extract JSON
        m = re.search(r'\{.*\}', resp, re.DOTALL)
        if not m:
            return {"score": 50, "intent": "Medium", "summary": title[:100]}
        result = json.loads(m.group(0))
        return {
            "score": int(max(0, min(100, result.get("score", 50)))),
            "intent": result.get("intent", "Medium"),
            "summary": str(result.get("summary", title))[:200],
        }
    except Exception as e:
        logger.error(f"AI scoring error: {e}")
        return {"score": 50, "intent": "Medium", "summary": title[:100]}


# ============== Lead Endpoints ==============
def reset_daily_counters_if_needed(user: dict) -> dict:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if user.get("today_date") != today:
        return {"today_date": today, "messages_today": 0, "leads_today": 0}
    return {}


@api_router.post("/leads/fetch")
async def fetch_leads(payload: FetchLeadsIn, user: dict = Depends(get_current_user)):
    # Daily reset
    reset = reset_daily_counters_if_needed(user)
    if reset:
        await db.users.update_one({"id": user["id"]}, {"$set": reset})
        user.update(reset)

    # Free tier: max 10 leads/day
    is_premium = user.get("is_premium", False)
    leads_today = user.get("leads_today", 0)
    daily_cap = 10 if not is_premium else 1000
    remaining = max(0, daily_cap - leads_today)
    if remaining == 0:
        return {"leads": [], "remaining": 0, "limit_reached": True}

    # Fetch from Reddit
    all_posts = []
    for sr in payload.subreddits[:5]:
        posts = await fetch_reddit_posts(sr, payload.hours)
        all_posts.extend(posts)

    # Demo fallback if Reddit unreachable from this environment
    demo_mode = False
    if not all_posts:
        all_posts = get_demo_posts()
        demo_mode = True

    # Filter by keywords
    filtered = [p for p in all_posts if keyword_match(p, payload.keywords)]
    if demo_mode and not filtered:
        # Demo data should always pass keyword filter; bypass if needed
        filtered = all_posts
    # Dedupe against existing leads
    existing_ids = set()
    if filtered:
        existing = await db.leads.find(
            {"reddit_id": {"$in": [p["reddit_id"] for p in filtered]}},
            {"reddit_id": 1, "_id": 0}
        ).to_list(500)
        existing_ids = {e["reddit_id"] for e in existing}
    new_posts = [p for p in filtered if p["reddit_id"] not in existing_ids][:remaining]

    # Score each new post via AI
    saved_leads = []
    for p in new_posts:
        ai = await ai_score_lead(p["title"], p["content"])
        lead_doc = {
            "id": str(uuid.uuid4()),
            "title": p["title"],
            "content": p["content"],
            "subreddit": p["subreddit"],
            "url": p["url"],
            "author": p["author"],
            "reddit_id": p["reddit_id"],
            "score": ai["score"],
            "intent": ai["intent"],
            "summary": ai["summary"],
            "timestamp": datetime.fromtimestamp(p["created_utc"], tz=timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.leads.insert_one(lead_doc)
        lead_doc.pop("_id", None)
        saved_leads.append(lead_doc)

    # Get cached leads (existing in DB) too — sorted by recency
    cached = await db.leads.find(
        {"reddit_id": {"$in": list(existing_ids)}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(remaining)

    combined = saved_leads + cached
    combined = sorted(combined, key=lambda x: x.get("score", 0), reverse=True)[:remaining + len(cached)]

    # Increment counter for new leads only
    if saved_leads:
        await db.users.update_one(
            {"id": user["id"]},
            {"$inc": {"leads_today": len(saved_leads), "xp": len(saved_leads) * 2}}
        )

    return {
        "leads": combined,
        "new_count": len(saved_leads),
        "remaining": max(0, daily_cap - leads_today - len(saved_leads)),
        "limit_reached": False,
        "demo_mode": demo_mode,
    }


@api_router.get("/leads/feed")
async def get_feed(user: dict = Depends(get_current_user)):
    """Return recent leads from DB (no fresh fetch)."""
    leads = await db.leads.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    # Annotate with user's saved status
    user_lead_map = {}
    user_leads = await db.user_leads.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    for ul in user_leads:
        user_lead_map[ul["lead_id"]] = ul["status"]
    for lead in leads:
        lead["my_status"] = user_lead_map.get(lead["id"])
    return {"leads": leads}


@api_router.get("/leads/{lead_id}")
async def get_lead(lead_id: str, user: dict = Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    ul = await db.user_leads.find_one({"user_id": user["id"], "lead_id": lead_id}, {"_id": 0})
    lead["my_status"] = ul["status"] if ul else None
    lead["my_notes"] = ul.get("notes", "") if ul else ""
    return lead


# ============== AI Message Generation ==============
@api_router.post("/leads/generate-message")
async def generate_message(payload: GenerateMessageIn, user: dict = Depends(get_current_user)):
    # Daily reset
    reset = reset_daily_counters_if_needed(user)
    if reset:
        await db.users.update_one({"id": user["id"]}, {"$set": reset})
        user.update(reset)

    is_premium = user.get("is_premium", False)
    msgs_today = user.get("messages_today", 0)
    daily_cap = 5 if not is_premium else 1000
    if msgs_today >= daily_cap:
        raise HTTPException(status_code=429, detail=f"Daily limit reached ({daily_cap}). Upgrade to Premium for unlimited.")

    lead = await db.leads.find_one({"id": payload.lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    tone = payload.tone or user.get("tone_preference", "Casual")
    profession = user.get("profession", "freelancer")
    skills = ", ".join(user.get("skills", [])) or "various skills"
    experience = user.get("experience_level", "Intermediate")
    portfolio = ", ".join(user.get("portfolio_links", [])) or "Available on request"
    name = user.get("name", "")

    system = "You are an expert outreach copywriter for freelancers. Write authentic, non-spammy messages."
    prompt = f"""Generate two outreach messages for this freelance opportunity.

FREELANCER PROFILE:
- Name: {name}
- Profession: {profession}
- Skills: {skills}
- Experience: {experience}
- Portfolio: {portfolio}
- Tone: {tone}

CLIENT POST (from r/{lead['subreddit']}):
Title: {lead['title']}
Body: {lead['content'][:800]}

Return ONLY valid JSON like:
{{"reddit_dm": "...", "email": "..."}}

Requirements:
- Reddit DM: 4-6 lines, casual, reference their specific need, mention 1 relevant skill, end with a soft CTA
- Email: 6-8 lines with subject line at start (Subject: ...), more formal but {tone.lower()} in tone
- Do NOT use generic phrases like "I hope this finds you well"
- Mention something specific from their post"""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"msg-{uuid.uuid4()}",
            system_message=system,
        ).with_model("gemini", "gemini-3-flash-preview")
        resp = await chat.send_message(UserMessage(text=prompt))
        m = re.search(r'\{.*\}', resp, re.DOTALL)
        if not m:
            raise ValueError("No JSON in response")
        result = json.loads(m.group(0))
        reddit_dm = str(result.get("reddit_dm", ""))
        email = str(result.get("email", ""))
    except Exception as e:
        logger.error(f"Message gen error: {e}")
        reddit_dm = f"Hey! Saw your post about {lead['title'][:50]}. I'm a {profession} with experience in {skills}. Happy to chat if you're still looking."
        email = f"Subject: Re: {lead['title'][:60]}\n\nHi,\n\nI noticed your post and I think I can help. I'm a {profession} specializing in {skills}.\n\nLet me know if you'd like to discuss.\n\nBest,\n{name}"

    # Save generation record
    msg_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "lead_id": payload.lead_id,
        "reddit_dm": reddit_dm,
        "email": email,
        "tone": tone,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.messages.insert_one(msg_doc)
    msg_doc.pop("_id", None)

    # Increment counters
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"messages_today": 1, "xp": 5}}
    )

    return msg_doc


# ============== CRM (UserLeads) ==============
@api_router.post("/userleads")
async def save_user_lead(payload: SaveLeadIn, user: dict = Depends(get_current_user)):
    lead = await db.leads.find_one({"id": payload.lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    existing = await db.user_leads.find_one({"user_id": user["id"], "lead_id": payload.lead_id})
    if existing:
        await db.user_leads.update_one(
            {"user_id": user["id"], "lead_id": payload.lead_id},
            {"$set": {"status": payload.status, "notes": payload.notes or existing.get("notes", "")}}
        )
        ul = await db.user_leads.find_one({"user_id": user["id"], "lead_id": payload.lead_id}, {"_id": 0})
        return ul
    ul_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "lead_id": payload.lead_id,
        "status": payload.status,
        "notes": payload.notes or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.user_leads.insert_one(ul_doc)
    ul_doc.pop("_id", None)
    return ul_doc


@api_router.get("/userleads")
async def list_user_leads(user: dict = Depends(get_current_user)):
    uls = await db.user_leads.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    # Join with lead data
    lead_ids = [ul["lead_id"] for ul in uls]
    leads = await db.leads.find({"id": {"$in": lead_ids}}, {"_id": 0}).to_list(500)
    lead_map = {ld["id"]: ld for ld in leads}
    enriched = []
    for ul in uls:
        ld = lead_map.get(ul["lead_id"])
        if ld:
            enriched.append({**ld, "my_status": ul["status"], "my_notes": ul.get("notes", ""), "user_lead_id": ul["id"]})
    return {"user_leads": enriched}


@api_router.patch("/userleads/{lead_id}")
async def update_user_lead(lead_id: str, payload: UpdateUserLeadIn, user: dict = Depends(get_current_user)):
    update = {k: v for k, v in payload.dict().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    await db.user_leads.update_one(
        {"user_id": user["id"], "lead_id": lead_id},
        {"$set": update},
        upsert=True
    )
    # XP for status changes
    if payload.status in ["contacted", "replied", "closed"]:
        xp_gain = {"contacted": 10, "replied": 20, "closed": 50}[payload.status]
        await db.users.update_one({"id": user["id"]}, {"$inc": {"xp": xp_gain}})
    ul = await db.user_leads.find_one({"user_id": user["id"], "lead_id": lead_id}, {"_id": 0})
    return ul


# ============== Invoices ==============
@api_router.post("/invoices")
async def create_invoice(payload: InvoiceIn, user: dict = Depends(get_current_user)):
    inv_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "freelancer_name": user.get("name", ""),
        "client_name": payload.client_name,
        "description": payload.description,
        "amount": payload.amount,
        "date": payload.date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "invoice_number": f"INV-{int(datetime.now(timezone.utc).timestamp())}",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.invoices.insert_one(inv_doc)
    inv_doc.pop("_id", None)
    return inv_doc


@api_router.get("/invoices")
async def list_invoices(user: dict = Depends(get_current_user)):
    invs = await db.invoices.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"invoices": invs}


# ============== Stats / Leaderboard ==============
@api_router.get("/stats/me")
async def my_stats(user: dict = Depends(get_current_user)):
    msg_count = await db.messages.count_documents({"user_id": user["id"]})
    contacted = await db.user_leads.count_documents({"user_id": user["id"], "status": "contacted"})
    replied = await db.user_leads.count_documents({"user_id": user["id"], "status": "replied"})
    closed = await db.user_leads.count_documents({"user_id": user["id"], "status": "closed"})
    return {
        "xp": user.get("xp", 0),
        "streak": user.get("streak", 0),
        "messages_generated": msg_count,
        "leads_contacted": contacted,
        "replies": replied,
        "deals_closed": closed,
        "is_premium": user.get("is_premium", False),
        "messages_today": user.get("messages_today", 0),
        "leads_today": user.get("leads_today", 0),
    }


@api_router.get("/leaderboard")
async def leaderboard(user: dict = Depends(get_current_user)):
    top = await db.users.find(
        {},
        {"_id": 0, "id": 1, "name": 1, "xp": 1, "streak": 1, "is_premium": 1}
    ).sort("xp", -1).limit(20).to_list(20)
    return {"leaderboard": top, "my_id": user["id"]}


# ============== Streak Update on Login ==============
@api_router.post("/auth/check-in")
async def daily_check_in(user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).date()
    last = user.get("last_active_date")
    streak = user.get("streak", 0)
    if last:
        last_date = datetime.fromisoformat(last).date() if isinstance(last, str) else last
        delta = (today - last_date).days
        if delta == 0:
            pass  # same day
        elif delta == 1:
            streak += 1
        else:
            streak = 1
    else:
        streak = 1
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"streak": streak, "last_active_date": today.isoformat()}}
    )
    return {"streak": streak}


@api_router.get("/")
async def root():
    return {"status": "ok", "service": "LeadForge AI"}


# ============== App Setup ==============
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    await db.users.create_index("email", unique=True)
    await db.leads.create_index("reddit_id")
    await db.user_leads.create_index([("user_id", 1), ("lead_id", 1)])
    logger.info("LeadForge AI API started")


@app.on_event("shutdown")
async def shutdown():
    client.close()
