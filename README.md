# V-SDC mTLS Proxy Server

A lightweight Node.js proxy that forwards invoice requests to the Fiji FRCS V-SDC server using mutual TLS (mTLS). Required because Deno Edge Functions use `rustls` which is incompatible with the FRCS server's TLS configuration.

## How It Works

1. Your Supabase Edge Function sends the invoice payload + PEM certificates to this proxy
2. The proxy makes the mTLS request to FRCS using Node.js OpenSSL
3. The FRCS response is returned to the edge function

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set environment variable

```bash
export PROXY_API_KEY=your-secret-key-here
```

### 3. Run locally

```bash
node server.js
```

The server starts on port 3000 (or `PORT` env var).

### 4. Deploy to Railway / Render / Fly.io

**Railway (recommended - free tier):**
1. Push this folder to a GitHub repo (or use Railway CLI)
2. Go to [railway.app](https://railway.app), create new project from repo
3. Add environment variable: `PROXY_API_KEY` = your secret key
4. Deploy — Railway auto-detects Node.js

**Render:**
1. Go to [render.com](https://render.com), create new Web Service
2. Point to your repo, set start command: `node server.js`
3. Add env var: `PROXY_API_KEY`

**Fly.io:**
```bash
fly launch
fly secrets set PROXY_API_KEY=your-secret-key
fly deploy
```

### 5. Configure in Lovable

After deploying, add the proxy URL and API key as Supabase secrets:
- `VSDC_PROXY_URL` = `https://your-proxy.railway.app` (your deployed URL)
- `VSDC_PROXY_API_KEY` = the same secret key you set above

## API

### POST /proxy/vsdc

**Headers:**
- `Authorization: Bearer <PROXY_API_KEY>`
- `Content-Type: application/json`

**Body:**
```json
{
  "targetUrl": "https://vsdc.sandbox.vms.frcs.org.fj/api/v3/invoices",
  "pac": "BKP8W2",
  "cert": "-----BEGIN CERTIFICATE-----\n...",
  "key": "-----BEGIN RSA PRIVATE KEY-----\n...",
  "caCerts": ["-----BEGIN CERTIFICATE-----\n..."],
  "invoice": { ... }
}
```

**Response:** The raw FRCS V-SDC response is forwarded back.
