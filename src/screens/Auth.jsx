import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i
const TYPOS = {
  'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gnail.com': 'gmail.com',
  'yaho.com': 'yahoo.com', 'hotmial.com': 'hotmail.com', 'outlok.com': 'outlook.com',
  'iclould.com': 'icloud.com'
}

// Purely decorative examples for the logged-out hero — not real user data.
const SAMPLE_CARDS = [
  { word: 'paucity', body: ['a shortage,', 'very little of it'], bg: 'var(--pink)', shadow: 'rgba(180,120,180,.18)', box: { left: 0, top: 10, width: 190, height: 200, '--r': '-6deg' } },
  { word: 'quixotic', body: ['kwik-SOT-ik', '/kwɪkˈsɒtɪk/'], bg: 'var(--purple)', shadow: 'rgba(150,120,200,.2)', box: { left: 150, top: 80, width: 200, height: 210, '--r': '5deg' } },
  { word: 'known', big: '128', bg: 'var(--lime)', shadow: 'rgba(150,180,90,.2)', box: { left: 0, top: 270, width: 170, height: 170, '--r': '-3deg' } },
  { word: 'streak', big: '12 days', bg: 'var(--orange)', shadow: 'rgba(200,140,80,.2)', box: { left: 230, top: 290, width: 150, height: 130, '--r': '8deg' } }
]

export default function Auth() {
  const [email, setEmail] = useState('')
  const [suggest, setSuggest] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const keepTypo = useRef(false)
  const tickRef = useRef(null)

  useEffect(() => () => clearInterval(tickRef.current), [])

  function startCooldown() {
    clearInterval(tickRef.current)
    setCooldown(30)
    tickRef.current = setInterval(() => {
      setCooldown((n) => {
        if (n <= 1) {
          clearInterval(tickRef.current)
          return 0
        }
        return n - 1
      })
    }, 1000)
  }

  async function sendLink(address) {
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: window.location.origin }
    })
    setBusy(false)
    if (error) return setError(error.message)
    setEmail(address)
    setSent(true)
    startCooldown()
  }

  function submit(e) {
    e.preventDefault()
    const raw = email.trim().toLowerCase()
    if (!raw) return setError('enter your email — we send a sign-in link there')
    if (!EMAIL_RE.test(raw)) return setError("that doesn't look like an email address")

    const domain = raw.split('@')[1]
    if (TYPOS[domain] && !keepTypo.current) {
      setSuggest(raw.split('@')[0] + '@' + TYPOS[domain])
      setError('')
      return
    }
    keepTypo.current = false
    setSuggest('')
    sendLink(raw)
  }

  function resend() {
    if (cooldown > 0) return
    sendLink(email)
  }

  function useDifferentEmail() {
    setSent(false)
    setError('')
    clearInterval(tickRef.current)
    setCooldown(0)
  }

  return (
    <div className="shell">
      <div className="shell-inner shell-inner--wide">
        <div className="topbar">
          <div className="brand">wordy</div>
        </div>

        {sent ? (
          <div className="wizard">
            <div className="done-box">
              <div className="headline">check your inbox</div>
              <div>
                A sign-in link is on its way to {email}. Open it on this device to continue — the
                link works once and expires shortly after.
              </div>
            </div>
            <div className="row">
              <button className="btn btn-ghost" disabled={cooldown > 0} onClick={resend}>
                {cooldown > 0 ? `resend in ${cooldown}s` : 'resend the link'}
              </button>
              <button type="button" className="btn btn-pink" onClick={useDifferentEmail}>
                use a different email
              </button>
            </div>
            <p className="hint" style={{ marginTop: 14 }}>
              {cooldown > 0 ? 'check spam before asking again' : 'still nothing? try resending'}
            </p>
          </div>
        ) : (
          <div className="hero">
            <div className="hero-grid">
              <div>
                <div className="eyebrow">your words, always with you</div>
                <h1 className="hero-h1">wordy</h1>
                <h1 className="hero-h1 accent">every day</h1>
                <p className="hero-sub">
                  Type a word — an AI fills in the rest. Your collection stays yours.
                </p>

                <form className="hero-form" onSubmit={submit}>
                  <input
                    className="field"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setError('')
                      setSuggest('')
                    }}
                    disabled={busy}
                  />

                  {suggest && (
                    <div className="suggest-box">
                      <div>did you mean {suggest}?</div>
                      <button
                        type="button"
                        className="pill-btn-solid"
                        onClick={() => {
                          setEmail(suggest)
                          setSuggest('')
                        }}
                      >
                        yes, fix it
                      </button>
                      <button
                        type="button"
                        className="pill-btn-outline"
                        onClick={() => {
                          keepTypo.current = true
                          setSuggest('')
                          sendLink(email.trim().toLowerCase())
                        }}
                      >
                        keep mine
                      </button>
                    </div>
                  )}

                  {error && <p className="error">{error}</p>}
                  <div className="row" style={{ marginTop: 4 }}>
                    <button className="btn btn-lime" disabled={busy}>
                      {busy ? 'sending…' : 'send sign-in link'}
                    </button>
                  </div>
                </form>

                <p className="hint" style={{ marginTop: 14 }}>
                  no password — we email you a one-time link. new here? the same link creates your
                  account.
                </p>
              </div>

              <div className="hero-art">
                {SAMPLE_CARDS.map((c) => (
                  <div
                    key={c.word}
                    className="floaty-card"
                    style={{ ...c.box, background: c.bg, boxShadow: `0 18px 40px ${c.shadow}` }}
                  >
                    <span className="fc-tag">{c.word}</span>
                    {c.body && (
                      <div className="fc-body">
                        {c.body.map((line, i) => (
                          <span key={i}>
                            {line}
                            {i < c.body.length - 1 && <br />}
                          </span>
                        ))}
                      </div>
                    )}
                    {c.big && <div className="fc-big">{c.big}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
