<p align="center">
  <img src="public/social-preview.jpg" alt="wordy" width="420" />
</p>

<h1 align="center">wordy</h1>

<p align="center">
  Type a word — the meaning, pronunciation, and an example fill themselves in.<br/>
  Quiz yourself daily and keep every word you learn.
</p>

<p align="center">
  <a href="https://wordy-seven-roan.vercel.app">wordy-seven-roan.vercel.app</a>
</p>

---

## What it does

- **Type a word, done.** Meaning, IPA pronunciation, and part of speech fill in automatically — nobody writes their own definitions.
- **Shared dictionary.** Every word is looked up once, ever. The next person to add it (or you, next time) gets it straight from the database, not a fresh lookup.
- **Phrasal verbs included.** "turn on", "carry out", "look after", and ~3,300 others resolve instantly from a bundled dataset — including inflected forms like "carrying out" — no live API needed for these at all.
- **Bulk add.** Paste a list of words, one per line or comma-separated, and they all get looked up and saved in one go.
- **Works offline.** No connection? Words you add are queued and filled in automatically the moment you're back online. A dictionary hiccup gets retried quietly instead of surfacing as an error.
- **A quiz that adapts.** Multiple question types (word → meaning, meaning → word, listening, spelling), weighted toward words you're still learning, with streaks and a results summary.
- **Text-to-speech everywhere.** Every word, quiz question, and answer choice has a speaker icon.
- **English ↔ Arabic translator.** A floating popup, AI-backed, for anything outside the dictionary's coverage.
- **Magic-link sign-in.** No passwords — one email, one tap.
- **Actually mobile-friendly.** Bottom tab navigation, a full-screen add flow, and touch-sized controls — not a squeezed-down desktop layout.

## Stack

- **Frontend** — React + Vite, plain CSS
- **Backend** — Supabase: Postgres, magic-link Auth, Row Level Security, Edge Functions (Deno)
- **External APIs** — [Word Orb](https://wordorb.ai) for single-word lookups, [Groq](https://groq.com) for the translator
- **Hosting** — Vercel (frontend), Supabase (everything else)

## Project structure

```
src/
  App.jsx                    session, view routing, offline queue
  components/
    Translator.jsx           the English ↔ Arabic popup
    WordCard.jsx              one word in the list — edit, remove, listen
    WordyMark.jsx              the logo mark
  screens/
    Auth.jsx                  magic-link sign-in
    WordList.jsx                the collection — search, filters
    AddWord.jsx                  type a word (or paste a list), the rest fills in
    Quiz.jsx                      session setup, questions, results
  lib/
    api.js                      every Supabase call
    quiz.js                      session building, grading, spaced-repetition logic (pure functions)
    speech.js                    browser text-to-speech
    sound.js                      small UI sound effects
    time.js                        "2h" / "3d"-style relative timestamps

supabase/
  schema.sql                    tables, RLS policies
  seed_phrasal_verbs.sql          ~11k phrasal-verb + inflection entries
  functions/
    add-word/                     dictionary lookup — Word Orb + the shared cache
    translate/                     the translator popup's backend (Groq)
```

## Setup

**1. Database.** Create a Supabase project, open the SQL editor, and run, in order:

```
supabase/schema.sql
supabase/seed_phrasal_verbs.sql
```

**2. Edge Functions.** Deploy both — either via the dashboard's Edge Functions tab (paste the file in, deploy) or the CLI:

```bash
npm i -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase functions deploy add-word
supabase functions deploy translate
```

Then set these secrets (Edge Functions → Secrets in the dashboard, or `supabase secrets set KEY=value`):

| Secret | Used by | Get one from |
|---|---|---|
| `WORDORB_API_KEY` | `add-word` | [wordorb.ai](https://wordorb.ai) |
| `GROQ_API_KEY` | `translate` | [console.groq.com/keys](https://console.groq.com/keys) |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — nothing to set there. Neither key ever needs to exist outside Supabase's secret store; nothing in `src/` or a shipped `.env` is private, since it all ends up in the browser.

**3. Frontend.**

```bash
cp .env.example .env     # fill in your project URL and anon key
npm install
npm run dev
```

Email confirmation is on by default in Supabase Auth, so the sign-in link goes through your inbox as expected — nothing to change there.

## How it fits together

The browser talks straight to Postgres for everything except adding a word. `user_words` has an RLS policy restricting every operation to `user_id = auth.uid()`, so isolation is enforced by the database itself, not application code. `words` — the shared dictionary — is readable by any logged-in user and writable only by the Edge Functions' service role.

Adding a word checks the shared `words` table first. A hit costs one read and returns instantly. A miss is routed by shape: a single word goes to Word Orb (a deterministic lookup, no per-call cost); a multi-word phrase is checked only against the bundled phrasal-verb list — there's no live phrase API, so anything outside that list is a genuine "not found," not a bug. Either way, once something is looked up, it's shared with every future user — cost scales with vocabulary size, not user count.

Quiz sessions weight `new` words at 6, `learning` at 4, and `known` at 1 — doubled if a word is past its review date. Grading: three correct answers in a row promotes a word to `known`; one wrong answer on a `known` word drops it back to `learning`. Review gaps are fixed per level: 10 minutes, 1 day, 7 days.

## Known gaps

- General collocations and idioms beyond phrasal verbs ("promising lead", "running low") aren't covered — only single words and the bundled phrasal-verb list resolve.
- No way to flag or fix a bad dictionary entry from the UI — since the dictionary is shared, a typo needs a direct database edit today.
- The translator has no per-user usage cap — every message costs a small Groq call.
