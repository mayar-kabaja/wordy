import { useState } from 'react'

const DISMISS_KEY = 'wordy:a2hs-dismissed'
const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent)
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

// Android/Chrome already offers its own install banner once a manifest and
// icons exist (both added alongside this) — no custom prompt needed there.
// iOS Safari has no such affordance, so that's the only platform this nudges.
export default function InstallLink() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1')

  if (dismissed || !isIos() || isStandalone()) return null

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className="a2hs-toast">
      <div className="a2hs-icon" />
      <div className="a2hs-body">
        <p className="a2hs-title">keep wordy one tap away</p>
        <p className="a2hs-text">
          tap the share icon <span className="a2hs-share">↑</span> then "add to home screen".
        </p>
      </div>
      <button type="button" className="a2hs-close" aria-label="dismiss" onClick={dismiss}>
        ×
      </button>
    </div>
  )
}
