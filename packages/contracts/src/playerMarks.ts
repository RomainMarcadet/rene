/** Public identification only. Slots follow the server roster, never roles or turn order. */
export const PLAYER_MARKS = [
  { color: '#EE89BA', ink: '#8B2253', foreground: '#191719' },
  { color: '#F34531', ink: '#B32616', foreground: '#191719' },
  { color: '#F5E742', ink: '#756000', foreground: '#191719' },
  { color: '#65B847', ink: '#347522', foreground: '#191719' },
  { color: '#087BA0', ink: '#086781', foreground: '#FFFFFF' },
  { color: '#8A5DB3', ink: '#70449A', foreground: '#FFFFFF' },
  { color: '#F49A38', ink: '#945000', foreground: '#191719' },
  { color: '#39BBA4', ink: '#086E60', foreground: '#191719' },
  { color: '#BAD346', ink: '#5D6B0E', foreground: '#191719' },
  { color: '#394780', ink: '#394780', foreground: '#FFFFFF' },
  { color: '#B67952', ink: '#81502F', foreground: '#191719' },
  { color: '#B53070', ink: '#A12161', foreground: '#FFFFFF' },
] as const;

export function playerMark(slot?: number) {
  return Number.isInteger(slot) && slot! >= 0 ? PLAYER_MARKS[slot!] : undefined;
}
