import { useEffect, useRef, useState } from 'react';
import { ANIMATIONS, ANIMATION_IDS, SOCIAL_COMBAT_CONFIG as C, socialPhaseAllowed, physicalStage, socialMovementAllowed, socialParticipantAllowed, withinSocialReach, type AnimationCategory, type AnimationId, type AttackKind, type RoomSnapshot } from '@rene/contracts';
import { send, useGame } from '../store';
import { isEditing } from '../keyboard';
import { Modal } from './Modal';
const categories: AnimationCategory[] = ['Gestes', 'Postures', 'Danses', 'Macarena', 'Interactions'];
const favorites = [['wave', 'Salut', '✋'], ['dance', 'Danse', '♫'], ['suspect', 'Soupçon', '◉']] as const;
export function SocialControls({ room, open, setOpen }: { room: RoomSnapshot; open: boolean; setOpen: (value: boolean) => void }) {
  const id = useGame(s => s.session!.playerId); const offset = useGame(s => s.offset);
  const [_clockTick, setClockTick] = useState(0);
  const [category, setCategory] = useState<AnimationCategory>('Gestes'); const [target, setTarget] = useState('');
  const opener = useRef<HTMLButtonElement>(null); const me = room.players.find(p => p.id === id)!;
  const social = room.social.players[id]; const now = Date.now() + offset;
  const allowed = socialParticipantAllowed(me, room.game?.phase);
  useEffect(() => {
    const delay = social.nextAttackAt - (Date.now() + offset);
    if (delay <= 0) return;
    const timer = setTimeout(() => setClockTick(t => t + 1), delay + 5);
    return () => clearTimeout(timer);
  }, [social.nextAttackAt, offset]);
  const actionable = allowed && socialMovementAllowed(social, now);
  const neighbors = room.players.filter(p => p.id !== id && p.connected && withinSocialReach(me.position, p.position, 2.1, false));
  const chosen = neighbors.find(p => p.id === target);
  const nearest = neighbors.filter(p => socialParticipantAllowed(p, room.game?.phase) && room.social.players[p.id]?.acceptsPhysical && socialMovementAllowed(room.social.players[p.id], now) && now >= room.social.players[p.id].protectedUntil && withinSocialReach(me.position, p.position)).sort((a, b) => Math.hypot(a.position.x - me.position.x, a.position.z - me.position.z) - Math.hypot(b.position.x - me.position.x, b.position.z - me.position.z) || a.id.localeCompare(b.id))[0];
  const hitEligible = !chosen || socialParticipantAllowed(chosen, room.game?.phase) && room.social.players[chosen.id].acceptsPhysical && socialMovementAllowed(room.social.players[chosen.id], now) && now >= room.social.players[chosen.id].protectedUntil && withinSocialReach(me.position, chosen.position);
  const attackTarget = chosen ?? nearest;
  const attack = (kind: AttackKind = 'punch') => { void send({ type: 'player.attack', kind, ...(chosen ? { targetId: chosen.id } : {}) }); };
  const close = () => { setOpen(false); requestAnimationFrame(() => { const element = opener.current?.getClientRects().length ? opener.current : document.getElementById('room-social-button'); element?.focus(); }); };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || isEditing(event.target) || document.querySelector('dialog[open]') || !socialPhaseAllowed(room.game?.phase)) return;
      if (event.key.toLowerCase() === 'b') { event.preventDefault(); setOpen(true); }
      if (event.key.toLowerCase() === 'f' && actionable && social?.acceptsPhysical && hitEligible && Date.now() + offset >= social.nextAttackAt) { event.preventDefault(); void send({ type: 'player.attack', kind: 'punch', ...(chosen ? { targetId: chosen.id } : {}) }); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [room.game?.phase, allowed, actionable, social?.acceptsPhysical, social?.nextAttackAt, chosen, hitEligible, offset, setOpen]);
  useEffect(() => { if (!socialPhaseAllowed(room.game?.phase)) setOpen(false); }, [room.game?.phase, setOpen]);
  const act = async (kind: AnimationId) => {
    const meta = ANIMATIONS[kind];
    const ok = meta.trigger === 'attack' ? await send({ type: 'player.attack', kind: kind as AttackKind, ...(chosen ? { targetId: chosen.id } : {}) })
      : meta.trigger === 'consent' ? chosen && await send({ type: 'player.interaction.invite', kind: kind as 'hug' | 'carry', targetId: chosen.id })
      : await send({ type: 'player.emote', kind, ...(meta.trigger === 'groundTarget' && chosen ? { targetId: chosen.id } : {}) });
    if (ok) close();
  };
  const mine = room.social.interactions.find(i => i.fromId === id || i.toId === id);
  const label = physicalStage(social?.physical, now);
  const status = label === 'get_up' ? 'Reprend ses esprits' : label === 'stun_fall' || label === 'stunned_loop' ? 'À terre · vos actions de partie restent disponibles' : social?.protectedUntil > now ? 'Protégé' : null;
  return <><div className="scene-toolbar social-controls" aria-label="Émotes">
    <span>{allowed ? 'B · GESTES / F · FRAPPE' : socialPhaseAllowed(room.game?.phase) ? 'ON REGARDE' : 'À TABLE !'}</span>
    <div className="social-favorites">{favorites.map(([kind, label, icon]) => <button key={kind} disabled={!actionable} title={label} aria-label={`Emote ${label}`} onClick={() => void send({ type: 'player.emote', kind })}>{icon}</button>)}
      <button ref={opener} disabled={!socialPhaseAllowed(room.game?.phase)} onClick={() => setOpen(true)} aria-label="Animations et interactions" title="Animations et interactions · B">＋</button>
      <button disabled={!actionable || !social?.acceptsPhysical || !hitEligible || now < social.nextAttackAt} onClick={() => attack()} aria-label={`Frapper · ${attackTarget?.name ?? 'dans le vide'}`} title={`Frappe · F · ${attackTarget?.name ?? 'dans le vide'}`}>✊</button>
      {social?.animation && <button onClick={() => void send({ type: 'player.emote.stop', instanceId: social.animation!.instanceId })} aria-label="Arrêter l’animation" title="Arrêter l’animation">■</button>}
    </div>
    {status && <small role="status">{status}</small>}
    {mine?.state === 'invited' && mine.toId === id && <button className="social-invite" onClick={() => { setCategory('Interactions'); setOpen(true); }}>Invitation de {room.players.find(p => p.id === mine.fromId)?.name}</button>}
    </div>{open && <Modal title="Le petit chaos." onClose={close}>
      <p className="hint">Des gestes, pas des dégâts. Tout s’arrête pendant le vote.</p>
      {social.animation && <button className="button button-cream" aria-label="Arrêter l’animation" onClick={async () => { if (await send({ type: 'player.emote.stop', instanceId: social.animation!.instanceId })) close(); }}>Arrêter l’animation ■</button>}
      <label className="social-preference"><input type="checkbox" checked={social.acceptsPhysical} onChange={event => void send({ type: 'player.interaction.preferences', acceptsPhysical: event.target.checked })} />Accepter les interactions physiques</label>
      <label className="field">Voisin pour les interactions<select aria-label="Cible des interactions" value={chosen?.id ?? ''} onChange={event => setTarget(event.target.value)}><option value="">Automatique · frappe devant soi</option>{neighbors.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      {mine && <div className="social-invitation" role="status"><p>{room.players.find(p => p.id === (mine.fromId === id ? mine.toId : mine.fromId))?.name} · {ANIMATIONS[mine.kind].label}</p>{mine.state === 'invited' && mine.toId === id && <><button className="button button-yellow" onClick={async () => { if (await send({ type: 'player.interaction.respond', interactionId: mine.id, accept: true })) close(); }}>Accepter</button><button className="button button-cream" onClick={() => void send({ type: 'player.interaction.respond', interactionId: mine.id, accept: false })}>Refuser</button></>}<button className="button button-cream" onClick={() => void send({ type: 'player.interaction.cancel', interactionId: mine.id })}>Annuler l’interaction</button></div>}
      <nav className="social-tabs" aria-label="Catégories d’animations">{categories.map(c => <button key={c} aria-pressed={c === category} onClick={() => setCategory(c)}>{c}</button>)}</nav>
      <div className="social-catalog">{ANIMATION_IDS.filter(kind => ANIMATIONS[kind].category === category && ANIMATIONS[kind].trigger !== 'system').map(kind => {
        const meta = ANIMATIONS[kind]; const physical = ['attack', 'consent', 'groundTarget'].includes(meta.trigger);
        const needsTarget = ['consent', 'groundTarget'].includes(meta.trigger);
        const targetState = chosen && room.social.players[chosen.id];
        const targetStage = physicalStage(targetState?.physical, now);
        const grounded = chosen && (targetStage === 'stun_fall' || targetStage === 'stunned_loop' || targetState?.animation?.kind === 'play_dead' && now >= targetState.animation.startedAt + 500 && now < targetState.animation.endsAt - 500 || !!room.game && !chosen.alive && !chosen.waiting);
        const available = meta.trigger === 'attack' ? hitEligible && now >= social.nextAttackAt : meta.trigger === 'consent' ? chosen && targetState?.acceptsPhysical && socialParticipantAllowed(chosen, room.game?.phase) && socialMovementAllowed(targetState, now) && withinSocialReach(me.position, chosen.position, C.consentRange, false) && !mine : meta.trigger === 'groundTarget' ? grounded && targetState?.acceptsPhysical : true;
        return <button key={kind} disabled={!actionable || physical && !social.acceptsPhysical || needsTarget && !chosen || !available} onClick={() => void act(kind)} title={!available ? 'Rapprochez-vous d’un voisin disponible pour cette interaction' : needsTarget && !chosen ? 'Choisissez un voisin proche' : meta.label}>{meta.label}</button>;
      })}</div>
      {category === 'Macarena' && room.players.filter(p => p.id !== id && room.social.players[p.id]?.animation?.kind === 'macarena_full').map(p => <button key={p.id} className="button button-yellow" onClick={async () => { if (await send({ type: 'player.emote', kind: 'macarena_full', targetId: p.id })) close(); }}>Danser avec {p.name}</button>)}
      <p className="hint">Les postures s’arrêtent aussi en marchant. Les invitations expirent après huit secondes.</p>
    </Modal>}
  </>;
}
