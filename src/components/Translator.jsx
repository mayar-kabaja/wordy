import { useState } from 'react'
import { translateText } from '../lib/api'

const IS_AR = /[\u0600-\u06FF]/
const DIRS = [
  ['auto', 'detect'],
  ['en-ar', 'en → ع'],
  ['ar-en', 'ع → en']
]

export default function Translator() {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(false)
  const [dir, setDir] = useState('auto')
  const [draft, setDraft] = useState('')
  const [typing, setTyping] = useState(false)
  const [thread, setThread] = useState([
    { from: 'bot', text: 'type in english or عربي — i answer in the other one.', lang: 'en' }
  ])

  function toggle() {
    setOpen((o) => !o)
    setUnread(false)
  }

  async function send() {
    const raw = draft.trim()
    if (!raw || typing) return
    const mine = { from: 'me', text: raw, lang: IS_AR.test(raw) ? 'ar' : 'en' }
    setThread((t) => [...t, mine])
    setDraft('')
    setTyping(true)
    try {
      const r = await translateText(raw, dir)
      setThread((t) => [
        ...t,
        { from: 'bot', text: r.translation, lang: r.direction === 'en-ar' ? 'ar' : 'en', note: r.note }
      ])
    } catch (err) {
      setThread((t) => [...t, { from: 'bot', text: err.message, lang: 'en' }])
    } finally {
      setTyping(false)
      if (!open) setUnread(true)
    }
  }

  const arInput = dir === 'ar-en' || (dir === 'auto' && IS_AR.test(draft))
  const canSend = !!draft.trim() && !typing

  return (
    <div className="tr-dock">
      {open ? (
        <div className="tr-panel">
          <div className="tr-header">
            <img className="tr-header-icon" src="/favicon.svg" alt="" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="tr-header-title">translate · english ↔ عربي</div>
              <div className="tr-header-status">
                {dir === 'auto' ? 'direction detected from what you type' : dir === 'en-ar' ? 'english → arabic' : 'arabic → english'}
              </div>
            </div>
            <button type="button" className="tr-close" aria-label="close translator" onClick={toggle}>
              ×
            </button>
          </div>

          <div className="tr-dirs">
            {DIRS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`tr-dir-pill${dir === key ? ' active' : ''}`}
                onClick={() => setDir(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="tr-thread">
            {thread.map((m, i) => {
              const rtl = m.lang === 'ar'
              return (
                <div key={i} className={`tr-row${m.from === 'me' ? ' mine' : ''}`}>
                  <div className={`tr-bubble${m.from === 'me' ? ' mine' : ''}`}>
                    <div className={`tr-text${rtl ? ' rtl' : ''}`}>{m.text}</div>
                    {m.note && <div className="tr-note">{m.note}</div>}
                  </div>
                </div>
              )
            })}
            {typing && <div className="tr-typing">translating…</div>}
          </div>

          <div className="tr-inputrow">
            <div className="row" style={{ gap: 9, alignItems: 'flex-end' }}>
              <input
                className="tr-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder={arInput ? 'اكتب كلمة…' : 'type a word…'}
                dir={arInput ? 'rtl' : 'ltr'}
                disabled={typing}
              />
              <button type="button" className={`tr-send${canSend ? ' active' : ''}`} onClick={send} disabled={!canSend}>
                ↑
              </button>
            </div>
            <div className="tr-hint">enter to send · try hello, quiz, or مرحبا</div>
          </div>
        </div>
      ) : (
        <button type="button" className="tr-closed-card" aria-label="open translator" onClick={toggle}>
          <span className="tr-closed-icon">
            <img src="/favicon.svg" alt="" />
          </span>
          <span className="tr-closed-text">
            <span className="tr-closed-title">translate a word</span>
            <span className="tr-closed-sub">english ↔ عربي</span>
          </span>
          {unread && <span className="tr-closed-dot" />}
        </button>
      )}
    </div>
  )
}
