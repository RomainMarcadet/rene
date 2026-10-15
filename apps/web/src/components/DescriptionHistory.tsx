import { useEffect, useRef } from 'react';
import type { Description, PublicPlayer } from '@rene/contracts';

export function DescriptionHistory({ descriptions, players, open }: { descriptions: Description[]; players: PublicPlayer[]; open: boolean }) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => { if (list.current) list.current.scrollTop = 0; }, [descriptions.length]);
  if (!descriptions.length) return null;
  // Copy/group the projection: keep the server's turn order inside each round.
  const rounds = [...new Set(descriptions.map(d => d.round))].sort((a, b) => b - a);
  const latest = descriptions[descriptions.length - 1];
  const name = (id: string) => players.find(p => p.id === id)?.name ?? 'Joueur';
  const text = (d: Description) => d.timedOut ? '… temps écoulé' : d.text;
  return <details className="description-history" open={open}>
    <summary>Les indices du salon <span>{descriptions.length}</span></summary>
    <p className="latest-clue" aria-live="polite"><span className="eyebrow">DERNIER INDICE · TOUR {latest.round}</span><strong>{name(latest.playerId)}</strong> : {text(latest)}</p>
    <div className="history-rounds" ref={list}>{rounds.map(round => <section key={round} aria-label={`Indices du tour ${round}`}>
      <h3>TOUR {round}</h3><ol>{descriptions.filter(d => d.round === round).map(d => <li key={`${d.playerId}-${d.round}`}><strong>{name(d.playerId)}</strong><span>{text(d)}</span></li>)}</ol>
    </section>)}</div>
  </details>;
}
