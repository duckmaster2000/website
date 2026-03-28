# Suggestions Backend Setup

This project now includes a backend-ready endpoint at `api/suggestions.js`.

## What it does

- Accepts suggestion posts from the homepage suggestion box.
- `mode=email`: forwards suggestion by email.
- `mode=ai`: optionally runs AI triage and forwards results by email.

## Required environment variables

For email forwarding (Resend):

- `RESEND_API_KEY`
- `SUGGEST_TO_EMAIL` (your inbox, e.g. `hicalebliu@gmail.com`)
- Optional: `SUGGEST_FROM_EMAIL`

For AI triage:

- `OPENAI_API_KEY`

## Frontend behavior

- If backend is configured: form submits to `/api/suggestions`.
- If backend is not configured:
  - Email button falls back to opening `mailto:`.
  - AI button falls back to copying an AI-ready prompt to clipboard.

## Deployment

Deploy this repo to a platform that supports serverless functions under `/api` (for example Vercel).

## Security note

- Never expose API keys in client JS.
- Keep keys in server environment variables only.
