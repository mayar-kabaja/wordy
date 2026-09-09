// Browser text-to-speech. No audio files, no network — the words are read
// by whatever English voice the device already has.

export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

let cached = null

function pickVoice() {
  if (cached) return cached
  const voices = window.speechSynthesis.getVoices()
  cached =
    voices.find((v) => v.lang === 'en-GB' && v.localService) ||
    voices.find((v) => v.lang.startsWith('en') && v.localService) ||
    voices.find((v) => v.lang.startsWith('en')) ||
    null
  return cached
}

export function speak(text) {
  if (!canSpeak || !text) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  const v = pickVoice()
  if (v) u.voice = v
  u.lang = v?.lang || 'en-GB'
  u.rate = 0.9
  window.speechSynthesis.speak(u)
}

let unlocked = false

// iOS Safari only allows speechSynthesis.speak() to fire audio when it's the
// direct result of a tap. Call this once from inside a real click handler —
// it plays a silent utterance that unlocks speech for the rest of the page,
// so later calls from timers/effects (e.g. the quiz auto-reading a question) work too.
export function unlockSpeech() {
  if (!canSpeak || unlocked) return
  unlocked = true
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(' '))
}
