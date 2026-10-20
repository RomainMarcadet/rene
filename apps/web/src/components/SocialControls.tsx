import { useCallback, useEffect, useRef, useState } from 'react';
import { ANIMATIONS, ANIMATION_IDS, physicalStage, socialMovementAllowed, socialParticipantAllowed, socialPhaseAllowed, type AnimationCategory, type AnimationId, type AttackKind, type RoomSnapshot } from '@rene/contracts';
import { notify, send, useGame } from '../store';
import { getPose } from '../poses';
import { isEditing, socialShortcut } from '../keyboard';
import { clearSocialTarget, selectSocialTarget, useSocialSelection } from '../socialSelection';
import { animationUnavailable, nearbyPlayers } from './socialActions';
import { SocialIcon } from './SocialIcon';
import '../social-controls.css';

const categories: AnimationCategory[] = ['Gestes', 'Postures', 'Danses', 'Macarena', 'Interactions'];
const favorites = [['wave', 'Salut', 'H'], ['dance', 'Danse', 'J'], ['suspect', 'Soupçon', 'K']] as const;
export function SocialControls({ room, open, setOpen }: { room: RoomSnapshot; open: boolean; setOpen: (value: boolean) => void }) {
  const id = useGame(s => s.session!.playerId); const offset = useGame(s => s.offset);
  const targetId = useSocialSelection(s => s.targetId); const request = useSocialSelection(s => s.request);
  const [, refreshClock] = useState(0); const [category, setCategory] = useState<AnimationCategory>('Gestes');
  const opener = useRef<HTMLButtonElement>(null); const picker = useRef<HTMLElement>(null);
  const lastRequest = useRef(request);
  const me = room.players.find(p => p.id === id)!; const social = room.social.players[id];
  const now = Date.now() + offset; const allowed = socialParticipantAllowed(me, room.game?.phase);
  const actionable = allowed && socialMovementAllowed(social, now);
  const neighbors = nearbyPlayers(room, me, getPose);
  const chosen = room.players.find(p => p.id === targetId && p.id !== id && p.connected);
  const partner = chosen ?? neighbors[0];
  const mine = room.social.interactions.find(i => i.fromId === id || i.toId === id);

  useEffect(() => { clearSocialTarget(); }, [room.code]);
  useEffect(() => { if (request !== lastRequest.current) { lastRequest.current = request; setCategory('Interactions'); setOpen(true); } }, [request, setOpen]);
  useEffect(() => { if (open) picker.current?.focus({ preventScroll: true }); }, [open, request]);
  useEffect(() => {
    if (!open) return;
    // Only the open palette needs distance/deadline refreshes. Movement never rerenders the HUD.
    const timer = setInterval(() => refreshClock(t => t + 1), 250);
    return () => clearInterval(timer);
  }, [open]);
  useEffect(() => {
    const delay = social.nextAttackAt - (Date.now() + offset);
    if (delay <= 0) return;
    const timer = setTimeout(() => refreshClock(t => t + 1), delay + 5);
    return () => clearTimeout(timer);
  }, [social.nextAttackAt, offset]);
  const close = useCallback(() => {
    const restoreFocus = picker.current?.contains(document.activeElement) || document.activeElement === document.body;
    setOpen(false);
    clearSocialTarget();
    requestAnimationFrame(() => {
      // An acknowledgement can arrive after the player has started typing elsewhere.
      if (!restoreFocus || isEditing(document.activeElement)) return;
      const element = opener.current?.getClientRects().length ? opener.current : document.getElementById('room-social-button');
      element?.focus();
    });
  }, [setOpen]);
  const interactNearby = useCallback(() => {
    const current = useGame.getState(); const currentRoom = current.room;
    const actor = currentRoom?.players.find(p => p.id === current.session?.playerId);
    if (!currentRoom || !actor) return;
    const nearest = nearbyPlayers(currentRoom, actor, getPose)[0];
    if (nearest) selectSocialTarget(nearest.id);
    else { clearSocialTarget(); setCategory('Interactions'); setOpen(true); notify('Rapprochez-vous d’un voisin ou cliquez sur son avatar.'); }
  }, [setOpen]);
  const act = useCallback(async (kind: AnimationId, dismiss = false) => {
    const current = useGame.getState(); const currentRoom = current.room;
    const actor = currentRoom?.players.find(p => p.id === current.session?.playerId);
    if (!currentRoom || !actor) return;
    const meta = ANIMATIONS[kind];
    const selectedId = useSocialSelection.getState().targetId;
    const explicit = currentRoom.players.find(p => p.id === selectedId && p.id !== actor.id && p.connected);
    if (selectedId && !explicit && meta.trigger !== 'individual') { clearSocialTarget(); notify('Ce joueur a quitté le salon. Choisissez un autre voisin.'); return; }
    const target = meta.trigger === 'attack' ? explicit : explicit ?? nearbyPlayers(currentRoom, actor, getPose)[0];
    const reason = animationUnavailable(currentRoom, actor, kind, target, Date.now() + current.offset, getPose);
    if (reason) { notify(reason); return; }
    const ok = meta.trigger === 'attack' ? await send({ type: 'player.attack', kind: kind as AttackKind, ...(target ? { targetId: target.id } : {}) })
      : meta.trigger === 'consent' ? !!target && await send({ type: 'player.interaction.invite', kind: kind as 'hug' | 'carry', targetId: target.id })
      : await send({ type: 'player.emote', kind, ...(meta.trigger === 'groundTarget' && target ? { targetId: target.id } : {}) });
    if (ok && dismiss) close();
  }, [close]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || isEditing(event.target) || document.querySelector('dialog[open]')) return;
      const shortcut = socialShortcut(event);
      if (shortcut === 'close' && open) { event.preventDefault(); close(); return; }
      if (!allowed || !shortcut) return;
      event.preventDefault();
      if (shortcut === 'picker') { if (open) close(); else setOpen(true); }
      else if (shortcut === 'nearby') interactNearby();
      else if (shortcut === 'stop') {
        const animation = useGame.getState().room?.social.players[id]?.animation;
        if (animation) void send({ type: 'player.emote.stop', instanceId: animation.instanceId });
      } else if (shortcut !== 'close') void act(shortcut);
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [act, allowed, close, id, interactNearby, open, setOpen]);
  useEffect(() => { if (!socialPhaseAllowed(room.game?.phase)) { setOpen(false); clearSocialTarget(); } }, [room.game?.phase, setOpen]);
  const stage = physicalStage(social.physical, now);
  const status = stage === 'get_up' ? 'Reprend ses esprits' : stage === 'stun_fall' || stage === 'stunned_loop' ? 'À terre · vos actions de partie restent disponibles' : social.protectedUntil > now ? 'Protégé' : null;
  const stop = async () => { if (social.animation) await send({ type: 'player.emote.stop', instanceId: social.animation.instanceId }); };

  return <><div className="scene-toolbar social-controls" aria-label="Émotes">
    <span>{allowed ? 'UN GESTE ?' : socialPhaseAllowed(room.game?.phase) ? 'ON REGARDE' : 'À TABLE !'}</span>
    <div className="social-favorites">{favorites.map(([kind, label, shortcut]) => <button key={kind} disabled={!actionable} title={`${label} · ${shortcut}`} aria-label={`Emote ${label}`} aria-keyshortcuts={shortcut} onClick={() => void act(kind)}><SocialIcon kind={kind} /><kbd>{shortcut}</kbd></button>)}
      <button disabled={!actionable} onClick={interactNearby} aria-label="Interagir avec un voisin" aria-keyshortcuts="E" title="Voisin le plus proche · E"><SocialIcon kind="nearby" /><kbd>E</kbd></button>
      <button ref={opener} disabled={!socialPhaseAllowed(room.game?.phase)} onClick={() => setOpen(!open)} aria-label="Animations et interactions" aria-expanded={open} aria-controls="social-picker" aria-keyshortcuts="B" title="Tous les gestes · B"><SocialIcon kind="catalog" /><kbd>B</kbd></button>
      <button disabled={!actionable || !social.acceptsPhysical || now < social.nextAttackAt} onClick={() => void act('punch')} aria-label="Frapper" aria-keyshortcuts="F" title="Frappe · F"><SocialIcon kind="punch" /><kbd>F</kbd></button>
      {social.animation && <button onClick={() => void stop()} aria-label="Arrêter l’animation" aria-keyshortcuts="X" title="Arrêter l’animation · X"><SocialIcon kind="stop" /><kbd>X</kbd></button>}
    </div>
    {status && <small role="status">{status}</small>}
    {mine?.state === 'invited' && mine.toId === id && <button className="social-invite" onClick={() => { setCategory('Interactions'); setOpen(true); }}>Invitation de {room.players.find(p => p.id === mine.fromId)?.name}</button>}
    </div>{open && <section id="social-picker" ref={picker} className="social-picker" role="dialog" aria-modal="false" aria-label="Le petit chaos." tabIndex={-1}>
      <header className="social-picker-heading"><div><h2>{chosen ? `Avec ${chosen.name}.` : 'Les gestes du salon.'}</h2><p>Cliquez sur un avatar · E : voisin proche · Échap : fermer</p></div><button className="icon-button" onClick={close} aria-label="Fermer les animations">✕</button></header>
      {social.animation && <button className="social-stop" aria-label="Arrêter l’animation" onClick={() => void stop()}>■ Arrêter · X</button>}
      {mine && <div className="social-invitation" role="status"><p>{room.players.find(p => p.id === (mine.fromId === id ? mine.toId : mine.fromId))?.name} · {ANIMATIONS[mine.kind].label}</p>{mine.state === 'invited' && mine.toId === id && <><button className="button button-yellow" onClick={async () => { if (await send({ type: 'player.interaction.respond', interactionId: mine.id, accept: true })) close(); }}>Accepter</button><button className="button button-cream" onClick={() => void send({ type: 'player.interaction.respond', interactionId: mine.id, accept: false })}>Refuser</button></>}<button className="button button-cream" onClick={() => void send({ type: 'player.interaction.cancel', interactionId: mine.id })}>Annuler l’interaction</button></div>}
      <nav className="social-tabs" aria-label="Catégories d’animations">{categories.map(c => <button key={c} aria-pressed={c === category} onClick={() => setCategory(c)}>{c}</button>)}</nav>
      {category === 'Interactions' && <div className="social-targets" aria-label="Voisins proches">
        {!chosen && <p>{partner ? 'Voisins à portée' : 'Approchez-vous d’un voisin.'}</p>}
        <div>{neighbors.map(player => <button key={player.id} data-player-id={player.id} aria-label={`Interagir avec ${player.name}`} aria-pressed={partner?.id === player.id} onClick={() => selectSocialTarget(player.id)}>{player.name}</button>)}{chosen && <button className="social-target-auto" onClick={clearSocialTarget} aria-label="Choisir automatiquement le voisin">Au plus proche</button>}</div>
      </div>}
      <div className="social-catalog">{ANIMATION_IDS.filter(kind => ANIMATIONS[kind].category === category && ANIMATIONS[kind].trigger !== 'system').map(kind => {
        const meta = ANIMATIONS[kind]; const target = meta.trigger === 'attack' ? chosen : partner;
        const reason = animationUnavailable(room, me, kind, target, now, getPose);
        return <button key={kind} disabled={!!reason} onClick={() => void act(kind, true)} title={reason ?? meta.label}>{meta.label}</button>;
      })}</div>
      {category === 'Macarena' && room.players.filter(p => p.id !== id && room.social.players[p.id]?.animation?.kind === 'macarena_full').map(p => <button key={p.id} className="button button-yellow" disabled={!actionable} onClick={async () => { if (await send({ type: 'player.emote', kind: 'macarena_full', targetId: p.id })) close(); }}>Danser avec {p.name}</button>)}
      <label className="social-preference"><input type="checkbox" checked={social.acceptsPhysical} onChange={event => void send({ type: 'player.interaction.preferences', acceptsPhysical: event.target.checked })} />Accepter les interactions physiques</label>
      <p className="hint">H : salut · J : danse · K : soupçon · F : frappe · X : arrêter.<br />Les gestes s’arrêtent au vote. Les interactions à deux demandent un accord.</p>
    </section>}</>;
}
