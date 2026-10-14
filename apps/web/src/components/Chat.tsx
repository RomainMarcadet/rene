import { useEffect, useRef, useState } from 'react';
import type { RoomSnapshot } from '@rene/contracts';
import { send, useGame } from '../store';
export function Chat({ room }: { room: RoomSnapshot }) {
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const list = useRef<HTMLDivElement>(null);
  const me = useGame(s => s.session!.playerId); const connected = useGame(s => s.connected); const player = room.players.find(p => p.id === me);
  const active = room.game && room.game.phase !== 'results'; const allowed = !active || room.settings.deadCanSpeak || (!!player?.alive && !player.waiting);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'instant' }); }, [room.chat.length]);
  return <section className="chat-panel"><div className="panel-label"><h3>Les petites conversations</h3><span>↙</span></div><div className="chat-messages" ref={list} role="log" aria-label="Messages du salon" aria-live="polite">{room.chat.length === 0 && <p className="chat-empty">Un petit bonjour ?<br />On se suspectera plus tard.</p>}{room.chat.map(message => <div key={message.id} className={`chat-message ${message.playerId === me ? 'own' : ''}`}><strong>{message.playerId === me ? 'Vous' : message.name}</strong><p>{message.text}</p></div>)}</div><form className="chat-form" onSubmit={async event => { event.preventDefault(); setBusy(true); if (await send({ type: 'chat.send', text })) setText(''); setBusy(false); }}><input aria-label="Message au salon" placeholder={allowed ? 'Un truc à dire ?' : 'Vous suivez la conversation…'} value={text} maxLength={400} disabled={!allowed || !connected} onChange={e => setText(e.target.value)} /><button aria-label="Envoyer le message" disabled={!allowed || !connected || busy || !text.trim()}>↗</button></form></section>;
}
