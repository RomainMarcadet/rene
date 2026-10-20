import { ANIMATIONS, SOCIAL_COMBAT_CONFIG as C, isGrounded, socialMovementAllowed, socialParticipantAllowed, withinSocialReach, type AnimationId, type Position, type PublicPlayer, type RoomSnapshot } from '@rene/contracts';

export type PositionReader = (id: string, fallback: Position) => Position;
const snapshotPosition: PositionReader = (_id, fallback) => fallback;
export function nearbyPlayers(room: RoomSnapshot, actor: PublicPlayer, position: PositionReader = snapshotPosition) {
  const origin = position(actor.id, actor.position);
  return room.players.filter(player => player.id !== actor.id && player.connected && !player.waiting && withinSocialReach(origin, position(player.id, player.position), C.interactionRange, false))
    .sort((a, b) => {
      const pa = position(a.id, a.position); const pb = position(b.id, b.position);
      return Math.hypot(pa.x - origin.x, pa.z - origin.z) - Math.hypot(pb.x - origin.x, pb.z - origin.z) || a.id.localeCompare(b.id);
    });
}

/** A disabled control explains its actual rule; fresh positions are read again on activation. */
export function animationUnavailable(room: RoomSnapshot, actor: PublicPlayer, kind: AnimationId, target: PublicPlayer | undefined, now: number, position: PositionReader = snapshotPosition): string | null {
  const state = room.social.players[actor.id]; const meta = ANIMATIONS[kind];
  if (!state || !socialParticipantAllowed(actor, room.game?.phase)) return 'Indisponible pendant le vote ou pour un spectateur.';
  if (!socialMovementAllowed(state, now)) return 'Votre avatar reprend ses esprits.';
  if (meta.trigger === 'system') return 'Cette réaction est automatique.';
  if (meta.trigger === 'individual') return null;
  if (!state.acceptsPhysical) return 'Activez les interactions physiques pour participer.';
  if (meta.trigger === 'attack' && now < state.nextAttackAt) return 'Votre avatar reprend son souffle.';
  // Without an explicit target, an attack is selected authoritatively by the server.
  if (meta.trigger === 'attack' && !target) return null;
  if (!target || !target.connected || target.id === actor.id) return 'Cliquez sur un avatar ou approchez-vous d’un voisin.';
  const other = room.social.players[target.id];
  if (!other?.acceptsPhysical) return 'Ce joueur a désactivé les interactions physiques.';
  const origin = position(actor.id, actor.position); const destination = position(target.id, target.position);
  if (meta.trigger === 'groundTarget') {
    if (!withinSocialReach(origin, destination, C.interactionRange, false)) return 'Rapprochez-vous de ce joueur.';
    return isGrounded(target, other, now, room.game?.phase) ? null : 'Ce joueur doit être au sol.';
  }
  if (!socialParticipantAllowed(target, room.game?.phase) || !socialMovementAllowed(other, now)) return 'Ce joueur est momentanément indisponible.';
  if (meta.trigger === 'attack') {
    if (now < other.protectedUntil) return 'Ce joueur est protégé.';
    return withinSocialReach(origin, destination) ? null : 'Rapprochez-vous et faites face à ce joueur.';
  }
  if (!withinSocialReach(origin, destination, C.consentRange, false)) return 'Rapprochez-vous de ce joueur.';
  if (room.social.interactions.some(interaction => [interaction.fromId, interaction.toId].some(id => id === actor.id || id === target.id)) || room.social.interactions.length >= 6) return 'Une interaction est déjà en cours.';
  return null;
}
