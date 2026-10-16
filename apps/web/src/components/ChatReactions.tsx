import { useRef, useState } from 'react';
import type { ChatMessage, ChatReaction } from '@rene/contracts';
import { send } from '../store';

export function ChatReactions({ message, mine, allowed }: { message: ChatMessage; mine?: ChatReaction; allowed: boolean }) {
  const pending = useRef(false); const [busy, setBusy] = useState(false);
  async function react(reaction: ChatReaction) {
    if (pending.current || !allowed) return;
    pending.current = true; setBusy(true);
    try { await send({ type: 'chat.react', messageId: message.id, reaction: mine === reaction ? null : reaction }); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="chat-reactions" role="group" aria-label={`Réactions au message de ${message.name}`}>
    {(['up', 'down'] as const).map(reaction => <button key={reaction} aria-label={`${reaction === 'up' ? 'Soutenir' : 'Désapprouver'} le message de ${message.name}`} aria-pressed={mine === reaction} disabled={!allowed || busy} onClick={() => void react(reaction)}><span aria-hidden="true">{reaction === 'up' ? '▲' : '▼'}</span> <span aria-label={`${message.reactions[reaction]} réactions`}>{message.reactions[reaction]}</span></button>)}
  </div>;
}
