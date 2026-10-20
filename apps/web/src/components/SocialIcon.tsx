type SocialIconKind = 'wave' | 'dance' | 'suspect' | 'nearby' | 'catalog' | 'punch' | 'stop';

/** Small local line drawings; gesture controls never depend on an emoji font. */
export function SocialIcon({ kind }: { kind: SocialIconKind }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {kind === 'wave' && <><path d="M8 11V6a1.5 1.5 0 0 1 3 0v4V4a1.5 1.5 0 0 1 3 0v6V5a1.5 1.5 0 0 1 3 0v7V8a1.5 1.5 0 0 1 3 0v6c0 4-2.5 7-6.5 7-2.8 0-4.7-1.2-6.1-3.4l-3.7-5.5a1.6 1.6 0 0 1 2.5-1.9L8 12" /><path d="M3 5 2 3M21 5l1-2" /></>}
    {kind === 'dance' && <><path d="M9 17V5l11-2v12M9 9l11-2" /><ellipse cx="6" cy="18" rx="3" ry="2.5" /><ellipse cx="17" cy="16" rx="3" ry="2.5" /></>}
    {kind === 'suspect' && <><path d="M2 12c3-4 6-6 10-6s7 2 10 6c-3 4-6 6-10 6s-7-2-10-6ZM4 4l6 1" /><circle cx="14" cy="12" r="2.5" fill="currentColor" stroke="none" /></>}
    {kind === 'nearby' && <><path d="M3 8h17l-4-4M21 16H4l4 4" /><path d="m17 8 3 .1M7 16l-3-.1" /></>}
    {kind === 'catalog' && <><circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" /></>}
    {kind === 'punch' && <><path d="M5 12V8a2 2 0 0 1 4 0V6a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v5c0 2-1 4-3 5v3H8v-3l-4-4a2 2 0 0 1 2.6-3L10 13h4" /><path d="M9 8v3M13 7v4M17 8v3" /></>}
    {kind === 'stop' && <rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" stroke="none" />}
  </svg>;
}
