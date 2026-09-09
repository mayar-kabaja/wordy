import { useEffect, useRef, useState } from 'react'
import { buildSession, grade, summarise, SESSION_LENGTH, TYPES } from '../lib/quiz'
import { saveProgress } from '../lib/api'
import { speak, canSpeak } from '../lib/speech'

const MAX_QUESTIONS = 50
const TIMER_OPTIONS = [0, 10, 15, 20, 30, 45, 60]
const DEFAULT_TIMER = 20

export default function Quiz({ entries, onFinish, onQuit, onRestart }) {
  // The pool is frozen once, from the list as it was when the quiz screen
  // opened. Refreshing the list afterwards must not reshuffle a quiz in progress.
  const frozen = useRef(entries)
  const maxQuestions = Math.min(MAX_QUESTIONS, frozen.current.length * 3)

  const [started, setStarted] = useState(false)
  const [questionCount, setQuestionCount] = useState(Math.min(SESSION_LENGTH, maxQuestions))
  const [timerSeconds, setTimerSeconds] = useState(DEFAULT_TIMER)
  const [session, setSession] = useState([])

  const [index, setIndex] = useState(0)
  const [chosen, setChosen] = useState(null)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [timeLeft, setTimeLeft] = useState(timerSeconds)

  // Where each word started, and where it ends up. Repeats within a session
  // build on the running state rather than on the original row.
  const before = useRef(
    Object.fromEntries(frozen.current.map((e) => [e.id, { level: e.level, streak: e.streak, seen: e.seen, right: e.right }]))
  )
  const working = useRef({ ...before.current })

  const current = session[index]

  function startQuiz() {
    setSession(buildSession(frozen.current, questionCount))
    setStarted(true)
  }

  useEffect(() => {
    if (current?.question.speak) speak(current.question.speak)
  }, [index, current])

  // Per-question countdown. Only runs while unanswered; hitting zero counts
  // as a wrong answer so the session can't stall on one question.
  useEffect(() => {
    if (!started || !timerSeconds || done || chosen !== null) return
    setTimeLeft(timerSeconds)
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(id)
          timeout()
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, started, timerSeconds, chosen, done])

  if (!started) {
    return (
      <>
        <h1 className="title">quiz setup</h1>
        <p className="sub">Choose how many questions and whether each one is timed.</p>

        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault()
            startQuiz()
          }}
        >
          <span className="label" style={{ marginLeft: 0 }}>number of questions</span>
          <input
            type="number"
            className="field"
            min={1}
            max={maxQuestions}
            value={questionCount}
            onChange={(e) =>
              setQuestionCount(Math.max(1, Math.min(maxQuestions, Number(e.target.value) || 1)))
            }
          />

          <span className="label" style={{ marginLeft: 0, marginTop: 18 }}>time per question</span>
          <select
            className="field"
            value={timerSeconds}
            onChange={(e) => setTimerSeconds(Number(e.target.value))}
          >
            {TIMER_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === 0 ? 'no limit' : `${s} seconds`}
              </option>
            ))}
          </select>

          <div className="row" style={{ marginTop: 22 }}>
            <button className="btn btn-lime">start quiz</button>
            <button type="button" className="btn btn-ghost" onClick={onQuit}>
              back to my words
            </button>
          </div>
        </form>
      </>
    )
  }

  if (session.length === 0) {
    return (
      <div className="empty">
        <p>No words are ready for a quiz yet.</p>
        <button className="btn" onClick={onQuit}>
          back to my words
        </button>
      </div>
    )
  }

  function answer(i) {
    if (chosen !== null) return
    const correct = i === current.question.answer
    setChosen(i)
    if (correct) setScore((s) => s + 1)

    const id = current.entry.id
    working.current[id] = grade(working.current[id] ?? current.entry, correct)
  }

  function timeout() {
    if (chosen !== null) return
    setChosen(-1)
    const id = current.entry.id
    working.current[id] = grade(working.current[id] ?? current.entry, false)
  }

  // Leaving early keeps whatever was answered — an interrupted session
  // shouldn't cost the user the words they just got right.
  async function stopHere() {
    const answered = session.slice(0, index + 1).map((q) => q.entry.id)
    const updates = [...new Set(answered)].map((id) => ({ id, ...working.current[id] }))
    try {
      await saveProgress(updates)
    } catch {
      /* nothing useful to do here — the user is on their way out */
    }
    onFinish()
    onQuit()
  }

  async function next() {
    if (index + 1 < session.length) {
      setIndex((i) => i + 1)
      setChosen(null)
      return
    }

    setDone(true)
    const touched = new Set(session.map((q) => q.entry.id))
    const updates = [...touched].map((id) => ({ id, ...working.current[id] }))
    try {
      await saveProgress(updates)
    } catch (err) {
      setSaveError('Your answers could not be saved. Check your connection and try another round.')
    }
    onFinish()
  }

  if (done) {
    const { promoted, mastered, dropped } = summarise(before.current, working.current)
    return (
      <div className="center" style={{ paddingTop: 30 }}>
        <p className="hint">quiz finished</p>
        <p className="score">
          {score}
          <span style={{ color: 'var(--faint)', fontSize: '0.5em' }}> / {session.length}</span>
        </p>

        <div className="tile-grid" style={{ textAlign: 'left', maxWidth: 500, margin: '26px auto 32px' }}>
          <div className="tile tile-pink">
            <div className="tile-label">moved up to learning</div>
            <div className="tile-value">{promoted}</div>
          </div>
          <div className="tile tile-lime">
            <div className="tile-label">became known</div>
            <div className="tile-value">{mastered}</div>
          </div>
          <div className="tile tile-orange">
            <div className="tile-label">dropped back</div>
            <div className="tile-value">{dropped}</div>
          </div>
        </div>

        {saveError && <p className="error">{saveError}</p>}

        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn btn-lime" onClick={onRestart}>
            quiz again
          </button>
          <button className="btn btn-ghost" onClick={onQuit}>
            back to my words
          </button>
        </div>
      </div>
    )
  }

  const q = current.question
  const isRight = chosen !== null && chosen === q.answer
  const timedOut = chosen === -1
  const optionIsWord = q.type === TYPES.MEANING_WORD || q.type === TYPES.SENTENCE_WORD

  return (
    <>
      <div className="quiz-top">
        <span className="counter">
          question {index + 1} of {session.length}
        </span>
        {timerSeconds > 0 && (
          <span className={`timer${timeLeft <= 5 ? ' timer-low' : ''}`}>{timeLeft}s</span>
        )}
        <span className="qtype">{q.type}</span>
      </div>

      <div className="progress">
        <span style={{ width: `${(index / session.length) * 100}%` }} />
      </div>

      {q.speak && canSpeak && (
        <button className="big-listen" onClick={() => speak(q.speak)} aria-label="play the word again">
          ▸
        </button>
      )}

      <h2 className={q.small ? 'prompt prompt-small' : 'prompt'}>{q.prompt}</h2>

      <div className="options">
        {q.options.map((opt, i) => {
          let cls = 'option'
          if (chosen !== null) {
            if (i === q.answer) cls += ' option-right'
            else if (i === chosen) cls += ' option-wrong'
          }
          return (
            <div key={i} className="option-row">
              <button className={cls} onClick={() => answer(i)} disabled={chosen !== null}>
                {opt}
              </button>
              {optionIsWord && canSpeak && (
                <button
                  type="button"
                  className="speak speak-sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    speak(opt)
                  }}
                  aria-label={`listen to ${opt}`}
                >
                  🔊
                </button>
              )}
            </div>
          )
        })}
      </div>

      {chosen !== null && (
        <>
          <p className="feedback">
            {timedOut ? (
              <>
                time&apos;s up. <b>{current.entry.words.word}</b> means {current.entry.words.meaning}
              </>
            ) : isRight ? (
              <>
                that&apos;s it. <b>{current.entry.words.word}</b> — {current.entry.words.meaning}
              </>
            ) : (
              <>
                not this time. <b>{current.entry.words.word}</b> means {current.entry.words.meaning}
              </>
            )}
          </p>
          <div className="row" style={{ marginTop: 20 }}>
            <button className="btn" onClick={next} autoFocus>
              {index + 1 === session.length ? 'see how you did' : 'next'}
            </button>
            <button className="btn btn-ghost" onClick={stopHere}>
              stop here
            </button>
          </div>
        </>
      )}
    </>
  )
}
