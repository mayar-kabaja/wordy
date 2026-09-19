import { useState } from 'react'
import { speak, canSpeak } from '../lib/speech'
import { timeAgo } from '../lib/time'

const TEXT_LIMIT = 90

function ReadMoreText({ children, className = '' }) {
  const [expanded, setExpanded] = useState(false)

  if (!children) return null

  const text = String(children)
  const shouldTruncate = text.length > TEXT_LIMIT

  if (!shouldTruncate) {
    return <span className={className}>{text}</span>
  }

  return (
    <span className={`read-more-wrap ${expanded ? 'is-expanded' : ''}`}>
      <span className={className}>
        {expanded ? text : `${text.slice(0, TEXT_LIMIT).trim()}…`}
      </span>

      <button
        type="button"
        className="read-more-btn"
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? 'read less' : 'read more'}
      </button>
    </span>
  )
}

export default function WordCard({ entry, onRemove, onEdit }) {
  const w = entry.words
  const say = [w.say, w.ipa].filter(Boolean).join(' · ')

  const [mode, setMode] = useState('view')
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
    if (!form || saving) return

    setSaving(true)

    try {
      await onEdit(entry, {
        word: form.word.trim(),
        emoji: form.emoji.trim() || null,
        meaning: form.meaning.trim(),
        example: form.example.trim(),
        say: form.say.trim(),
        ipa: form.ipa.trim(),
        note: form.note.trim() || null
      })

      setMode('view')
    } finally {
      setSaving(false)
    }
  }

  /*
   * EDIT MODE
   */
  if (mode === 'edit') {
    return (
      <tr className="word-row word-row-edit">
        <td colSpan="8">
          <div className="word-edit">
            <div className="word-edit-head">
              <strong>edit word</strong>

              <button
                type="button"
                className="link"
                disabled={saving}
                onClick={() => setMode('view')}
              >
                cancel
              </button>
            </div>

            <div className="word-edit-grid">
              <div className="word-edit-field word-edit-field-small">
                <label>emoji</label>
                <input
                  className="field"
                  value={form.emoji}
                  onChange={(e) =>
                    setForm({ ...form, emoji: e.target.value })
                  }
                  placeholder="emoji"
                />
              </div>

              <div className="word-edit-field">
                <label>word</label>
                <input
                  className="field"
                  value={form.word}
                  onChange={(e) =>
                    setForm({ ...form, word: e.target.value })
                  }
                  placeholder="word"
                />
              </div>

              <div className="word-edit-field">
                <label>say it like</label>
                <input
                  className="field"
                  value={form.say}
                  onChange={(e) =>
                    setForm({ ...form, say: e.target.value })
                  }
                  placeholder="say it like"
                />
              </div>

              <div className="word-edit-field">
                <label>IPA</label>
                <input
                  className="field"
                  value={form.ipa}
                  onChange={(e) =>
                    setForm({ ...form, ipa: e.target.value })
                  }
                  placeholder="IPA"
                />
              </div>
            </div>

            <div className="word-edit-field">
              <label>meaning</label>
              <textarea
                className="field"
                rows={3}
                value={form.meaning}
                onChange={(e) =>
                  setForm({ ...form, meaning: e.target.value })
                }
                placeholder="meaning"
              />
            </div>

            <div className="word-edit-field">
              <label>example</label>
              <textarea
                className="field"
                rows={3}
                value={form.example}
                onChange={(e) =>
                  setForm({ ...form, example: e.target.value })
                }
                placeholder="example"
              />
            </div>

            <div className="word-edit-field">
              <label>note</label>
              <input
                className="field"
                value={form.note}
                onChange={(e) =>
                  setForm({ ...form, note: e.target.value })
                }
                placeholder="note (optional)"
              />
            </div>

            <div className="word-edit-actions">
              <button
                className="btn btn-lime"
                disabled={saving}
                onClick={saveEdit}
              >
                {saving ? 'saving…' : 'save changes'}
              </button>

              <button
                className="btn btn-ghost"
                disabled={saving}
                onClick={() => setMode('view')}
              >
                cancel
              </button>
            </div>
          </div>
        </td>
      </tr>
    )
  }

  /*
   * VIEW MODE
   */
  return (
    <tr className="word-row">
      {/* WORD */}
      <td className="word-cell word-cell-main">
        <div className="word-table-name">
          {w.emoji && <span>{w.emoji}</span>}
          <strong>{w.word}</strong>
        </div>

        {w.note && (
          <div className="word-table-note">
            {w.note}
          </div>
        )}
      </td>

      {/* PRONUNCIATION */}
      <td className="word-cell word-cell-pronunciation">
        {say ? (
          <span>{say}</span>
        ) : (
          <span className="table-muted">—</span>
        )}
      </td>

      {/* MEANING */}
      <td className="word-cell word-cell-text">
        <ReadMoreText className="word-table-meaning">
          {w.meaning}
        </ReadMoreText>
      </td>

      {/* EXAMPLE */}
      <td className="word-cell word-cell-text">
        {w.example ? (
          <ReadMoreText className="word-table-example">
            {w.example}
          </ReadMoreText>
        ) : (
          <span className="table-muted">—</span>
        )}
      </td>

      {/* LEVEL */}
      <td className="word-cell">
        <span className={`chip chip-${entry.level}`}>
          {entry.level}
        </span>
      </td>

      {/* PROGRESS */}
      <td className="word-cell">
        <span className="tag-pill word-progress">
          {entry.right} / {entry.seen}
        </span>
      </td>

      {/* ADDED */}
      <td className="word-cell word-cell-added">
        <span
          className="hint"
          title={new Date(entry.added_at).toLocaleString()}
        >
          {timeAgo(entry.added_at)}
        </span>
      </td>

      {/* ACTIONS */}
      <td className="word-cell word-cell-actions">
        <div className="word-actions">
          {canSpeak && (
            <button
              type="button"
              className="speak speak-sm"
              onClick={() => speak(w.word)}
              aria-label={`listen to ${w.word}`}
            >
              ▸
            </button>
          )}

          {onEdit && (
            <button
              type="button"
              className="link"
              onClick={startEdit}
            >
              edit
            </button>
          )}

          {onRemove && (
            <>
              {mode === 'delete' ? (
                <span className="delete-confirm">
                  <span className="hint">delete?</span>

                  <button
                    type="button"
                    className="link link-danger"
                    onClick={() => onRemove(entry)}
                  >
                    yes
                  </button>

                  <button
                    type="button"
                    className="link"
                    onClick={() => setMode('view')}
                  >
                    no
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="link"
                  onClick={() => setMode('delete')}
                >
                  remove
                </button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  )
}