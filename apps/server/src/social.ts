import { randomInt, randomUUID } from 'node:crypto';
import { ANIMATIONS, EMOTE_COOLDOWN_MS, SOCIAL_COMBAT_CONFIG as C, physicalStage, socialParticipantAllowed, socialMovementAllowed, withinSocialReach, type AnimationId, type AnimationInstance, type Command, type SharedInteraction, type SocialPlayerState, type SocialSnapshot } from '@rene/contracts';
import type { Player, Room } from './rooms.js';

export interface ServerSocialPlayer extends SocialPlayerState { hits: number[]; lastStage: string }
interface ScheduledAttack { instanceId: string; actorId: string; targetId?: string; at: number; generation: number }
export interface SocialRuntime { generation: number; pending: Map<string, ScheduledAttack>; interactions: Map<string, SharedInteraction> }
let lastGeneration = 0;
const nextGeneration = () => ++lastGeneration;
export const createSocial = (): SocialRuntime => ({ generation: nextGeneration(), pending: new Map(), interactions: new Map() });
export const createSocialPlayer = (): ServerSocialPlayer => ({ acceptsPhysical: true, protectedUntil: 0, nextAttackAt: 0, hits: [], lastStage: 'normal' });
const allowed = (room: Room, p?: Player) => !!p && socialParticipantAllowed({ ...p, alive: room.game ? room.game.alive.includes(p.id) : p.alive }, room.game?.phase);
const check = (condition: unknown, message: string): void => { if (!condition) throw new Error(message); };
const instance = (kind: AnimationId, now: number, targetId?: string): AnimationInstance => ({ instanceId: randomUUID(), kind, startedAt: now, endsAt: now + ANIMATIONS[kind].durationMs, seed: randomInt(0, 1_000_000), ...(targetId ? { targetId } : {}) });
const busy = (room: Room, id: string) => [...room.social.interactions.values()].some(i => i.fromId === id || i.toId === id);
function endInteraction(room: Room, interaction: SharedInteraction) {
  room.social.interactions.delete(interaction.id);
  for (const id of [interaction.fromId, interaction.toId]) {
    const p = room.players.get(id);
    if (p?.social.animation?.sharedInteractionId === interaction.id) delete p.social.animation;
  }
}
export function cancelSocialReferences(room: Room, id: string, departing = false) {
  for (const i of [...room.social.interactions.values()]) if (i.fromId === id || i.toId === id) endInteraction(room, i);
  for (const [key, attack] of room.social.pending) if (attack.actorId === id || attack.targetId === id) room.social.pending.delete(key);
  for (const p of room.players.values()) if (p.social.animation?.targetId === id && (departing || ANIMATIONS[p.social.animation.kind].trigger === 'groundTarget')) { delete p.social.animation; delete p.emote; }
}
export function resetSocial(room: Room) {
  room.social.generation = nextGeneration(); room.social.pending.clear(); room.social.interactions.clear();
  for (const p of room.players.values()) {
    delete p.emote; delete p.social.animation; delete p.social.physical;
    p.social.hits = []; p.social.lastStage = 'normal'; p.social.protectedUntil = 0;
  }
}
function eligibleTarget(room: Room, attacker: Player, target: Player | undefined, now: number) {
  return target && target.id !== attacker.id && allowed(room, target) && target.social.acceptsPhysical && socialMovementAllowed(target.social, now) && now >= target.social.protectedUntil && withinSocialReach(attacker.position, target.position);
}
export function cancelVoluntary(room: Room, p: Player) {
  for (const i of [...room.social.interactions.values()]) if (i.fromId === p.id || i.toId === p.id) endInteraction(room, i);
  room.social.pending.delete(p.id); delete p.social.animation; delete p.emote;
}
function groundTarget(room: Room, p: Player, target: Player | undefined, now: number) {
  if (!target) return false;
  const stage = physicalStage(target.social.physical, now);
  const ground = stage === 'stunned_loop' || stage === 'stun_fall' || (target.social.animation?.kind === 'play_dead' && now >= target.social.animation.startedAt + 500 && now < target.social.animation.endsAt - 500) || (!!room.game && !room.game.alive.includes(target.id) && !target.waiting);
  return p.social.acceptsPhysical && target.connected && target.social.acceptsPhysical && target.id !== p.id && ground && withinSocialReach(p.position, target.position, C.interactionRange, false);
}
function requireActor(room: Room, p: Player, now: number, physical = false) {
  check(allowed(room, p), 'Les animations sont indisponibles pendant le vote ou pour ce participant.');
  check(socialMovementAllowed(p.social, now), 'Votre avatar reprend ses esprits. Les actions de partie restent disponibles.');
  if (physical) check(p.social.acceptsPhysical, 'Activez les interactions physiques pour participer.');
}
export function handleSocial(room: Room, p: Player, command: Command, now: number, generation?: number) {
  check(generation === room.social.generation, 'Cette action sociale appartient à un ancien contexte.');
  if (command.type === 'player.interaction.preferences') {
    p.social.acceptsPhysical = command.acceptsPhysical;
    if (!command.acceptsPhysical) { cancelSocialReferences(room, p.id); if (p.social.animation && ['attack', 'consent', 'groundTarget'].includes(ANIMATIONS[p.social.animation.kind].trigger)) { delete p.social.animation; delete p.emote; } }
    return;
  }
  if (command.type === 'player.emote.stop') {
    check(p.social.animation?.instanceId === command.instanceId, 'Cette animation est déjà terminée.');
    cancelVoluntary(room, p); return;
  }
  if (command.type === 'player.interaction.cancel') {
    const i = room.social.interactions.get(command.interactionId);
    check(i && (i.fromId === p.id || i.toId === p.id), 'Cette invitation ne vous concerne pas.');
    endInteraction(room, i!); return;
  }
  requireActor(room, p, now, command.type !== 'player.emote');
  if (command.type === 'player.attack') {
    check(now >= p.social.nextAttackAt, 'Laisse ton avatar reprendre son souffle.');
    const target = command.targetId ? room.players.get(command.targetId) : [...room.players.values()].filter(t => eligibleTarget(room, p, t, now)).sort((a, b) => Math.hypot(a.position.x - p.position.x, a.position.z - p.position.z) - Math.hypot(b.position.x - p.position.x, b.position.z - p.position.z) || a.id.localeCompare(b.id))[0];
    if (command.targetId) check(eligibleTarget(room, p, target, now), 'Cible hors de portée, protégée ou indisponible.');
    cancelVoluntary(room, p);
    const animation = instance(command.kind, now, target?.id);
    p.social.animation = animation; p.social.nextAttackAt = now + C.attackCooldownMs;
    room.social.pending.set(p.id, { instanceId: animation.instanceId, actorId: p.id, targetId: target?.id, at: now + C.impactDelayMs, generation: room.social.generation });
    return;
  }
  if (command.type === 'player.emote') {
    const meta = ANIMATIONS[command.kind];
    check(!command.targetId || command.kind === 'crouch_taunt' || command.kind === 'macarena_full', 'Cette animation est individuelle.');
    check(meta.trigger === 'individual' || meta.trigger === 'groundTarget', 'Utilisez la commande de frappe ou une invitation.');
    check(now - p.lastEmoteAt >= (['wave', 'dance', 'suspect'].includes(command.kind) ? EMOTE_COOLDOWN_MS : 250), 'Laisse ton avatar reprendre son souffle.');
    if (meta.trigger === 'groundTarget') {
      check(groundTarget(room, p, command.targetId ? room.players.get(command.targetId) : undefined, now), 'Il faut un voisin au sol qui accepte les interactions.');
    }
    const leader = command.targetId && command.kind === 'macarena_full' ? room.players.get(command.targetId) : undefined;
    if (command.kind === 'macarena_full' && command.targetId) check(leader && leader.id !== p.id && allowed(room, leader) && leader.social.animation?.kind === 'macarena_full' && now < leader.social.animation.endsAt, 'Cette danse est terminée.');
    cancelVoluntary(room, p); p.lastEmoteAt = now;
    p.social.animation = instance(command.kind, now, command.targetId);
    if (leader?.social.animation) { p.social.animation.startedAt = leader.social.animation.startedAt; p.social.animation.endsAt = leader.social.animation.endsAt; p.social.animation.seed = leader.social.animation.seed; }
    if (['wave', 'dance', 'suspect'].includes(command.kind)) p.emote = { kind: command.kind as 'wave' | 'dance' | 'suspect', until: p.social.animation.endsAt };
    return;
  }
  if (command.type === 'player.interaction.invite') {
    const target = room.players.get(command.targetId);
    check(target && target.id !== p.id && allowed(room, target) && target.social.acceptsPhysical && socialMovementAllowed(target.social, now) && withinSocialReach(p.position, target.position, C.consentRange, false), 'Ce voisin n’est pas disponible pour une invitation.');
    check(!busy(room, p.id) && !busy(room, target!.id), 'Une interaction est déjà proposée à ce joueur.');
    check(room.social.interactions.size < 6, 'Trop d’interactions en cours.');
    const i: SharedInteraction = { id: randomUUID(), kind: command.kind, fromId: p.id, toId: target!.id, state: 'invited', expiresAt: now + C.invitationMs, startedAt: null };
    room.social.interactions.set(i.id, i); return;
  }
  if (command.type === 'player.interaction.respond') {
    const i = room.social.interactions.get(command.interactionId);
    check(i && i.toId === p.id && i.state === 'invited' && now < i.expiresAt, 'Cette invitation est terminée.');
    if (!command.accept) { endInteraction(room, i!); return; }
    const from = room.players.get(i!.fromId);
    check(from && allowed(room, from) && from.social.acceptsPhysical && socialMovementAllowed(from.social, now) && withinSocialReach(from.position, p.position, C.consentRange, false), 'Le voisin s’est éloigné ou n’est plus disponible.');
    // Both halves start in the same serialized mutation. No world position is changed.
    i!.state = 'active'; i!.startedAt = now; i!.expiresAt = now + ANIMATIONS[i!.kind].durationMs;
    for (const actor of [from!, p]) { room.social.pending.delete(actor.id); delete actor.emote; actor.social.animation = { ...instance(i!.kind, now, actor.id === p.id ? from!.id : p.id), sharedInteractionId: i!.id }; }
    return;
  }
  throw new Error('Action sociale invalide.');
}

