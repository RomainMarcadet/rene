import { useRef, useState } from 'react';
import type { RoomSnapshot } from '@rene/contracts';
import { PlayerName } from './PlayerName';
import { send, useGame } from '../store';

export function VoteReadiness({ room }: { room: RoomSnapshot }) {
  const me = useGame(s => s.session!.playerId); const connected = useGame(s => s.connected);
  const [busy, setBusy] = useState(false); const pending = useRef(false);
  const alive = room.players.filter(p => p.alive && !p.waiting);
  const ready = alive.filter(p => room.game!.readyToVotePlayerIds.includes(p.id));
  const localReady = ready.some(p => p.id === me); const eligible = alive.some(p => p.id === me);
  return <section className="vote-readiness" aria-label="Préparation du vote">
    <div><strong>PRÊT À VOTER ?</strong><span role="status">{ready.length} / {alive.length} JOUEURS PRÊTS</span></div>
    <progress max={alive.length || 1} value={ready.length} aria-label="Joueurs prêts à voter" />
    <p>Tout le monde confirme ? On passe à table. Sinon, la discussion continue jusqu’au chronomètre.</p>
    {ready.length > 0 && <p className="ready-names">{ready.map((p, i) => <span key={p.id}>{i > 0 && ', '}<PlayerName name={p.name} mark={room.game?.playerMarks[p.id]} /></span>)} {ready.length > 1 ? 'ont' : 'a'} déjà fait le tour des soupçons.</p>}
    {eligible && <button className={`button ${localReady ? 'button-cream' : 'button-yellow'}`} aria-pressed={localReady} disabled={busy || !connected} onClick={async () => {
      if (pending.current) return;
      pending.current = true; setBusy(true);
      try { await send({ type: 'game.setVoteReady', ready: !localReady }); }
      finally { pending.current = false; setBusy(false); }
    }}>{localReady ? 'Annuler ma confirmation ↶' : 'Je suis prêt à voter ✓'}</button>}
  </section>;
}
