import type { PublicPlayer, Role } from '@rene/contracts';
import { AvatarPortrait } from './AvatarPortrait';
export const roleName: Record<Role, string> = { civilian: 'Civil', undercover: 'Undercover', white: 'Mr. White' };
const announcement: Record<Role, string> = { civilian: 'C’ÉTAIT UN CIVIL !', undercover: 'C’ÉTAIT UN UNDERCOVER !', white: 'C’ÉTAIT MR. WHITE !' };

export function RoleReveal({ player }: { player?: PublicPlayer }) {
  if (!player || player.alive || player.waiting || !player.role) return null;
  return <div className={`role-reveal role-${player.role}`} role="status" aria-label={`Rôle révélé de ${player.name}`}>
    <AvatarPortrait appearance={player.appearance} eliminated />
    <div><p>{player.name} A ÉTÉ ÉLIMINÉ.</p><strong>{announcement[player.role]}</strong><span>Le salon avait-il du flair ?</span></div>
  </div>;
}
