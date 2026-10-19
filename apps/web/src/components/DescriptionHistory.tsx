import { useState } from 'react';
import type { Description, PublicGame, PublicPlayer } from '@rene/contracts';
import { AvatarPortrait } from './AvatarPortrait';
import { PlayerName, playerMarkStyle } from './PlayerName';
import { Modal } from './Modal';

export function DescriptionHistory({ game, players }: { game: PublicGame | null; players: PublicPlayer[]; visible: boolean }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const descriptions = game?.descriptions ?? [];
  const latest = descriptions.at(-1);
  const previousRounds = [...new Set(descriptions.map(d => d.round))].filter(round => round !== game?.round).sort((a, b) => b - a);
  const current = descriptions.filter(d => d.round === game?.round);
  // Placeholders already occupy the final slots; publication never reorders the cards.
  const currentIds = game?.order.filter(id => current.some(d => d.playerId === id) || players.some(p => p.id === id && p.alive && !p.waiting)) ?? [];
  function card(id: string, description?: Description, currentRound = false) {
    const player = players.find(p => p.id === id);
    const active = currentRound && !description && game?.phase === 'description' && game.turnPlayerId === id;
    const text = description ? description.timedOut ? '… temps écoulé' : description.text : active ? 'À son tour…' : 'Indice attendu';
    return <li key={id} data-player-id={id} aria-current={active ? 'step' : undefined} style={playerMarkStyle(game?.playerMarks[id])} className={`${active ? 'clue-active' : ''} ${!description ? 'clue-pending' : ''} ${description?.timedOut ? 'clue-expired' : ''}`}>
      <div className="clue-content"><div className="clue-portrait">{player ? <AvatarPortrait appearance={player.appearance} /> : <span className="neutral-portrait" role="img" aria-label="Portrait indisponible">?</span>}{active && <span className="clue-turn" aria-label="À son tour">↗</span>}</div><p className="clue-text">{text}</p></div>
      <div className="clue-author"><strong><PlayerName name={player?.name ?? 'Joueur parti'} mark={game?.playerMarks[id]} /></strong></div>
    </li>;
  }
  return <section className={`description-history ${currentIds.length > 8 ? 'clues-many' : ''} ${currentIds.length === 6 ? 'clues-six' : ''}`} aria-label="Les indices du salon"><div className="panel-label"><h3>Les indices du salon <span>{game ? `· TOUR ${game.round}` : ''}</span></h3>{previousRounds.length ? <button className="text-button" onClick={() => setHistoryOpen(true)}>Tours passés · {previousRounds.length} ↗</button> : <span className="eyebrow">ON VOUS ÉCOUTE.</span>}</div>
    {!game ? <p className="clues-empty">Les premiers indices arriveront avec la partie.</p> : <>
      <p className="latest-clue sr-only" aria-live="polite">{latest ? `${players.find(p => p.id === latest.playerId)?.name ?? 'Joueur'} : ${latest.timedOut ? 'temps écoulé' : latest.text}` : 'En attente du premier indice.'}</p>
      <div className="history-rounds"><section className="current-round" aria-label={`Indices du tour ${game.round}`}><ol>{currentIds.map(id => card(id, current.find(d => d.playerId === id), true))}</ol></section>
        {historyOpen && previousRounds.length > 0 && <Modal title="Les tours précédents" onClose={() => setHistoryOpen(false)}><div className="previous-rounds">{previousRounds.map(round => <section key={round} aria-label={`Indices du tour ${round}`}><h3>TOUR {round}</h3><ol>{descriptions.filter(d => d.round === round).map(d => card(d.playerId, d))}</ol></section>)}</div></Modal>}
      </div>
    </>}
  </section>;
}
