import type { AvatarAppearance, PublicPlayer } from '@rene/contracts';
/** Preserve memoized portraits/models across frequent cosmetic snapshots. Keep every new public status. */
export function reuseAppearances(players: PublicPlayer[], previous: PublicPlayer[] = []) {
  const old = new Map(previous.map(p => [p.id, p.appearance]));
  return players.map(p => {
    const appearance = old.get(p.id); const keys = Object.keys(p.appearance) as (keyof AvatarAppearance)[];
    return appearance && keys.length === Object.keys(appearance).length && keys.every(key => appearance[key] === p.appearance[key]) ? { ...p, appearance } : p;
  });
}
