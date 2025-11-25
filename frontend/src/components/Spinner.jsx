// src/components/Spinner.jsx
export default function Spinner({ size = 5, className = "" }) {
  const s = size; // rem
  return (
    <div className={`inline-block animate-spin ${className}`} role="status" aria-label="loading">
      <svg style={{ width: `${s}rem`, height: `${s}rem` }} viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="25" cy="25" r="20" stroke="currentColor" strokeOpacity="0.15" strokeWidth="6"/>
        <path d="M45 25A20 20 0 0 0 5 25" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/>
      </svg>
    </div>
  );
}
