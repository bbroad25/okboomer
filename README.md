# OkBoomer 👴📰

> "No, Grandpa, it's not a virus. Let us explain."

OkBoomer is an AI-powered translator that decodes internet slang, memes, and Gen-Z/Millennial speak for Baby Boomers. Powered by Claude.

## Features

- 📝 **Type Slang** — paste any confusing phrase or caption
- 🔗 **Paste a Link** — drop in a URL your grandkid sent
- 🖼️ **Upload a Meme** — drag & drop an image for full meme analysis
- 📊 **Boomer Rating** — 😴 to 😱 alarm scale on every explanation

## Deploy to Vercel

### 1. Add your Anthropic API Key

In Vercel, go to **Project Settings → Environment Variables** and add:

```
VITE_ANTHROPIC_API_KEY=your_api_key_here
```

> ⚠️ **Important:** This app calls the Anthropic API directly from the browser. This is fine for personal/demo use, but for a public production app you should proxy the API call through a serverless function to keep your key secret.

### 2. Deploy

```bash
npm install
npm run build
```

Or just push to GitHub and import the repo in Vercel — it will auto-detect Vite and deploy.

## Local Development

```bash
npm install
npm run dev
```

## Stack

- React 18 + Vite
- Claude claude-sonnet-4-20250514 (vision + text)
- Zero external UI dependencies
