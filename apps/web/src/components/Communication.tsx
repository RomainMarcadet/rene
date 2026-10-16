import { useEffect, useRef, useState } from 'react';
import type { RoomSnapshot } from '@rene/contracts';
import { Chat } from './Chat';
import { Voice } from './Voice';
export function Communication({ room, visible, onExpand }: { room: RoomSnapshot; visible: boolean; onExpand: (expanded: boolean) => void }) {
  const [expanded, setExpanded] = useState(false);
  const expandButton = useRef<HTMLButtonElement>(null); const closeButton = useRef<HTMLButtonElement>(null);
  function restoreFocus() {
    requestAnimationFrame(() => {
      if (expandButton.current?.getClientRects().length) expandButton.current.focus();
      else document.querySelector<HTMLButtonElement>('.drawer-tabs [aria-controls="room-discussion"]')?.focus();
    });
  }
  function toggle(value: boolean) { setExpanded(value); onExpand(value); }
  useEffect(() => {
    if (!expanded) return;
    closeButton.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) {
        event.preventDefault(); setExpanded(false); onExpand(false); restoreFocus();
      }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [expanded, onExpand]);
  return <section className={`communication-zone ${expanded ? 'expanded' : ''}`} aria-label="Communication">
    <Chat room={room} visible={visible || expanded} controls={<button ref={expanded ? closeButton : expandButton} className="icon-button chat-expand" aria-label={expanded ? 'Réduire la discussion' : 'Agrandir la discussion'} aria-expanded={expanded} onClick={() => { toggle(!expanded); if (expanded) restoreFocus(); }}>{expanded ? '✕' : '⤢'}</button>} />
    <Voice generation={room.voiceGeneration} />
  </section>;
}
