// Short UI feedback sounds, synthesized on the fly — no audio files to fetch
// or host, just a few oscillator tones through the Web Audio API.

let ctx = null
function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function tone(freq, start, duration, type = 'sine', peak = 0.15) {
  const ac = getCtx()
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, ac.currentTime + start)
  gain.gain.linearRampToValueAtTime(peak, ac.currentTime + start + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + duration)
  osc.connect(gain).connect(ac.destination)
  osc.start(ac.currentTime + start)
  osc.stop(ac.currentTime + start + duration + 0.02)
}

export function playWordAdded() {
  tone(880, 0, 0.18)
}

export function playCorrect() {
  tone(1046.5, 0, 0.1)
  tone(1318.5, 0.09, 0.16)
}

export function playWrong() {
  tone(220, 0, 0.22, 'square', 0.08)
}

export function playQuizStart() {
  tone(500, 0, 0.15)
}

export function playQuizComplete() {
  tone(523.25, 0, 0.12)
  tone(659.25, 0.1, 0.12)
  tone(783.99, 0.2, 0.22)
}
