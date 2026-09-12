import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { fetchMyWords, removeWord, updateWord, generateWord, addToMyWords, isRetryable } from './lib/api'
import { MIN_WORDS } from './lib/quiz'
import Auth from './screens/Auth'
import WordList from './screens/WordList'
import AddWord from './screens/AddWord'
import Quiz from './screens/Quiz'
import Translator from './components/Translator'

const cacheKey = (userId) => `wordy:words:${userId}`
const queueKey = (userId) => `wordy:queue:${userId}`

export default function App() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)
  const [view, setView] = useState('words')
  const [quizKey, setQuizKey] = useState(0)
  const [query, setQuery] = useState('')
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [queuedCount, setQueuedCount] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    try {
      const data = await fetchMyWords()
      setEntries(data)
      setError('')
      localStorage.setItem(cacheKey(session.user.id), JSON.stringify(data))
    } catch (err) {
      const cached = localStorage.getItem(cacheKey(session.user.id))
      if (cached) {
        setEntries(JSON.parse(cached))
        setError('')
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    if (session) load()
    else {
      setEntries([])
      setView('words')
    }
  }, [session, load])

  useEffect(() => {
    if (!session) return
    const list = JSON.parse(localStorage.getItem(queueKey(session.user.id)) || '[]')
    setQueuedCount(list.length)
  }, [session])

  const processQueue = useCallback(async () => {
    if (!session) return
    const key = queueKey(session.user.id)
    const pending = JSON.parse(localStorage.getItem(key) || '[]')
    if (!pending.length) return

    let added = 0
    const remaining = []
    const failed = []
    for (const word of pending) {
      try {
        const data = await generateWord(word)
        const link = await addToMyWords(data.id)
        if (link) {
          const { cached, already_yours, ...wordFields } = data
          setEntries((list) => [{ ...link, words: wordFields }, ...list])
        }
        added++
      } catch (err) {
        if (isRetryable(err)) remaining.push(word)
        else failed.push(word)
      }
    }
    localStorage.setItem(key, JSON.stringify(remaining))
    setQueuedCount(remaining.length)

    // Reconcile with the server and refresh the offline cache, which the
    // per-word setEntries() above doesn't touch — do this before the toast
    // below, since load() success clears `error` itself.
    if (added) await load()

    const parts = []
    if (added) parts.push(`added ${added} word${added > 1 ? 's' : ''}`)
    if (failed.length) {
      parts.push(`couldn't add ${failed.map((w) => `"${w}"`).join(', ')} — removed from the queue`)
    }
    if (parts.length) setError(parts.join('; '))
  }, [session, load])

  useEffect(() => {
    if (isOnline) processQueue()
  }, [isOnline, processQueue])

  function queueWords(words) {
    const key = queueKey(session.user.id)
    const list = JSON.parse(localStorage.getItem(key) || '[]')
    list.push(...words)
    localStorage.setItem(key, JSON.stringify(list))
    setQueuedCount(list.length)
    if (isOnline) processQueue()
  }

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(''), 4000)
    return () => clearTimeout(t)
  }, [error])

  async function handleRemove(entry) {
    if (!isOnline) return setError("you're offline — can't remove words right now")
    setEntries((list) => list.filter((e) => e.id !== entry.id))
    try {
      await removeWord(entry.id)
    } catch {
      load()
    }
  }

  function handleWordAdded(newEntry) {
    if (newEntry) {
      setEntries((list) => [newEntry, ...list])
    } else {
      load()
    }
  }

  async function handleEditWord(entry, fields) {
    if (!isOnline) return setError("you're offline — can't save edits right now")
    const prev = entries
    setEntries((list) =>
      list.map((e) => (e.id === entry.id ? { ...e, words: { ...e.words, ...fields } } : e))
    )
    try {
      await updateWord(entry.words.id, fields)
    } catch (err) {
      setEntries(prev)
      setError(err.message)
    }
  }

  if (checking) return null
  if (!session) return <Auth />

  const initial = (session.user.email || '?')[0].toLowerCase()
  const canQuiz = entries.length >= MIN_WORDS

  return (
    <div className="shell">
      <div className="shell-inner shell-inner--wide">
        <header className="topbar">
          <button className="brand brand-link" onClick={() => setView('words')}>
            wordy
          </button>
          {view === 'words' && (
            <input
              className="field"
              style={{ maxWidth: 260 }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search your words…"
            />
          )}
          <nav className="nav">
            {view === 'words' && (
              <>
                <button
                  className="btn btn-ghost"
                  onClick={() => setView('add')}
                  title={
                    isOnline
                      ? undefined
                      : "you're offline — this word will be added automatically once you're back online"
                  }
                >
                  add a word
                </button>
                {queuedCount > 0 && (
                  <span className="hint">{queuedCount} queued</span>
                )}
                <button
                  className="btn btn-lime"
                  onClick={() => setView('quiz')}
                  disabled={!canQuiz}
                >
                  start a quiz · 20 questions
                </button>
              </>
            )}
            <button className="tab" onClick={() => supabase.auth.signOut()}>
              log out
            </button>
            <span className="avatar" title={session.user.email}>
              {initial}
            </span>
          </nav>
        </header>

        <main className="page-content">
          {!isOnline && (
            <div className="notice" style={{ marginBottom: 16 }}>
              you're offline — showing your saved words. new words are saved and added
              automatically once you're back online; editing and removing are paused until then.
            </div>
          )}
          {error && <div className="toast">{error}</div>}

          {view === 'words' && (
            <WordList
              entries={entries}
              loading={loading}
              query={query}
              onAdd={() => setView('add')}
              onRemove={handleRemove}
              onEdit={handleEditWord}
            />
          )}

          {view === 'add' && (
            <AddWord
              isOnline={isOnline}
              onQueue={queueWords}
              onAdded={handleWordAdded}
              onDone={() => setView('words')}
            />
          )}

          {view === 'quiz' && (
            <div className="quiz-wrap">
              <Quiz
                key={quizKey}
                entries={entries}
                onFinish={load}
                onQuit={() => setView('words')}
                onRestart={() => setQuizKey((k) => k + 1)}
              />
            </div>
          )}
        </main>
      </div>

      <nav className="bottom-tabs">
        <button className="bottom-tab" aria-current={view === 'words'} onClick={() => setView('words')}>
          my words
        </button>
        <button className="bottom-tab" aria-current={view === 'add'} onClick={() => setView('add')}>
          add
        </button>
        <button
          className="bottom-tab bottom-tab-quiz"
          aria-current={view === 'quiz'}
          disabled={!canQuiz}
          onClick={() => setView('quiz')}
        >
          quiz
        </button>
      </nav>

      <Translator />
    </div>
  )
}
