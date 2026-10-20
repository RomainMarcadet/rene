import { lazy, Suspense, useLayoutEffect, useRef, useState } from 'react';
import { socialPhaseAllowed, type RoomSnapshot } from '@rene/contracts';
import { notify, saveProfile, send, useGame } from '../store';
import { AvatarEditor } from './AvatarEditor';
import { SocialControls } from './SocialControls';
import { Gameplay } from './Gameplay';
import { Modal } from './Modal';
import { HowToPlay } from './HowToPlay';
import { Settings } from './Settings';
import { SceneBoundary } from './SceneBoundary';
import { RoomNavigation } from './RoomNavigation';
import { Suspects } from './Suspects';
import { DescriptionHistory } from './DescriptionHistory';
import { Communication } from './Communication';
import { useRoomViewport, type ClearArea } from './useRoomViewport';
import { findClearArea } from './clearArea';
const Hub = lazy(() => import('../scene/Hub'));
type Drawer = 'suspects' | 'clues' | 'discussion';

export function RoomView({ room }: { room: RoomSnapshot }) {
  const me = useGame(s => s.session!.playerId); const speaking = useGame(s => s.speaking);
  const player = room.players.find(p => p.id === me)!;
  const [modal, setModal] = useState<'avatar' | 'settings' | 'leave' | 'invite' | 'help' | null>(null);
  const [appearance, setAppearance] = useState(player.appearance); const [name, setName] = useState(player.name);
  const [drawer, setDrawer] = useState<Drawer | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);
  const viewport = useRoomViewport(); const root = useRef<HTMLElement>(null);
  const [clearArea, setClearArea] = useState<ClearArea>({ left: 0, top: 80, width: viewport.width, height: viewport.height - 80 });
  const active = room.game && room.game.phase !== 'results';
  const showSuspects = viewport.layout === 'desktop' || drawer === 'suspects';
  const showClues = viewport.layout === 'desktop' || drawer === 'clues';
  const showChat = viewport.layout !== 'mobile' || drawer === 'discussion';
  useLayoutEffect(() => {
    const element = root.current; if (!element) return;
    const panels = [...element.querySelectorAll<HTMLElement>('[data-occluder]')];
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      const rects = panels.filter(p => p.getClientRects().length && getComputedStyle(p).visibility !== 'hidden').map(p => {
        const r = p.getBoundingClientRect(); return { left: r.left - bounds.left, top: r.top - bounds.top, width: r.width, height: r.height };
      });
      const area = findClearArea({ left: 12, top: 80, width: Math.max(0, bounds.width - 24), height: Math.max(0, bounds.height - 92) }, rects);
      setClearArea(previous => JSON.stringify(previous) === JSON.stringify(area) ? previous : area);
    };
    const observer = new ResizeObserver(measure); panels.forEach(p => observer.observe(p)); observer.observe(element); measure();
    return () => observer.disconnect();
  }, [viewport.width, viewport.height, viewport.layout, drawer, expanded]);
  async function invite() { try { await navigator.clipboard.writeText(`${location.origin}/?room=${room.code}`); notify('Lien copié. À vous de réunir les suspects.'); } catch { setModal('invite'); } }
  function customize() { setAppearance(player.appearance); setName(player.name); setModal('avatar'); }
  return <main ref={root} className={`room-page layout-${viewport.layout} ${drawer ? 'drawer-open' : ''} ${drawer === 'clues' ? 'clues-open' : ''} ${room.game ? 'in-game' : ''} ${expanded ? 'chat-expanded' : ''}`} style={{ height: viewport.height, top: viewport.top, left: viewport.left, width: viewport.width }}>
    <section className="scene-panel" aria-label="Le salon 3D partagé">
      <SceneBoundary><Suspense fallback={<div className="scene-loading">On arrange les coussins…</div>}><Hub room={room} playerId={me} speaking={speaking} clearArea={clearArea} compact={viewport.layout === 'mobile'} paused={!!modal} controlsVisible={!drawer && !expanded && !modal && !socialOpen} /></Suspense></SceneBoundary>
    </section>
    <div className="navigation-zone" data-occluder><RoomNavigation room={room} compact={viewport.layout === 'mobile'} onOpen={setModal} onInvite={invite} /></div>
    <div className="scene-caption"><span className="pill">CHEZ RENÉ</span><span>{room.players.filter(p => p.connected).length} / 12 DANS LE SALON</span></div>
    <SocialControls room={room} open={socialOpen} setOpen={setSocialOpen} />
    <div className="room-overlay">
      <div className="gameplay-zone" data-occluder><Gameplay room={room} /></div>
      <div id="room-suspects" className="suspects-zone" hidden={!showSuspects} data-occluder><Suspects room={room} onCustomize={customize} /></div>
      <div id="room-clues" className="clues-zone" hidden={!showClues} data-occluder><DescriptionHistory key={room.game?.id ?? 'lobby'} game={room.game} players={room.players} visible={showClues} /></div>
      <Communication room={room} visible={showChat} onExpand={setExpanded} />
      <nav className="drawer-tabs" aria-label="Panneaux du salon" data-occluder>{([['suspects', 'Suspects'], ['clues', 'Indices'], ['discussion', 'Discussion']] as const).map(([tab, label]) => <button key={tab} aria-expanded={drawer === tab} aria-controls={tab === 'discussion' ? 'room-discussion' : `room-${tab}`} onClick={() => setDrawer(drawer === tab ? null : tab)}>{label}{tab === 'suspects' ? ` · ${room.players.length}` : tab === 'clues' && room.game?.descriptions.length ? ` · ${room.game.descriptions.length}` : ''}<span>{drawer === tab ? '⌄' : '⌃'}</span></button>)}<button id="room-social-button" className="drawer-social" data-invite={room.social.interactions.some(i => i.toId === me && i.state === 'invited') || undefined} aria-label="Gestes du salon" disabled={!socialPhaseAllowed(room.game?.phase)} onClick={() => setSocialOpen(true)}>＋</button></nav>
    </div>
    {modal === 'help' && <HowToPlay onClose={() => setModal(null)} />}
    {modal === 'avatar' && <Modal title="Une tête à vous." onClose={() => setModal(null)}><label className="field">Votre petit nom<input value={name} maxLength={24} onChange={e => setName(e.target.value)} /></label><AvatarEditor value={appearance} onChange={setAppearance} /><button className="button button-yellow wide" disabled={!name.trim()} onClick={async () => { if (await send({ type: 'profile.update', name, appearance })) { saveProfile(name, appearance); setModal(null); } }}>Voilà ma nouvelle tête →</button></Modal>}
    {modal === 'settings' && <Modal title="Les règles du salon." onClose={() => setModal(null)}><Settings room={room} onClose={() => setModal(null)} /></Modal>}
    {modal === 'leave' && <Modal title="Déjà sur le départ ?" onClose={() => setModal(null)}><p>{active ? 'Quitter abandonne votre place dans cette partie. Vous pourrez revenir pour la suivante.' : 'Les autres restent dans le salon. Le lien vous permettra de revenir.'}</p><div className="modal-actions"><button className="button button-cream" onClick={() => setModal(null)}>Je reste</button><button className="button button-red" onClick={() => void send({ type: 'room.leave' })}>Quitter le salon</button></div></Modal>}
    {modal === 'invite' && <Modal title="Invitez les suspects." onClose={() => setModal(null)}><label className="field">Copiez ce lien<input readOnly value={`${location.origin}/?room=${room.code}`} onFocus={e => e.target.select()} /></label></Modal>}
  </main>;
}
