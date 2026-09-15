import { supabase } from './supabase'

// Every query below is scoped by Row Level Security on the database side.
// The `user_id = auth.uid()` filter is Postgres's job, not ours — we never
// pass a user id from the browser and trust it.

export async function fetchMyWords() {
  const { data, error } = await supabase
    .from('user_words')
    .select('id, level, streak, seen, right, due_at, added_at, words (*)')
    .order('added_at', { ascending: false })

  if (error) throw error
  return (data || []).filter((row) => row.words)
}

// Finds or generates the shared dictionary entry — does not add it to the
// caller's collection. Call addToMyWords() with the returned id for that.
export async function generateWord(word) {
  const { data, error } = await supabase.functions.invoke('add-word', {
    body: { word }
  })

  // A non-2xx from an Edge Function arrives as a FunctionsHttpError with the
  // real message in the response body, so dig it out before showing anything.
  if (error) {
    let message = 'Something went wrong adding that word.'
    try {
      const body = await error.context?.json()
      if (body?.error) message = body.error
    } catch {
      if (error.message) message = error.message
    }
    const err = new Error(message)
    err.status = error.context?.status
    throw err
  }
  if (data?.error) throw new Error(data.error)
  return data
}

// direction is 'auto' | 'en-ar' | 'ar-en'. Returns { translation, direction, note }.
export async function translateText(text, direction = 'auto') {
  const { data, error } = await supabase.functions.invoke('translate', {
    body: { text, direction }
  })

  if (error) {
    let message = 'Something went wrong translating that.'
    try {
      const body = await error.context?.json()
      if (body?.error) message = body.error
    } catch {
      if (error.message) message = error.message
    }
    const err = new Error(message)
    err.status = error.context?.status
    throw err
  }
  if (data?.error) throw new Error(data.error)
  return data
}

// True only for failures the edge function itself flagged as transient — a
// network drop, a rate limit, or "busy" after it already retried server-side.
// A bad word, a missing dictionary entry, or a misconfigured key will fail
// the same way every time, so those aren't worth queueing or retrying.
export function isRetryable(err) {
  return err.status === undefined || err.status === 429 || err.status === 502
}

// Returns the new user_words row so the caller can add it to local state
// directly, instead of re-fetching the entire list for one new word.
export async function addToMyWords(wordId) {
  const {
    data: { user }
  } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('user_words')
    .upsert({ user_id: user.id, word_id: wordId }, { onConflict: 'user_id,word_id', ignoreDuplicates: true })
    .select('id, level, streak, seen, right, due_at, added_at')
    .maybeSingle()
  if (error) throw error
  return data
}

export async function removeWord(userWordId) {
  const { error } = await supabase.from('user_words').delete().eq('id', userWordId)
  if (error) throw error
}

// words is the shared dictionary — editing a word changes it for every user
// who has it, not just the one making the edit.
export async function updateWord(wordId, fields) {
  const { error } = await supabase.from('words').update(fields).eq('id', wordId)
  if (error) throw error
}

// Saved once, at the end of a session, rather than after every answer —
// a dropped connection mid-quiz then costs the session, not the data.
export async function saveProgress(updates) {
  const results = await Promise.all(
    updates.map(({ id, level, streak, seen, right, due_at }) =>
      supabase
        .from('user_words')
        .update({ level, streak, seen, right, due_at })
        .eq('id', id)
    )
  )
  const failed = results.find((r) => r.error)
  if (failed) throw failed.error
}

export async function fetchNotes() {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function addNote({ text, word, color }) {
  const {
    data: { user }
  } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('notes')
    .insert({ user_id: user.id, text, word: word || null, color })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function toggleNotePin(id, pinned) {
  const { error } = await supabase.from('notes').update({ pinned }).eq('id', id)
  if (error) throw error
}

export async function deleteNote(id) {
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) throw error
}
