import { useEffect, useState } from 'react'
import { fetchNotes, addNote, toggleNotePin, deleteNote } from '../lib/api'
import { timeAgo } from '../lib/time'

const COLORS = ['pink', 'purple', 'lime', 'orange', 'white']
const FILTERS = [
  { key: 'all', label: 'all notes' },
  { key: 'pinned', label: 'pinned' },
  { key: 'linked', label: 'linked to a word' }
]

function sortNotes(a, b) {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
  return new Date(b.created_at) - new Date(a.created_at)
}

export default function Notebook() {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [draft, setDraft] = useState('')
  const [wordLink, setWordLink] = useState('')
  const [color, setColor] = useState('pink')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      setNotes(await fetchNotes())
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd() {
    const text = draft.trim()
    if (!text || saving) return
    setSaving(true)
    try {
      const note = await addNote({ text, word: wordLink.trim(), color })
      setNotes((list) => [note, ...list].sort(sortNotes))
      setDraft('')
      setWordLink('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleTogglePin(note) {
    const pinned = !note.pinned
    setNotes((list) => list.map((n) => (n.id === note.id ? { ...n, pinned } : n)).sort(sortNotes))
    try {
      await toggleNotePin(note.id, pinned)
    } catch (err) {
      setError(err.message)
      load()
    }
  }

  async function handleDelete(note) {
    setNotes((list) => list.filter((n) => n.id !== note.id))
    try {
      await deleteNote(note.id)
    } catch (err) {
      setError(err.message)
      load()
    }
  }

  const shown = notes.filter((n) => {
    if (filter === 'pinned') return n.pinned
    if (filter === 'linked') return !!n.word
    return true
  })

  if (loading) {
    return (
      <>
        <div className="home-head">
          <h1 className="title" style={{ margin: 0 }}>notebook</h1>
        </div>
        <div className="card skeleton-card">
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line" style={{ width: '80%', marginTop: 16 }} />
        </div>
      </>
    )
  }

  return (
    <>
      <div className="home-head">
        <div>
          <h1 className="title" style={{ margin: 0 }}>notebook</h1>
          <h1 className="title accent" style={{ margin: 0 }}>{notes.length} notes</h1>
        </div>
        <p className="sub" style={{ margin: 0, maxWidth: 320 }}>
          the memory tricks that make a word stick. pin the ones worth keeping on top.
        </p>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="panel note-composer">
        <input
          className="note-composer-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="what helped this word stick?"
        />
        <div className="note-composer-row">
          <input
            className="field note-word-field"
            value={wordLink}
            onChange={(e) => setWordLink(e.target.value)}
            placeholder="link a word (optional)"
          />
          <div className="row" style={{ gap: 7 }}>
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`note-swatch note-swatch-${c}${color === c ? ' selected' : ''}`}
                aria-label={c}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <button className="btn btn-lime" disabled={!draft.trim() || saving} onClick={handleAdd}>
            {saving ? 'pinning…' : 'pin it'}
          </button>
        </div>
      </div>

      <div className="filters">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className="filter"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="empty">nothing here yet — write the trick that makes a word stick.</p>
      ) : (
        <div className="note-grid">
          {shown.map((note) => (
            <div key={note.id} className={`note-card note-${note.color}`}>
              <button
                type="button"
                className={`note-pin${note.pinned ? ' pinned' : ''}`}
                aria-label={note.pinned ? 'unpin' : 'pin'}
                onClick={() => handleTogglePin(note)}
              />
              <p className="note-text">{note.text}</p>
              <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                {note.word && <span className="tag-pill note-word-chip">{note.word}</span>}
                <span className="hint">{timeAgo(note.created_at)}</span>
                <button className="link" style={{ marginLeft: 'auto' }} onClick={() => handleDelete(note)}>
                  delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
