import { useEffect, useMemo, useState } from 'react'
import WordCard from '../components/WordCard'
import { MIN_WORDS } from '../lib/quiz'

const FILTERS = [
  { key: 'all', label: 'all' },
  { key: 'new', label: 'new' },
  { key: 'learning', label: 'learning' },
  { key: 'known', label: 'known' },
  { key: 'due', label: 'due for review' }
]

const PAGE_SIZE = 24

// Always shows first/last and a window around the current page, e.g. 1 … 4 5 6 … 15
function pageNumbers(current, total) {
  const pages = []
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - current) <= 1) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…')
    }
  }
  return pages
}

export default function WordList({ entries, loading, query, onAdd, onRemove, onEdit }) {
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [filter, query])

  const counts = useMemo(() => {
    const now = Date.now()
    return {
      total: entries.length,
      new: entries.filter((e) => e.level === 'new').length,
      learning: entries.filter((e) => e.level === 'learning').length,
      known: entries.filter((e) => e.level === 'known').length,
      due: entries.filter((e) => new Date(e.due_at).getTime() <= now).length
    }
  }, [entries])

  const shown = useMemo(() => {
    let list = entries
    if (filter === 'due') list = list.filter((e) => new Date(e.due_at).getTime() <= Date.now())
    else if (filter !== 'all') list = list.filter((e) => e.level === filter)

    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (e) => e.words.word.toLowerCase().includes(q) || e.words.meaning.toLowerCase().includes(q)
      )
    }
    return list
  }, [entries, filter, query])

  if (loading) {
    return <p className="empty">loading your words…</p>
  }

  if (entries.length === 0) {
    return (
      <div className="empty">
        <h1 className="title">nothing here yet</h1>
        <p className="sub center" style={{ margin: '0 auto 24px' }}>
          Add your first word and the meaning, example and pronunciation fill themselves in.
        </p>
        <button className="btn" onClick={onAdd}>
          add a word
        </button>
      </div>
    )
  }

  const canQuiz = entries.length >= MIN_WORDS
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageItems = shown.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <>
      <div className="home-head">
        <div>
          <h1 className="title" style={{ margin: 0 }}>your words</h1>
          <h1 className="title accent" style={{ margin: 0 }}>{counts.total} of them</h1>
        </div>
      </div>

      {!canQuiz && (
        <p className="sub">
          Add {MIN_WORDS - entries.length} more to unlock quizzes — each question needs four options.
        </p>
      )}

      <div className="tile-grid tile-grid--home">
        <div className="tile tile-pink">
          <div className="tile-label">new</div>
          <div className="tile-value tile-value--lg">{counts.new}</div>
        </div>
        <div className="tile tile-purple">
          <div className="tile-label">learning</div>
          <div className="tile-value tile-value--lg">{counts.learning}</div>
        </div>
        <div className="tile tile-lime">
          <div className="tile-label">known</div>
          <div className="tile-value tile-value--lg">{counts.known}</div>
        </div>
        <div className="tile tile-orange">
          <div className="tile-label">due for review</div>
          <div className="tile-value tile-value--lg">{counts.due}</div>
        </div>
      </div>

      <div className="filters">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className="filter"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="empty">{query ? `no words match "${query}".` : 'no words in this group.'}</p>
      ) : (
        <>
          <div className="word-list">
            {pageItems.map((entry) => (
              <WordCard key={entry.id} entry={entry} onRemove={onRemove} onEdit={onEdit} />
            ))}
          </div>

          {pageCount > 1 && (
            <div className="row" style={{ justifyContent: 'center', marginTop: 28, gap: 8 }}>
              <button
                className="btn btn-ghost"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
              >
                ‹
              </button>
              {pageNumbers(currentPage, pageCount).map((p, i) =>
                p === '…' ? (
                  <span key={`ellipsis-${i}`} className="hint">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    className="filter"
                    aria-pressed={p === currentPage}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                className="btn btn-ghost"
                disabled={currentPage === pageCount}
                onClick={() => setPage(currentPage + 1)}
              >
                ›
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}
