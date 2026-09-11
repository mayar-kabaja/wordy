// The only server code in this project. It exists for one reason: the Word
// Orb API key must never reach the browser. Everything else the app does
// goes straight from the client to Postgres, with RLS deciding what's visible.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MAX_WORD_LENGTH = 40

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  })
}

// Letters, spaces, hyphens and apostrophes only. This both rejects junk and
// keeps the value safe to use in an ilike pattern (no % or _ can survive).
function cleanWord(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const word = input.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!word || word.length > MAX_WORD_LENGTH) return null
  if (!/^[a-z][a-z '-]*$/.test(word)) return null
  return word
}

// Deterministic dictionary lookup — https://wordorb.ai/docs. No example
// sentence or informal "say it like" guide in their data; the UI already
// hides those fields when absent. Etymology (`etym`) rides along in `note`.
async function lookup(word: string, apiKey: string) {
  const res = await fetch(`https://wordorb.ai/api/word/${encodeURIComponent(word)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(8000)
  })

  if (res.status === 404) return null // genuinely not in their dictionary

  if (res.status === 401) {
    const err = new Error('word orb rejected the API key — check WORDORB_API_KEY in Supabase secrets')
    ;(err as Error & { status?: number }).status = res.status
    throw err
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => '')

    // Word Orb returns this (still as a 500) when it structurally can't
    // produce an entry for the input — e.g. a phrase or hyphenated compound
    // instead of a single word. Retrying won't change that outcome, so treat
    // it the same as a 404 instead of burning retries or queueing forever.
    let parsed: { error?: string } | undefined
    try {
      parsed = JSON.parse(bodyText)
    } catch {
      /* not JSON — fall through to the generic error below */
    }
    if (parsed?.error === 'Generation failed') return null

    const err = new Error(`word orb ${res.status}: ${bodyText.slice(0, 200)}`)
    ;(err as Error & { status?: number }).status = res.status
    throw err
  }

  const data = await res.json()
  if (!data?.def) return null

  return {
    word: data.word || word,
    meaning: data.def,
    example: null,
    say: null,
    ipa: data.ipa || null,
    emoji: null,
    note: data.etym || null,
    part_of_speech: data.pos || null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Log in first.' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const wordOrbKey = Deno.env.get('WORDORB_API_KEY')

  if (!wordOrbKey) return json({ error: 'The word service is not configured yet.' }, 500)

  // Who is asking — verified against the token, not taken from the body.
  const asUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }
  })
  const { data: auth, error: authError } = await asUser.auth.getUser()
  if (authError || !auth?.user) return json({ error: 'Log in first.' }, 401)
  const userId = auth.user.id

  let body: { word?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Send a word.' }, 400)
  }

  const word = cleanWord(body.word)
  if (!word) return json({ error: 'That does not look like an English word.' }, 400)

  const admin = createClient(supabaseUrl, serviceKey)

  // 1. Shared dictionary first. A hit here costs one database read and
  //    nothing else, which is the whole point of the shared table.
  const { data: existing, error: lookupError } = await admin
    .from('words')
    .select('*')
    .ilike('word', word)
    .maybeSingle()

  if (lookupError) return json({ error: 'Could not reach the dictionary.' }, 500)

  let row = existing
  const cached = Boolean(existing)

  // 2. Miss: look it up on Word Orb. Up to 3 attempts total (one initial
  //    try plus two retries with backoff) before giving up — a single
  //    transient hiccup shouldn't reach the user as a visible error.
  const RETRY_DELAYS_MS = [600, 1500]
  if (!row) {
    let found
    let lastErr
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        found = await lookup(word, wordOrbKey)
        lastErr = null
        break
      } catch (err) {
        lastErr = err
        const status = (err as Error & { status?: number }).status
        const retryable = status === undefined || status === 429 || status >= 500
        if (!retryable || attempt === RETRY_DELAYS_MS.length) break
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]))
      }
    }
    if (lastErr) {
      const status = (lastErr as Error & { status?: number }).status
      console.error('word orb lookup failed:', lastErr)
      // A bad key won't fix itself on retry — say so plainly instead of
      // hiding it behind "busy", which looks identical to a real outage.
      if (status === 401) return json({ error: (lastErr as Error).message }, 500)
      return json({ error: 'The word service is busy. Try again in a moment.' }, 502)
    }
    if (!found) {
      // A space usually means a phrase or phrasal verb ("turn on", "carry
      // out") — this dictionary only covers single words, and no amount of
      // reformatting fixes that, so say so instead of implying a typo.
      const message = word.includes(' ')
        ? `"${word}" is a phrase — this dictionary only has single words. Try "${word.split(' ')[0]}" on its own.`
        : `Could not find "${word}" in the dictionary. Check the spelling.`
      return json({ error: message }, 404)
    }

    const { data: inserted, error: insertError } = await admin
      .from('words')
      .insert({ ...found, source: 'wordorb' })
      .select()
      .single()

    if (insertError) {
      // Either a genuine race (two people adding the same word at once), or
      // Word Orb normalized the spelling differently than what was typed
      // (e.g. stripped a space) so this word is already stored under its own
      // canonical spelling. Either way, re-read using that canonical spelling
      // — not the raw input — since that's what's actually in the table.
      const { data: raced } = await admin.from('words').select('*').ilike('word', found.word).maybeSingle()
      if (!raced) return json({ error: 'Could not save that word.' }, 500)
      row = raced
    } else {
      row = inserted
    }
  }

  // 3. Whether it's already in this user's collection. Linking happens
  // separately, client-side, once the user chooses to add it — this
  // function only ever finds or generates the shared dictionary entry.
  const { data: existingLink, error: linkError } = await admin
    .from('user_words')
    .select('id')
    .eq('user_id', userId)
    .eq('word_id', row.id)
    .maybeSingle()

  if (linkError) return json({ error: 'Could not check your word list.' }, 500)

  return json({ ...row, cached, already_yours: !!existingLink })
})
