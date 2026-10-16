import { useEffect, useRef } from 'react';
import type { Description, PublicGame, PublicPlayer } from '@rene/contracts';
import { AvatarPortrait } from './AvatarPortrait';

export function DescriptionHistory({ game, players, visible }: { game: PublicGame | null; players: PublicPlayer[]; visible: boolean }) {
  const list = useRef<HTMLDivElement>(null); const current = useRef<HTMLElement>(null);
  const descriptions = game?.descriptions ?? [];
  useEffect(() => {
    if (!visible || !list.current) return;
    list.current.scrollTop = 0;
    current.current?.querySelector('[data-latest]')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  }, [descriptions.length, visible]);
  const rounds = [...new Set([...(game ? [game.round] : []), ...descriptions.map(d => d.round)])].sort((a, b) => b - a);
  const latest = descriptions.at(-1);
  function card(id: string, description?: Description) {
    const player = players.find(p => p.id === id);
    const active = !description && game?.phase === 'description' && game.turnPlayerId === id;
    const text = description ? description.timedOut ? '… temps écoulé' : description.text : active ? 'Cherche son indice…' : 'Indice attendu';
    return <li key={id} className={`${active ? 'clue-active' : ''} ${!description ? 'clue-pending' : ''} ${description?.timedOut ? 'clue-expired' : ''}`} data-latest={description === latest && !!description ? '' : undefined}>
      <div className="clue-author">{player && <AvatarPortrait appearance={player.appearance} />}<strong>{player?.name ?? 'Joueur parti'}</strong></div><span>{text}</span>
    </li>;
  }
  return <section className="description-history" aria-label="Les indices du salon"><div className="panel-label"><h3>Les indices du salon <span>{descriptions.length}</span></h3><span className="eyebrow">ON VOUS ÉCOUTE.</span></div>
    {!game ? <p className="clues-empty">Les premiers indices arriveront avec la partie.</p> : <>
      <p className="latest-clue sr-only" aria-live="polite">{latest ? `${players.find(p => p.id === latest.playerId)?.name ?? 'Joueur'} : ${latest.timedOut ? 'temps écoulé' : latest.text}` : 'En attente du premier indice.'}</p>
      <div className="history-rounds" ref={list}>{rounds.map((round, index) => {
        const clues = descriptions.filter(d => d.round === round);
        const content = <ol>{clues.map(d => card(d.playerId, d))}{round === game.round && game.order.filter(id => !clues.some(d => d.playerId === id) && players.some(p => p.id === id && p.alive && !p.waiting)).map(id => card(id))}</ol>;
        return index === 0 ? <section key={round} ref={current} aria-label={`Indices du tour ${round}`}><h3>TOUR {round}</h3>{content}</section> : <section key={round} aria-label={`Indices du tour ${round}`}><details><summary>TOUR {round} · {clues.length} indices</summary>{content}</details></section>;
      })}</div>
    </>}
  </section>;
}
