# Global Auth Backend Setup

This project now supports shared accounts across browsers/devices via `api/auth.js`.

## Why this is needed

`localStorage` accounts are browser-local. To make logins global, user records must live on a shared backend.

## Backend used

`api/auth.js` is implemented for Upstash Redis REST.

## Required environment variables

Set these in your deployment platform (e.g. Vercel):

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `GOOGLE_OAUTH_CLIENT_ID` (for Google Sign-In button)

## API actions used by frontend

`site-auth.js` calls:

- `findByLogin`
- `registerUser`
- `touchLastLogin`
- `status`
- `googleLogin`

If backend is unavailable, auth falls back to the old browser-local mode.

## Deployment notes

1. Deploy to a platform supporting `/api` serverless routes.
2. Add the 2 Upstash env vars.
3. Redeploy.

After this, accounts created on one device will be usable on other devices.

## Google OAuth setup

1. In Google Cloud Console, create OAuth Client ID for Web app.
2. Add authorized JavaScript origin(s) for your domain(s).
3. Put the client ID in deployment env var `GOOGLE_OAUTH_CLIENT_ID`.
4. Redeploy.

Then login page will show Google Sign-In and create/link accounts globally through Redis.
