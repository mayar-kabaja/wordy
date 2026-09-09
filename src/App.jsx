import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { fetchMyWords, removeWord, updateWord } from './lib/api'
import Auth from './screens/Auth'
import WordList from './screens/WordList'
import AddWord from './screens/AddWord'
import Quiz from './screens/Quiz'

export default function App() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)
  const [view, setView] = useState('words')
  const [quizKey, setQuizKey] = useState(0)
  const [showAdd, setShowAdd] = useState(false)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    try {
      setEntries(await fetchMyWords())
      setError('')
    } catch (err) {
      setError(err.message)
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

  async function handleRemove(entry) {
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

  return (
    <div className="shell">
      <div className="shell-inner shell-inner--wide">
        <header className="topbar">
          <button className="brand brand-link" onClick={() => setView('words')}>
            wordy
          </button>
          <nav className="nav">
            <button className="tab" onClick={() => supabase.auth.signOut()}>
              log out
            </button>
            <span className="avatar" title={session.user.email}>
              {initial}
            </span>
          </nav>
        </header>

        <main className="page-content">
          {error && <p className="error">{error}</p>}

          {view === 'words' && (
            <WordList
              entries={entries}
              loading={loading}
              onStartQuiz={() => setView('quiz')}
              onAdd={() => setShowAdd(true)}
              onRemove={handleRemove}
              onEdit={handleEditWord}
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

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAdd(false)} aria-label="close">
              ×
            </button>
            <AddWord onAdded={handleWordAdded} onDone={() => setShowAdd(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
