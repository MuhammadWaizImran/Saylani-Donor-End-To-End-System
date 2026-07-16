# Deploying SMIT Portal to Vercel — Complete Manual Guide

This app is a single Next.js project — there's no separate "frontend" and "backend" to deploy: the API routes (`app/api/**`) run as Vercel Functions right alongside the pages, in the same deployment. One deploy ships both.

**This guide assumes a brand-new Vercel account** with no existing project — every step is done by hand in the Vercel dashboard (no CLI), since the CLI had unreliable network behavior on this machine during setup.

Your code is already on GitHub: **`https://github.com/MuhammadWaizImran/Saylani-Donor-End-To-End-System`** (branch `master`). That's all Vercel needs to pull from.

---

## 0. Before anything — the one thing that silently breaks this app

**MongoDB Atlas must allow connections from anywhere.** Vercel Functions don't run from a fixed IP address, so if your Atlas cluster's Network Access list only allows your own computer's IP, every database call in production will fail even though everything looks fine locally.

1. Go to **https://cloud.mongodb.com** → your project → **Network Access** (left sidebar)
2. Confirm there's an entry for `0.0.0.0/0` ("Allow access from anywhere")
3. If not: **Add IP Address** → **Allow Access from Anywhere** → **Confirm**

Do this now — it's the #1 reason a working-locally app looks broken once deployed.

---

## 1. Get your local secrets ready to copy

Before starting the import, open `.env.local` in this project folder (Notepad is fine) and keep it visible — you'll copy four values from it in step 3. You need:

- `MONGODB_URI`
- `AUTH_JWT_SECRET`
- `GROQ_API_KEY`
- `GROQ_API_KEY_2`

(Never paste these into a chat, issue, or commit them to git — copy straight from the file into Vercel's dashboard only.)

---

## 2. Import the project

1. Log into **https://vercel.com** with your **new** account
2. Click **Add New…** → **Project**
3. Under **Import Git Repository**, you'll be asked to connect GitHub if you haven't yet — click **Connect GitHub Account**, authorize it, and grant access to (at minimum) the `Saylani-Donor-End-To-End-System` repo
4. Once connected, find `Saylani-Donor-End-To-End-System` in the list and click **Import**

Vercel will auto-detect it as a Next.js project — leave the Framework Preset, Build Command, and Output Directory on their defaults.

---

## 3. Add environment variables (before the first deploy)

Still on the import screen, expand **Environment Variables** and add these one at a time — **Name** on the left, **Value** pasted from `.env.local` on the right, leaving all three environment checkboxes (Production/Preview/Development) ticked:

| Name | Value comes from |
|---|---|
| `MONGODB_URI` | `.env.local` |
| `AUTH_JWT_SECRET` | `.env.local` |
| `GROQ_API_KEY` | `.env.local` |
| `GROQ_API_KEY_2` | `.env.local` |

Optional (voice replies — skip if you don't have one yet, the app falls back gracefully):

| Name | Value |
|---|---|
| `ELEVENLABS_API_KEY` | your ElevenLabs key, if you have one |

---

## 4. Deploy

Click **Deploy**. This is a brand-new project so it's a real build, not a cached one — expect it to take under a minute (local `next build` for this app takes ~20 seconds).

Watch the log stream on screen. You should see, in order:

```
Cloning repository...
Installing dependencies...
Creating an optimized production build...
✓ Compiled successfully
Collecting page data...
Generating static pages (19/19)
Finalizing page optimization...
Build Completed
```

**If it sits with no new log lines for more than 3–4 minutes**, something's stuck — click **Cancel Deployment**, then **Redeploy** from the project's Deployments tab.

---

## 5. Check Deployment Protection is off

Right after the first deploy, go to **Settings → Deployment Protection**. If **Vercel Authentication** is protecting Production, nobody without an account on your new Vercel team can reach the site — they'd hit a Vercel login wall before ever seeing this app's own login page.

- Set it to **Only Preview Deployments** (or disable entirely) so Production is public.

---

## 6. Verify it's live

Open the Production URL shown at the top of the deployment (something like `https://saylani-donor-end-to-end-system.vercel.app`). It should land on **`/auth/login`** automatically — this app has no public homepage.

Checklist:
- [ ] `/` redirects to `/auth/login`
- [ ] Login page shows 3 role tabs (Admin / Trainer / Donor)
- [ ] Logging in as admin reaches `/portal/admin` and shows **real numbers**, not zeros (zeros ⇒ MongoDB unreachable ⇒ recheck step 0)
- [ ] AI Assistant page loads and answers a question (confirms the Groq key works)

If you don't have login credentials to test with yet, create one from your own machine — it writes straight to the same production MongoDB, so it works on the live site too:

```bash
npm run seed:test-admin
```

Creates `admin@test.com` / `admin123`. **Delete this account once real admin accounts are confirmed working** — it's a known, public password.

---

## 7. Custom domain (optional)

If SMIT has a real domain (e.g. `portal.saylanimit.com`):

1. **Settings → Domains** → **Add**
2. Enter the domain, follow the DNS instructions shown (usually one CNAME or A record at wherever the domain is registered)
3. Vercel issues an SSL certificate automatically once DNS verifies — no extra steps

A custom domain also bypasses Vercel's Deployment Protection automatically, as an extra layer of certainty the site is reachable.

---

## Keeping it updated after this first deploy

Once imported this way, Vercel is Git-connected from the start — every future `git push origin master` automatically builds and deploys. No manual dashboard steps needed again.

---

## Troubleshooting quick reference

| Symptom | Likely cause | Fix |
|---|---|---|
| Site loads but login always fails | MongoDB unreachable | Check Atlas Network Access (step 0) |
| Dashboard loads but shows all zeros | Wrong/stale `MONGODB_URI` | Recheck the value under Settings → Environment Variables |
| AI Assistant says "offline mode" | Groq key missing/invalid/rate-limited | Recheck `GROQ_API_KEY` / add `GROQ_API_KEY_2` |
| Visiting the URL prompts a Vercel login | Deployment Protection is on | Settings → Deployment Protection → disable (step 5) |
| `git push` doesn't trigger a new deploy | Repo wasn't actually connected during import | Settings → Git → Connect Git Repository |
| Build stuck with no log movement for 5+ min | Vercel-side hiccup, not your code (local build succeeds in ~20s) | Cancel → Redeploy from the dashboard |

---

## Security reminder before going fully live

- Rotate the MongoDB password and both Groq API keys if they were ever pasted into a chat, doc, or shared screen — treat any credential that left your own machine as compromised.
- Delete the `admin@test.com` test account once real admin accounts are confirmed working.
