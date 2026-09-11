import { useEffect, useState } from 'react'

const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent)
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

// Android/Chrome can trigger the native install prompt directly. iOS has no
// such API — Safari only lets the user do it themselves via the share sheet
// — so there we just point at the steps instead of pretending to automate it.
export default function InstallLink() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showIosHint, setShowIosHint] = useState(false)

  useEffect(() => {
    function onBeforeInstall(e) {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  if (isStandalone()) return null
  if (!deferredPrompt && !isIos()) return null

  async function handleClick() {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      await deferredPrompt.userChoice
      setDeferredPrompt(null)
    } else {
      setShowIosHint(true)
    }
  }

  return (
    <div className="toast">
      <button
        type="button"
        onClick={handleClick}
        style={{ background: 'none', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: 0 }}
      >
        add wordy to your home screen
        {showIosHint && ' — tap the share icon, then "add to home screen"'}
      </button>
    </div>
  )
}
