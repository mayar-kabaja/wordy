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

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
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

// ---------- question types ----------

export const TYPES = {
  LISTEN_MEANING: 'listen → meaning',
  WORD_MEANING: 'word → meaning',
  MEANING_WORD: 'meaning → word',
  SENTENCE_WORD: 'sentence → word',
  LISTEN_WORD: 'listen → word'
}

function blankOut(example, word) {
  const pattern = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*\\b`, 'gi')
  return example.replace(pattern, '______')
}

// Plausible wrong spellings for the listen → word type. Real learners misspell
// by doubling, dropping and swapping — random letters would be too easy.
export function misspellings(word) {
  const w = word.toLowerCase()
  const out = new Set()
  const swaps = [
    ['ei', 'ie'], ['ie', 'ei'], ['ph', 'f'], ['ance', 'ence'], ['ence', 'ance'],
    ['able', 'ible'], ['ible', 'able'], ['ary', 'ery'], ['tion', 'sion'],
    ['ous', 'ious'], ['cede', 'ceed'], ['ll', 'l'], ['ss', 's']
  ]
  for (const [a, b] of swaps) {
    if (w.includes(a)) out.add(w.replace(a, b))
  }
  // double an interior consonant
  for (let i = 1; i < w.length - 1; i++) {
    if (!'aeiou'.includes(w[i]) && w[i] !== w[i + 1]) {
      out.add(w.slice(0, i) + w[i] + w.slice(i))
      break
    }
  }
  // swap two adjacent interior letters
  if (w.length > 4) {
    const i = Math.floor(w.length / 2)
    out.add(w.slice(0, i - 1) + w[i] + w[i - 1] + w.slice(i + 1))
  }
  // drop a vowel
  for (let i = 1; i < w.length - 1; i++) {
    if ('aeiou'.includes(w[i])) {
      out.add(w.slice(0, i) + w.slice(i + 1))
      break
    }
  }
  out.delete(w)
  return [...out]
}

function otherWords(entry, all, n, field) {
  const pool = all.filter((e) => e.id !== entry.id && e.words?.[field])
  return shuffle(pool).slice(0, n).map((e) => e.words[field])
}

function options(correct, distractors) {
  const list = shuffle([correct, ...distractors])
  return { list, answer: list.indexOf(correct) }
}

export function makeQuestion(entry, all) {
  const w = entry.words
  const enoughForMeaning = all.filter((e) => e.id !== entry.id && e.words?.meaning).length >= 3
  const enoughForWord = all.filter((e) => e.id !== entry.id && e.words?.word).length >= 3

  const available = []
  if (enoughForMeaning) available.push(TYPES.WORD_MEANING, TYPES.LISTEN_MEANING)
  if (enoughForWord) available.push(TYPES.MEANING_WORD, TYPES.LISTEN_WORD)
  if (w.example && enoughForWord) available.push(TYPES.SENTENCE_WORD)
  if (available.length === 0) available.push(TYPES.WORD_MEANING)

  const type = pick(available)

  switch (type) {
    case TYPES.LISTEN_MEANING: {
      const { list, answer } = options(w.meaning, otherWords(entry, all, 3, 'meaning'))
      return { type, speak: w.word, prompt: 'what does this word mean?', options: list, answer }
    }
    case TYPES.MEANING_WORD: {
      const { list, answer } = options(w.word, otherWords(entry, all, 3, 'word'))
      return { type, prompt: `which word means "${w.meaning}"?`, options: list, answer, small: true }
    }
    case TYPES.SENTENCE_WORD: {
      const { list, answer } = options(w.word, otherWords(entry, all, 3, 'word'))
      return { type, prompt: blankOut(w.example, w.word), options: list, answer, small: true }
    }
    case TYPES.LISTEN_WORD: {
      let wrong = misspellings(w.word).slice(0, 3)
      if (wrong.length < 3) wrong = [...wrong, ...otherWords(entry, all, 3 - wrong.length, 'word')]
      const { list, answer } = options(w.word, wrong.slice(0, 3))
      return { type, speak: w.word, prompt: 'how is it spelled?', options: list, answer }
    }
    case TYPES.WORD_MEANING:
    default: {
      const { list, answer } = options(w.meaning, otherWords(entry, all, 3, 'meaning'))
      return { type: TYPES.WORD_MEANING, prompt: w.word, options: list, answer }
    }
  }
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
