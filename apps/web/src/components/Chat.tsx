import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { RoomSnapshot } from '@rene/contracts';
import { send, useGame } from '../store';
import { PlayerName } from './PlayerName';
import { ChatReactions } from './ChatReactions';
import { AvatarPortrait } from './AvatarPortrait';
export function Chat({ room, visible, controls }: { room: RoomSnapshot; visible: boolean; controls: ReactNode }) {
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const list = useRef<HTMLDivElement>(null);
  const reactions = useGame(s => s.secret?.chatReactions);
  const me = useGame(s => s.session!.playerId); const connected = useGame(s => s.connected); const player = room.players.find(p => p.id === me);
  const active = room.game && room.game.phase !== 'results'; const allowed = !active || room.settings.deadCanSpeak || (!!player?.alive && !player.waiting);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'instant' }); }, [room.chat.length, visible]);
  return <section id="room-discussion" className="chat-panel" hidden={!visible} data-occluder><div className="panel-label"><h3>Les petites conversations</h3>{controls}</div><div className="chat-messages" ref={list} role="log" aria-label="Messages du salon" aria-live="polite">{room.chat.length === 0 && <p className="chat-empty">Un petit bonjour ?<br />On se suspectera plus tard.</p>}{room.chat.map(message => {
    const author = room.players.find(p => p.id === message.playerId);
    return <div key={message.id} className={`chat-message ${message.playerId === me ? 'own' : ''}`}><div className="message-portrait" aria-hidden="true">{author ? <AvatarPortrait appearance={author.appearance} /> : <span className="neutral-portrait">?</span>}</div><div className="message-content"><div className="message-meta"><strong><PlayerName name={message.name} mark={room.game?.playerMarks[message.playerId]}>{message.playerId === me ? 'Vous' : message.name}</PlayerName></strong><time dateTime={new Date(message.at).toISOString()}>{new Date(message.at).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}</time></div><p>{message.text}</p><ChatReactions message={message} mine={reactions?.[message.id]} allowed={allowed && connected} /></div></div>;
  })}</div><form className="chat-form" onSubmit={async event => { event.preventDefault(); setBusy(true); if (await send({ type: 'chat.send', text })) setText(''); setBusy(false); }}><input aria-label="Message au salon" placeholder={allowed ? 'Un truc à dire ?' : 'Vous suivez la conversation…'} value={text} maxLength={400} disabled={!allowed || !connected} onChange={e => setText(e.target.value)} /><button aria-label="Envoyer le message" disabled={!allowed || !connected || busy || !text.trim()}>↗</button></form></section>;
}