export function tickSocial(room: Room, now: number) {
  let changed = false;
  for (const i of [...room.social.interactions.values()]) {
    const a = room.players.get(i.fromId); const b = room.players.get(i.toId);
    if (now >= i.expiresAt || !allowed(room, a) || !allowed(room, b) || !a!.social.acceptsPhysical || !b!.social.acceptsPhysical || !withinSocialReach(a!.position, b!.position, C.consentRange, false)) { endInteraction(room, i); changed = true; }
  }
  for (const [key, attack] of room.social.pending) {
    if (now < attack.at) continue;
    room.social.pending.delete(key);
    const actor = room.players.get(attack.actorId); const target = attack.targetId ? room.players.get(attack.targetId) : undefined;
    if (!actor || attack.generation !== room.social.generation || actor.social.animation?.instanceId !== attack.instanceId || now >= actor.social.animation.endsAt || !allowed(room, actor) || !actor.social.acceptsPhysical || !socialMovementAllowed(actor.social, now) || !eligibleTarget(room, actor, target, now)) continue;
    cancelVoluntary(room, target!);
    const state = target!.social; state.hits = state.hits.filter(at => at > now - C.hitWindowMs); state.hits.push(now);
    const stun = state.hits.length >= C.hitsToStun;
    if (stun) { state.hits = []; state.protectedUntil = now + C.stunnedMs + C.recoveryMs + C.postRecoveryProtectionMs; }
    state.physical = { instanceId: randomUUID(), kind: stun ? 'stun' : 'hit_reaction', startedAt: now, endsAt: now + (stun ? C.stunnedMs + C.recoveryMs : C.hitReactionMs), stunEndsAt: now + (stun ? C.stunnedMs : C.hitReactionMs), sourceYaw: Math.atan2(actor.position.x - target!.position.x, actor.position.z - target!.position.z) - target!.position.yaw };
    changed = true;
  }
  for (const p of room.players.values()) {
    const s = p.social;
    s.hits = s.hits.filter(at => at > now - C.hitWindowMs);
    const stage = physicalStage(s.physical, now);
    if (s.lastStage !== stage) { s.lastStage = stage; changed = true; }
    if (s.physical && now >= s.physical.endsAt) { delete s.physical; changed = true; }
    if (s.protectedUntil && now >= s.protectedUntil) { s.protectedUntil = 0; changed = true; }
    if (s.animation && (now >= s.animation.endsAt || !allowed(room, p) && p.connected || ANIMATIONS[s.animation.kind].trigger === 'groundTarget' && !groundTarget(room, p, room.players.get(s.animation.targetId ?? ''), now))) { cancelVoluntary(room, p); changed = true; }
    if (p.emote && now >= p.emote.until) delete p.emote;
  }
  if (changed) room.revision++;
  return changed;
}
export function socialSnapshot(room: Room, now: number): SocialSnapshot {
  return { generation: room.social.generation, interactions: [...room.social.interactions.values()].filter(i => now < i.expiresAt).map(i => ({ ...i })), players: Object.fromEntries([...room.players.values()].map(p => [p.id, {
    acceptsPhysical: p.social.acceptsPhysical, nextAttackAt: p.social.nextAttackAt, protectedUntil: p.social.protectedUntil,
    ...(p.social.animation && now < p.social.animation.endsAt ? { animation: { ...p.social.animation } } : {}),
    ...(p.social.physical && now < p.social.physical.endsAt ? { physical: { ...p.social.physical } } : {}),
  }])) };
}
