# Mini Dia 💗

A chatbot that answers questions as Dia, based on `data/about-me.md`.

## What's where
| File | What it is |
|---|---|
| `data/about-me.md` | **Everything the bot knows about you.** Edit this to improve answers. |
| `public/` | The website (colors and layout: `style.css`, page: `index.html`, caricature: `avatar.svg`) |
| `api/chat.js` | The "brain" connector plus the bot's personality rules |
| `.env.local` | Your private AI key and settings (never uploaded) |

## The AI brain: Google Gemini
`.env.local` holds:
```
AI_PROVIDER=gemini
AI_API_KEY=your-gemini-key
AI_MODEL=gemini-3.5-flash-lite
```
To try a different model, change `AI_MODEL` (for example `gemini-3.8-flash`), then restart.

## Run it on your computer
```bash
npm run dev
```
Then open http://localhost:3000

## Put it online for free (Vercel)
1. Upload this `dia-chatbot` folder to a new GitHub repository (`.env.local` is ignored automatically, so your key stays private)
2. On vercel.com, choose **Add New → Project**, import the repo, and click **Deploy**
3. In **Settings → Environment Variables**, add the same three values from `.env.local` (`AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`), then redeploy
4. Your bot is live at `your-project.vercel.app`

Never paste your API key into any file except `.env.local`, or anywhere public.
