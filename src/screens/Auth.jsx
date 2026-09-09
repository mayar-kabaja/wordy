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
  const [mode, setMode] = useState('login')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [step, setStep] = useState(1)
  const [suEmail, setSuEmail] = useState('')
  const [suggest, setSuggest] = useState('')
  const [suPw, setSuPw] = useState('')
  const [suPw2, setSuPw2] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [suError, setSuError] = useState('')
  const [submitting, setSubmitting] = useState(false)
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

  function resetSignup() {
    setStep(1)
    setSuEmail('')
    setSuggest('')
    setSuPw('')
    setSuPw2('')
    setSuError('')
    setSubmitting(false)
    clearInterval(tickRef.current)
    setCooldown(0)
  }

  async function submitLogin(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setError(error.message)
  }

  function continueEmail(e) {
    e.preventDefault()
    const raw = suEmail.trim().toLowerCase()
    if (!raw) return setSuError('enter your email — we send a confirmation link there')
    if (!EMAIL_RE.test(raw)) return setSuError("that doesn't look like an email address")

    const domain = raw.split('@')[1]
    if (TYPOS[domain] && !keepTypo.current) {
      setSuggest(raw.split('@')[0] + '@' + TYPOS[domain])
      setSuError('')
      return
    }
    keepTypo.current = false
    setSuEmail(raw)
    setSuggest('')
    setSuError('')
    setStep(2)
  }

  // Whether the email is already registered isn't something we check up
  // front — Supabase deliberately won't answer that (it would let anyone
  // enumerate accounts). The real signUp call below handles it silently.
  async function submitPassword(e) {
    e.preventDefault()
    if (suPw.length < 8) return setSuError('needs at least 8 characters')
    if (suPw !== suPw2) return setSuError("the two passwords don't match")

    setSubmitting(true)
    setSuError('')
    const { data, error } = await supabase.auth.signUp({ email: suEmail, password: suPw })
    setSubmitting(false)
    if (error) return setSuError(error.message)
    if (!data.session) {
      setStep(3)
      startCooldown()
    }
  }

  async function resend() {
    if (cooldown > 0) return
    startCooldown()
    try {
      await supabase.auth.resend({ type: 'signup', email: suEmail })
    } catch {
      /* cooldown already protects against spamming retries */
    }
  }

  const passwordOk = suPw.length >= 8
  const mismatch = suPw2.length > 0 && suPw !== suPw2

  return (
    <div className="shell">
      <div className={`shell-inner${mode === 'login' ? ' shell-inner--wide' : ''}`}>
      <div className="topbar">
        <div className="brand">wordy</div>
      </div>

      {mode === 'login' && (
        <div className="hero">
          <div className="hero-grid">
            <div>
              <div className="eyebrow">your words, always with you</div>
              <h1 className="hero-h1">wordy</h1>
              <h1 className="hero-h1 accent">every day</h1>
              <p className="hero-sub">
                Type a word — an AI fills in the rest. Your collection stays yours.
              </p>

              <form className="hero-form" onSubmit={submitLogin}>
                <input
                  className="field"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <input
                  className="field"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {error && <p className="error">{error}</p>}
                <div className="row" style={{ marginTop: 4 }}>
                  <button className="btn btn-lime" disabled={busy}>
                    {busy ? 'one moment…' : 'log in'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setMode('signup')
                      resetSignup()
                    }}
                  >
                    create account
                  </button>
                </div>
              </form>
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

      {mode === 'signup' && (
        <div className="wizard">
          <div className="step-row">
            {['email', 'password', 'confirm'].map((label, i) => (
              <div
                key={label}
                className={`step-chip${step === i + 1 ? ' active' : ''}${step > i + 1 ? ' done' : ''}`}
              >
                {label}
              </div>
            ))}
          </div>

          {step === 1 && (
            <>
              <h1 className="title">create your account</h1>
              <p className="sub">first your email — we check it before anything else.</p>

              <form className="panel" onSubmit={continueEmail}>
                <span className="label" style={{ marginLeft: 0 }}>email</span>
                <input
                  className="field"
                  placeholder="you@example.com"
                  value={suEmail}
                  onChange={(e) => {
                    setSuEmail(e.target.value)
                    setSuError('')
                    setSuggest('')
                  }}
                />

                {suggest && (
                  <div className="suggest-box">
                    <div>did you mean {suggest}?</div>
                    <button
                      type="button"
                      className="pill-btn-solid"
                      onClick={() => {
                        setSuEmail(suggest)
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
                        continueEmail({ preventDefault() {} })
                      }}
                    >
                      keep mine
                    </button>
                  </div>
                )}

                {suError && <p className="error" style={{ marginTop: 12 }}>{suError}</p>}

                <div className="row" style={{ marginTop: 22 }}>
                  <button className="btn btn-lime">continue</button>
                  <span className="hint">no card, no spam — one confirmation link.</span>
                </div>
              </form>

              <p className="hint" style={{ marginTop: 20, fontSize: 14 }}>
                already have an account?{' '}
                <button type="button" className="link" onClick={() => setMode('login')}>
                  log in
                </button>
              </p>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="title">create your account</h1>
              <p className="sub">now pick a password — it needs at least 8 characters.</p>

              <form className="panel" onSubmit={submitPassword}>
                <div className="email-pill">
                  <span>{suEmail}</span>
                  <button type="button" className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: 13 }} onClick={() => setStep(1)}>
                    change
                  </button>
                </div>

                <span className="label" style={{ marginLeft: 0 }}>password</span>
                <div className="row">
                  <input
                    className="field"
                    style={{ flex: '1 1 200px' }}
                    type={showPw ? 'text' : 'password'}
                    placeholder="at least 8 characters"
                    value={suPw}
                    onChange={(e) => {
                      setSuPw(e.target.value)
                      setSuError('')
                    }}
                  />
                  <button type="button" className="btn btn-ghost" onClick={() => setShowPw((v) => !v)}>
                    {showPw ? 'hide' : 'show'}
                  </button>
                </div>

                <span className="label" style={{ marginLeft: 0, marginTop: 18 }}>repeat it</span>
                <input
                  className="field"
                  type={showPw ? 'text' : 'password'}
                  placeholder="same password again"
                  value={suPw2}
                  onChange={(e) => {
                    setSuPw2(e.target.value)
                    setSuError('')
                  }}
                />
                {mismatch && <p className="hint" style={{ color: '#c06a9c', marginTop: 8 }}>these two don't match yet</p>}

                <div className={`rule-row ${passwordOk ? 'ok' : 'pending'}`} style={{ marginTop: 18 }}>
                  <span>{passwordOk ? '✓' : '·'}</span>
                  <span>at least 8 characters</span>
                </div>

                {suError && <p className="error" style={{ marginTop: 12 }}>{suError}</p>}

                <div style={{ marginTop: 22 }}>
                  <button className="btn btn-lime" disabled={submitting}>
                    {submitting ? 'creating…' : 'create account'}
                  </button>
                </div>
              </form>
            </>
          )}

          {step === 3 && (
            <>
              <div className="done-box">
                <div className="headline">check your inbox</div>
                <div>
                  A confirmation link is on its way to {suEmail}. Open it to confirm the address — the
                  link works once and expires in an hour.
                </div>
              </div>
              <div className="row">
                <button className="btn btn-ghost" disabled={cooldown > 0} onClick={resend}>
                  {cooldown > 0 ? `resend in ${cooldown}s` : 'resend the link'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
                  wrong email?
                </button>
                <button
                  type="button"
                  className="btn btn-pink"
                  onClick={() => {
                    setMode('login')
                    resetSignup()
                  }}
                >
                  back to log in
                </button>
              </div>
              <p className="hint" style={{ marginTop: 14 }}>
                {cooldown > 0 ? 'check spam before asking again' : 'still nothing? try resending'}
              </p>
            </>
          )}
        </div>
      )}
      </div>
    </div>
  )
}
