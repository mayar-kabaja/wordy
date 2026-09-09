import { useState } from 'react'
import { speak, canSpeak } from '../lib/speech'

export default function WordCard({ entry, onRemove, onEdit }) {
  const w = entry.words
  const say = [w.say, w.ipa].filter(Boolean).join(' · ')

  const [mode, setMode] = useState('view') // 'view' | 'edit' | 'delete'
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  function startEdit() {
    setForm({
      word: w.word,
      emoji: w.emoji || '',
      meaning: w.meaning,
      example: w.example || '',
      say: w.say || '',
      ipa: w.ipa || '',
      note: w.note || ''
    })
    setMode('edit')
  }

  async function saveEdit() {
    setSaving(true)
    await onEdit(entry, {
      word: form.word.trim(),
      emoji: form.emoji.trim() || null,
      meaning: form.meaning.trim(),
      example: form.example.trim(),
      say: form.say.trim(),
      ipa: form.ipa.trim(),
      note: form.note.trim() || null
    })
    setSaving(false)
    setMode('view')
  }

  if (mode === 'edit') {
    return (
      <article className="card">
        <div className="stack" style={{ gap: 10 }}>
          <div className="row">
            <input
              className="field"
              style={{ flex: '0 0 70px' }}
              value={form.emoji}
              onChange={(e) => setForm({ ...form, emoji: e.target.value })}
              placeholder="emoji"
            />
            <input
              className="field"
              style={{ flex: '1 1 160px' }}
              value={form.word}
              onChange={(e) => setForm({ ...form, word: e.target.value })}
              placeholder="word"
            />
          </div>
          <div className="row">
            <input
              className="field"
              style={{ flex: '1 1 140px' }}
              value={form.say}
              onChange={(e) => setForm({ ...form, say: e.target.value })}
              placeholder="say it like"
            />
            <input
              className="field"
              style={{ flex: '1 1 140px' }}
              value={form.ipa}
              onChange={(e) => setForm({ ...form, ipa: e.target.value })}
              placeholder="IPA"
            />
          </div>
          <textarea
            className="field"
            style={{ borderRadius: 18, resize: 'vertical' }}
            rows={2}
            value={form.meaning}
            onChange={(e) => setForm({ ...form, meaning: e.target.value })}
            placeholder="meaning"
          />
          <textarea
            className="field"
            style={{ borderRadius: 18, resize: 'vertical' }}
            rows={2}
            value={form.example}
            onChange={(e) => setForm({ ...form, example: e.target.value })}
            placeholder="example"
          />
          <input
            className="field"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="note (optional)"
          />
          <div className="row">
            <button className="btn btn-lime" disabled={saving} onClick={saveEdit}>
              {saving ? 'saving…' : 'save'}
            </button>
            <button className="btn btn-ghost" disabled={saving} onClick={() => setMode('view')}>
              cancel
            </button>
          </div>
        </div>
      </article>
    )
  }

  return (
    <article className="card">
      <div className="wc-head">
        <div>
          <div className="wc-name">
            {w.emoji ? `${w.emoji} ` : ''}
            {w.word}
          </div>
          <div className="wc-say">{say}</div>
        </div>
        <span className={`chip chip-${entry.level}`}>{entry.level}</span>
      </div>

      <p className="word-meaning">{w.meaning}</p>
      {w.example && <p className="word-example">{w.example}</p>}
      {w.note && <p className="wc-note">{w.note}</p>}

      <div className="word-foot">
        <span className="tag-pill">
          {entry.right} / {entry.seen} correct
        </span>

        {mode === 'delete' ? (
          <span className="row" style={{ marginLeft: 'auto', gap: 8 }}>
            <span className="hint">delete this word?</span>
            <button className="link" onClick={() => onRemove(entry)}>
              yes
            </button>
            <button className="link" onClick={() => setMode('view')}>
              no
            </button>
          </span>
        ) : (
          <span className="row" style={{ marginLeft: 'auto', gap: 12 }}>
            {canSpeak && (
              <button className="speak speak-sm" onClick={() => speak(w.word)} aria-label={`listen to ${w.word}`}>
                🔊
              </button>
            )}
            {onEdit && (
              <button className="link" onClick={startEdit}>
                edit
              </button>
            )}
            {onRemove && (
              <button className="link" onClick={() => setMode('delete')}>
                remove
              </button>
            )}
          </span>
        )}
      </div>
    </article>
  )
}
