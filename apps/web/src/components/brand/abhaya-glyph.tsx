interface AbhayaGlyphProps {
  className?: string;
}

export function AbhayaGlyph({ className }: AbhayaGlyphProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" role="img" aria-label="Abhaya">
      <path
        d="M24 5.5c8.9 4.2 14.6 6.1 14.6 6.1v11.1c0 9.2-5.4 16.3-14.6 20.2C14.8 39 9.4 31.9 9.4 22.7V11.6S15.1 9.7 24 5.5Z"
        fill="currentColor"
      />
      <path
        d="M17.7 25.2c2.7-5.2 7.3-8.4 13.7-9.4"
        fill="none"
        stroke="var(--paper)"
        strokeLinecap="round"
        strokeWidth="3.2"
      />
      <path
        d="M19.2 30.6c2.5-3.8 6.1-6.2 10.9-7.2"
        fill="none"
        stroke="var(--paper)"
        strokeLinecap="round"
        strokeOpacity="0.72"
        strokeWidth="3.2"
      />
      <circle cx="32.4" cy="15.4" r="2.7" fill="var(--paper)" />
      <circle cx="16.5" cy="31.5" r="2.7" fill="var(--paper)" />
    </svg>
  );
}
