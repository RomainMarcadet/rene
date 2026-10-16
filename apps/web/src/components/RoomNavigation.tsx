import type { RoomSnapshot } from '@rene/contracts';
import { useRef, useState } from 'react';
import { useGame } from '../store';
import { Sound } from './Sound';
export function RoomNavigation({ room, compact, onOpen, onInvite }: { room: RoomSnapshot; compact: boolean; onOpen: (modal: 'leave' | 'help' | 'settings') => void; onInvite: () => Promise<void> }) {
  const [menu, setMenu] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const host = useGame(s => s.session?.playerId) === room.hostId;
  const active = room.game && room.game.phase !== 'results';
  return <header className="room-header" onKeyDown={e => { if (e.key === 'Escape') { setMenu(false); menuButton.current?.focus(); } }}>
    <a className="wordmark" href="#" onClick={e => { e.preventDefault(); onOpen('leave'); }}>RENÉ<span className="wordmark-dot">®</span></a>
    <div className="room-code"><span>LE SALON</span><button onClick={() => void onInvite()} title="Copier le lien d’invitation" aria-label={`Inviter dans le salon ${room.code}`}>{room.code} <small>↗</small></button></div>
    <button ref={menuButton} className="nav-menu-toggle" hidden={!compact} aria-expanded={menu} aria-controls="room-navigation-actions" onClick={() => setMenu(!menu)}>Menu {menu ? '×' : '☰'}</button>
    <div id="room-navigation-actions" className="header-actions" hidden={compact && !menu} aria-label="Navigation du salon" data-occluder>
      <Sound phaseId={room.game?.phaseId} phase={room.game?.phase} />
      <button className="text-button" onClick={() => onOpen('help')}>Comment jouer ?</button>
      {host && !active && <button className="text-button" onClick={() => onOpen('settings')}>Paramètres ⚙</button>}
      <button className="text-button" onClick={() => onOpen('leave')}>Sortir ↗</button>
    </div>
  </header>;
}
