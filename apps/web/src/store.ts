import { create } from 'zustand';
import { commandId } from './commandId';
import { io, type Socket } from 'socket.io-client';
import { AppearanceSchema, DEFAULT_APPEARANCE, type AvatarAppearance, type ClientEvents, type Command, type PrivatePlayerState, type RoomSnapshot, type ServerEvents } from '@rene/contracts';

interface Session { playerId: string; name: string; appearance: AvatarAppearance; roomCode: string | null; voiceEnabled: boolean }
interface State {
  session: Session | null; room: RoomSnapshot | null; secret: PrivatePlayerState | null;
  connected: boolean; loading: boolean; error: string | null; connectionMessage: string | null; offset: number;
  speaking: string[]; muted: string[];
}
export const useGame = create<State>(() => ({ session: null, room: null, secret: null, connected: false, loading: true, error: null, connectionMessage: null, offset: 0, speaking: [], muted: [] }));
let socket: Socket<ServerEvents, ClientEvents> | null = null;
let initialization: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;
let retryInProgress = false;
let replaced = false;
function cancelRetry() { if (retryTimer) clearTimeout(retryTimer); retryTimer = null; }
async function fetchSession(): Promise<Session> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('/api/session', { credentials: 'same-origin', signal: controller.signal });
    if (!response.ok) throw new Error('Le salon est injoignable. Réessayez dans un instant.');
    return await response.json();
  } finally { clearTimeout(timeout); }
}
function scheduleRetry() {
  if (replaced || retryTimer || retryInProgress) return;
  if (retryAttempt >= 5) { useGame.setState({ connectionMessage: 'La connexion n’a pas abouti. Vous pouvez réessayer.' }); return; }
  const delay = Math.min(1000 * 2 ** retryAttempt++, 10000);
  useGame.setState({ connectionMessage: 'Connexion momentanément refusée. Nouvelle tentative automatique…' });
  retryTimer = setTimeout(() => { retryTimer = null; void reconnect(false); }, delay);
}
async function reconnect(manual: boolean) {
  if (manual) { replaced = false; retryAttempt = 0; cancelRetry(); }
  if (replaced || retryInProgress || socket?.connected) return;
  if (!socket) { await initialize(); return; }
  retryInProgress = true;
  let failed = false;
  try {
    const previous = useGame.getState();
    const session = await fetchSession();
    if (replaced) return;
    const lostRoom = Boolean(previous.room && (previous.session?.playerId !== session.playerId || !session.roomCode));
    useGame.setState({ session, loading: false, connectionMessage: 'Reconnexion au salon…', ...(lostRoom ? { room: null, secret: null } : {}) });
    if (lostRoom) notify('Votre ancienne session a fermé. Vous pouvez créer ou rejoindre un salon.');
    socket.connect();
  } catch { failed = true; useGame.setState({ connectionMessage: 'Le salon est momentanément injoignable.' }); }
  finally { retryInProgress = false; }
  if (failed) scheduleRetry();
}
export function retryConnection() { return reconnect(true); }
export const notify = (error: string | null) => useGame.setState({ error });
export function localProfile() {
  try { const stored = JSON.parse(localStorage.getItem('rene-profile') || 'null'); const parsed = AppearanceSchema.safeParse(stored?.appearance); if (parsed.success) return { name: String(stored.name ?? '').slice(0, 24), appearance: parsed.data }; } catch { /* Browser storage can be disabled. */ }
  return { name: '', appearance: DEFAULT_APPEARANCE };
}
export function saveProfile(name: string, appearance: AvatarAppearance) {
  try { localStorage.setItem('rene-profile', JSON.stringify({ name, appearance })); } catch { /* Server profile still persists. */ }
}
export function initialize() {
  if (initialization) return initialization;
  initialization = (async () => {
    try {
      const session = await fetchSession();
      useGame.setState({ session, loading: false });
      socket = io({ autoConnect: false, withCredentials: true });
      socket.on('connect', () => {
        cancelRetry(); retryAttempt = 0;
        useGame.setState({ connected: true, connectionMessage: null });
        void send({ type: 'room.resume' }, true);
      });
      socket.on('disconnect', () => useGame.setState({ connected: false }));
      socket.on('connect_error', error => {
        if (replaced) return;
        if (!socket?.active) scheduleRetry();
        // Only known application messages are suitable for the player-facing UI.
        // Transport errors can contain implementation details from the browser or proxy.
        const connectionMessage = error.message === 'Session expirée. Recharge la page.'
          ? 'Votre session a expiré. Rechargez la page ou réessayez.'
          : error.message === 'Connexion momentanément indisponible.'
            ? 'Le salon est momentanément indisponible. Réessayez dans un instant.'
            : 'Impossible de se connecter au salon pour le moment. Réessayez dans un instant.';
        useGame.setState({ connected: false, connectionMessage });
      });
      socket.on('snapshot', room => {
        const previous = useGame.getState().room;
        useGame.setState({ room, offset: room.serverNow - Date.now(), ...(previous?.game?.id !== room.game?.id ? { secret: null } : {}) });
        const url = new URL(location.href); url.searchParams.set('room', room.code); history.replaceState(null, '', url);
      });
      socket.on('private', secret => useGame.setState({ secret }));
      socket.on('poses', positions => useGame.setState(state => ({ room: state.room ? { ...state.room, players: state.room.players.map(player => ({ ...player, position: positions[player.id] ?? player.position })) } : null })));
      socket.on('notice', notify);
      socket.on('replaced', () => { replaced = true; cancelRetry(); socket?.disconnect(); useGame.setState({ connectionMessage: 'Votre place est ouverte dans un autre onglet.' }); notify('Votre place est ouverte dans un autre onglet. Rechargez ici pour la reprendre.'); });
      socket.connect();
    } catch (error) { useGame.setState({ loading: false, error: error instanceof Error ? error.message : 'Connexion impossible.' }); initialization = null; }
  })();
  return initialization;
}
export function send(command: Command, quiet = false): Promise<boolean> {
  const current = useGame.getState();
  if (!socket?.connected) { if (!quiet) notify('Connexion interrompue. Votre place vous attend : reconnexion en cours…'); return Promise.resolve(false); }
  return new Promise(resolve => {
    socket!.timeout(7000).emit('command', { id: commandId(), command, ...(current.room?.game ? { phaseId: current.room.game.phaseId } : {}) }, (error, result) => {
      if (error || !result?.ok) { if (!quiet) notify(error ? 'Pas de réponse du salon. Vérifiez la connexion avant de réessayer.' : (result && !result.ok ? result.error : 'Action refusée.')); resolve(false); return; }
      if (command.type === 'room.leave' || (command.type === 'room.resume' && !result.code && Boolean(current.room || current.session?.roomCode))) {
        if (command.type === 'room.resume') notify('Ce salon a fermé. Créez-en un nouveau pour retrouver vos amis.');
        useGame.setState({ room: null, secret: null });
        if (current.session) current.session.roomCode = null;
        const url = new URL(location.href); url.searchParams.delete('room'); history.replaceState(null, '', url);
      }
      resolve(true);
    });
  });
}
export function move(x: number, z: number) { if (socket?.connected) socket.volatile.emit('move', { x, z }); }
