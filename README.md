# wordy

Multi-user vocabulary app. React + Vite on the front, Supabase for auth and data,
one Edge Function that talks to Groq.

```
src/
  App.jsx              auth session, nav, screen switching
  screens/Auth.jsx     signup + login
  screens/WordList.jsx collection, counts, filters
  screens/AddWord.jsx  type a word, AI fills the rest
  screens/Quiz.jsx     20-question session
  lib/quiz.js          session building, question types, grading (pure functions)
  lib/api.js           every Supabase query
  lib/speech.js        browser text-to-speech
supabase/
  schema.sql           tables, RLS policies, daily-quota function
  functions/add-word/  the only server code
```

## Before anything else

The Groq key that was shared in chat is burned — rotate it at
[console.groq.com](https://console.groq.com/keys) and use the new one below. It
only ever lives in Supabase secrets. Anything in `src/` or `.env` is shipped to
the browser and is readable by anyone using the app.

## Setup

**1. Database.** Create a Supabase project, open the SQL editor, run
`supabase/schema.sql` end to end.

**2. Edge Function.**

```bash
npm i -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase secrets set GROQ_API_KEY=<your-new-key>
supabase functions deploy add-word
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
into the function automatically — only the Groq key needs setting.

**3. Frontend.**

```bash
cp .env.example .env     # fill in the project URL and anon key
npm install
npm run dev
```

Auth settings worth checking in the Supabase dashboard: email confirmation is on
by default, so the signup screen sends people to their inbox. Turn it off during
development if the round trip gets annoying.

## How it fits together

The browser talks straight to Postgres for everything except adding a word.
`user_words` has an RLS policy restricting every operation to `user_id =
auth.uid()`, so isolation is enforced by the database — a bug in `api.js` can't
leak someone else's collection. `words` is readable by any logged-in user and
writable by nobody except the Edge Function's service role.

Adding a word checks the shared `words` table first. A hit costs one read and
returns instantly; a miss calls Groq once and the result is then shared with
every future user who adds that word. Cost scales with vocabulary size, not
user count.

Quiz sessions weight `new` at 6, `learning` at 4 and `known` at 1, doubled if the
word is past its review date. With a mature collection that lands around 50% new,
38% learning, 12% known. Grading: three correct in a row makes a word `known`;
one wrong answer on a `known` word drops it back to `learning`. Review gaps are
fixed per level — 10 minutes, 1 day, 7 days.

## Where this differs from the design doc

- **`ai_usage` table and `bump_ai_usage` function.** The doc specifies a 50/day
  cap on AI calls but nowhere to count them. Counting `user_words` rows wouldn't
  work — cached adds are supposed to be uncapped. The counter increments only on
  a real Groq call.
- **Adding is one step, not a preview.** The mockup shows "save to my words" and
  "generate again" after the card appears. A preview would have to write to the
  shared dictionary before the user accepts it, which makes "generate again"
  meaningless (the second call would hit the cache it just filled). So the button
  adds the word and the card is the confirmation. Regeneration needs a "this
  entry is wrong" flag instead — same feature as the moderation flag in section 9.
- **Quitting mid-quiz saves.** Answers already given are written before leaving.
- **Quizzes need four words.** Every question type needs three distractors. Below
  that the button is disabled with an explanation rather than showing broken
  questions.

## Not built yet

The report-a-bad-entry flag from section 9, and any handling of a word that
exists in the dictionary but is already in your collection beyond a quiet no-op.
