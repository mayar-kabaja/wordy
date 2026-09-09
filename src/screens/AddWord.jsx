import { useState } from 'react'
import { generateWord, addToMyWords } from '../lib/api'
import { speak, canSpeak } from '../lib/speech'

export default function AddWord({ onAdded, onDone }) {
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)

  async function submit(e) {
    e.preventDefault()
    const trimmed = word.trim()
    if (!trimmed) return

    setBusy(true)
    setError('')
    setResult(null)
    setAdded(false)
    try {
      const data = await generateWord(trimmed)
      setResult(data)
      setWord('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleAdd() {
    setAdding(true)
    setError('')
    try {
      const link = await addToMyWords(result.id)
      setAdded(true)
      const { cached, already_yours, ...wordFields } = result
      onAdded(link ? { ...link, words: wordFields } : null)
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  return (
    <>
      <h1 className="title">add a word</h1>
      <p className="sub">
        Type just the word. The meaning, example sentence and pronunciation are filled in for you,
        then it lands in your collection at level new.
      </p>

      <form className="row" onSubmit={submit}>
        <input
          className="field"
          style={{ flex: '1 1 240px' }}
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="quixotic"
          autoFocus
          disabled={busy}
        />
        <button className="btn btn-lime" disabled={busy || !word.trim()}>
          {busy ? 'filling it in…' : 'fill it in'}
        </button>
      </form>

      {error && (
        <p className="error" style={{ marginTop: 16 }}>
          {error}
        </p>
      )}

      {result ? (
        <div className="result-card">
          <div className="result-head">
            <div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
              {canSpeak && (
                <button
                  className="speak"
                  onClick={() => speak(result.word)}
                  aria-label={`listen to ${result.word}`}
                >
                  ▸
                </button>
              )}
              <div>
                <div className="result-name">
                  {result.emoji ? `${result.emoji} ` : ''}
                  {result.word}
                </div>
                <div className="result-say">{[result.say, result.ipa].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
            <span className={`source-tag ${result.cached ? 'source-cached' : 'source-ai'}`}>
              {result.cached ? 'already in the dictionary' : 'written by ai'}
            </span>
          </div>

          <div className="result-block">
            <span className="result-label">meaning</span>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.45 }}>{result.meaning}</p>
          </div>

          <div className="result-block">
            <span className="result-label">example</span>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.45, fontStyle: 'italic', color: 'var(--ink-soft)' }}>
              {result.example}
            </p>
          </div>

          {result.note && (
            <div className="result-block">
              <span className="result-label">worth knowing</span>
              <p style={{ margin: 0, lineHeight: 1.45, color: 'var(--muted)' }}>{result.note}</p>
            </div>
          )}

          <div className="row" style={{ marginTop: 24 }}>
            {result.already_yours || added ? (
              <span className="hint">✓ already in your words</span>
            ) : (
              <button className="btn btn-lime" disabled={adding} onClick={handleAdd}>
                {adding ? 'adding…' : 'add to my words'}
              </button>
            )}
            <button className="btn btn-ghost" onClick={onDone}>
              {added ? 'done' : 'close'}
            </button>
          </div>
        </div>
      ) : busy ? (
        <div className="result-card">
          <div className="result-head">
            <div style={{ flex: 1 }}>
              <div className="skeleton skeleton-line" style={{ width: '45%', height: 30, marginBottom: 10 }} />
              <div className="skeleton skeleton-line" style={{ width: '30%', height: 13 }} />
            </div>
          </div>
          <div className="skeleton skeleton-line" style={{ width: '20%', height: 11, marginBottom: 8 }} />
          <div className="skeleton skeleton-line" style={{ width: '95%', marginBottom: 20 }} />
          <div className="skeleton skeleton-line" style={{ width: '18%', height: 11, marginBottom: 8 }} />
          <div className="skeleton skeleton-line" style={{ width: '80%' }} />
        </div>
      ) : (
        <>
          <div className="placeholder">the word card will appear here</div>
          <p className="quota">
            Words already in the shared dictionary are instant and free. Brand-new ones are capped at
            50 a day.
          </p>
        </>
      )}
    </>
  )
}
