// The "pinned note" mark: a note card with a pin through its corner —
// a word you decided to keep. Below ~24px the note's rule lines stop
// reading, so use the plain text wordmark instead at small sizes.
export default function WordyMark({ size = 64 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 132 132" fill="none" aria-hidden="true">
      <g transform="rotate(-7 65 77)">
        <path
          d="M26 26H104A12 12 0 0 1 116 38V116A12 12 0 0 1 104 128H50A36 36 0 0 1 14 92V38A12 12 0 0 1 26 26Z"
          fill="var(--pink)"
        />
        <rect x="36" y="56" width="50" height="7" rx="3.5" fill="rgba(17,17,17,0.35)" />
        <rect x="36" y="73" width="33" height="7" rx="3.5" fill="rgba(17,17,17,0.2)" />
      </g>
      <circle cx="99" cy="25" r="17" fill="#111" />
      <circle cx="99" cy="25" r="5" fill="var(--lime)" />
    </svg>
  )
}
