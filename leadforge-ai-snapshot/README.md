# LeadForge AI — Source

Web-only SaaS landing page (Expo Router static export) + FastAPI backend.

## Quickstart

### Backend
    cd backend
    pip install -r requirements.txt
    cp .env.example .env   # fill in values
    uvicorn server:app --reload --port 8001

### Frontend
    cd frontend
    yarn install
    cp .env.example .env   # point at your backend
    yarn expo start --web

### Build the static site
    cd frontend
    npx expo export --platform web
    # → outputs /dist, deploy to Cloudflare/Vercel/Netlify/etc.
