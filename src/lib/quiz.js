// Session building, question generation and grading.
// Pure functions — no Supabase, no React — so the rules are testable on their own.

export const SESSION_LENGTH = 20
export const MIN_WORDS = 4 // four options per question means four words minimum

const LEVEL_WEIGHT = { new: 6, learning: 4, known: 1 }
const DUE_BONUS = 2 // a word past its review date is twice as likely to come up

const DAY = 24 * 60 * 60 * 1000
const GAP = {
  new: 10 * 60 * 1000, // back within the same sitting
  learning: DAY,
  known: 7 * DAY
}

export const DATE_FILTERS = [
  { key: 'all', label: 'all words' },
  { key: 'today', label: 'added today' },
  { key: 'recent', label: 'last 5 days' },
  { key: 'old', label: 'older than 5 days' }
]

// Restricts the quiz pool to words added in a given window, by `added_at`
// (when this user added it) — not when the word was first created, which
// could predate this user entirely in the shared dictionary.
export function filterByAddedDate(entries, filter) {
  if (filter === 'all') return entries
  const now = Date.now()
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  return entries.filter((e) => {
    const added = new Date(e.added_at).getTime()
    if (filter === 'today') return added >= startOfToday.getTime()
    if (filter === 'recent') return now - added <= 5 * DAY
    if (filter === 'old') return now - added > 5 * DAY
    return true
  })
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function weightOf(entry, now) {
  const base = LEVEL_WEIGHT[entry.level] ?? 1
  const due = new Date(entry.due_at).getTime() <= now
  return due ? base * DUE_BONUS : base
}

// Weighted sample without replacement. If the user has fewer than 20 words
// we go round again rather than padding the session with nothing.
export function buildSession(entries, length = SESSION_LENGTH) {
  const now = Date.now()
  const out = []

  while (out.length < length) {
    const pool = entries.filter((e) => !out.includes(e))
    if (pool.length === 0) {
      if (out.length === 0) break
      // second pass over the same words, different question types
      const again = drawWeighted(entries, Math.min(length - out.length, entries.length), now)
      if (again.length === 0) break
      out.push(...again)
      continue
    }
    const drawn = drawWeighted(pool, Math.min(length - out.length, pool.length), now)
    if (drawn.length === 0) break
    out.push(...drawn)
  }

  return out.slice(0, length).map((entry) => ({
    entry,
    question: makeQuestion(entry, entries)
  }))
}

function drawWeighted(pool, count, now) {
  const remaining = [...pool]
  const chosen = []
  for (let i = 0; i < count && remaining.length; i++) {
    const total = remaining.reduce((s, e) => s + weightOf(e, now), 0)
    let r = Math.random() * total
    let idx = 0
    for (let j = 0; j < remaining.length; j++) {
      r -= weightOf(remaining[j], now)
      if (r <= 0) {
        idx = j
        break
      }
    }
    chosen.push(remaining.splice(idx, 1)[0])
  }
  return chosen
}

// ---------- question ----------

function otherWords(entry, all, n, field) {
  const pool = all.filter((e) => e.id !== entry.id && e.words?.[field])
  return shuffle(pool).slice(0, n).map((e) => e.words[field])
}

function options(correct, distractors) {
  const list = shuffle([correct, ...distractors])
  return { list, answer: list.indexOf(correct) }
}

// One format: the definition is shown, the learner picks the matching word
// from four options.
export function makeQuestion(entry, all) {
  const w = entry.words
  const { list, answer } = options(w.word, otherWords(entry, all, 3, 'word'))
  return { type: 'definition → word', prompt: w.meaning, options: list, answer }
}

// ---------- grading ----------

// Takes the state a word is in now, returns the state it should be in after
// this answer. Levels move one step at a time in both directions.
export function grade(state, correct) {
  const seen = state.seen + 1
  let { level, streak } = state
  let right = state.right

  if (correct) {
    streak += 1
    right += 1
    if (streak >= 3) level = 'known'
    else if (level === 'new') level = 'learning'
  } else {
    streak = 0
    if (level === 'known') level = 'learning'
  }

  return {
    level,
    streak,
    seen,
    right,
    due_at: new Date(Date.now() + GAP[level]).toISOString()
  }
}

export function summarise(before, after) {
  let promoted = 0
  let mastered = 0
  let dropped = 0
  for (const [id, end] of Object.entries(after)) {
    const start = before[id]
    if (!start) continue
    if (start.level !== 'known' && end.level === 'known') mastered++
    else if (start.level === 'new' && end.level === 'learning') promoted++
    else if (start.level === 'known' && end.level === 'learning') dropped++
  }
  return { promoted, mastered, dropped }
}
