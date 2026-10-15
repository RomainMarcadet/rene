import { useCallback, useEffect, useRef, useState } from 'react';
import type { Room } from 'livekit-client';
import type { VoiceCredentials } from '@rene/contracts';
import { useGame } from '../store';
import { MicrophoneController } from './MicrophoneController';

export function useVoiceConnection(enabled: boolean, generation: number, publishAllowed: boolean) {
  const gameConnected = useGame(s => s.connected);
  const muted = useGame(s => s.muted);
  const [connected, setConnected] = useState(false);
  const [microphone, setMicrophone] = useState(false);
  const [canPublish, setCanPublish] = useState(false);
  const [listening, setListening] = useState(true);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [status, setStatus] = useState('');
  const [attempt, setAttempt] = useState(0);
  const room = useRef<Room | null>(null);
  const controller = useRef<MicrophoneController | null>(null);
  const audio = useRef<HTMLDivElement>(null);
  const listeningRef = useRef(true);
  const allowed = useRef(publishAllowed); allowed.current = publishAllowed;
  const setWanted = useCallback((value: boolean) => controller.current?.set(value && allowed.current), []);

  useEffect(() => {
    if (!publishAllowed) controller.current?.set(false);
  }, [publishAllowed]);

  useEffect(() => {
    if (!enabled || !gameConnected) { setConnected(false); setMicrophone(false); return; }
    let cancelled = false; let activeRoom: Room | null = null; let mic: MicrophoneController | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let permission: PermissionStatus | undefined;
    const permissionChanged = () => { if (permission?.state === 'denied') { mic?.set(false); if (!cancelled) { setMicrophone(false); setStatus('Microphone refusé. Vous pouvez toujours écouter.'); } } };
    void navigator.permissions?.query({ name: 'microphone' as PermissionName }).then(value => { if (!cancelled) { permission = value; value.addEventListener('change', permissionChanged); } }).catch(() => undefined);
    const request = new AbortController();
    const requestTimeout = setTimeout(() => request.abort(), 8000);
    const later = (delay = Math.min(8000, 500 * 2 ** Math.min(attempt, 4))) => {
      if (!cancelled && !retry) retry = setTimeout(() => setAttempt(n => n + 1), delay);
    };
    setConnected(false); setCanPublish(false); setMicrophone(false); setAudioBlocked(false); setStatus('Connexion au vocal…');
    void (async () => {
      try {
        const { Room: LiveRoom, RoomEvent, Track } = await import('livekit-client');
        const response = await fetch('/api/voice', { method: 'POST', credentials: 'same-origin', signal: request.signal });
        clearTimeout(requestTimeout);
        if (!response.ok) { const error = await response.json().catch(() => null); throw new Error(error?.error || 'Le vocal est momentanément indisponible.'); }
        const credentials: VoiceCredentials = await response.json();
        if (cancelled) return;
        if (credentials.generation !== generation) { setStatus('Le salon vocal change. Synchronisation en cours…'); later(400); return; }
        // Dual transport avoids the SDP m-line negotiation failure reproduced with Chromium.
        const current = new LiveRoom({ adaptiveStream: true, dynacast: true, singlePeerConnection: false });
        activeRoom = current; room.current = current;
        const syncMicrophone = () => { if (!cancelled) setMicrophone(current.localParticipant.isMicrophoneEnabled && !!current.localParticipant.getTrackPublication(Track.Source.Microphone)?.track?.mediaStreamTrack.enabled); };
        const silence = () => {
          const publication = current.localParticipant.getTrackPublication(Track.Source.Microphone);
          if (publication?.track) { publication.track.mediaStreamTrack.enabled = false; void publication.mute().catch(() => undefined); }
        };
        mic = new MicrophoneController(async value => {
          if (value && (!allowed.current || !credentials.canPublish || !current.localParticipant.permissions?.canPublish)) return;
          await current.localParticipant.setMicrophoneEnabled(value);
        }, silence, syncMicrophone, () => {
          if (!cancelled) { setMicrophone(false); setStatus('Microphone refusé ou indisponible. Vous pouvez toujours écouter.'); }
        });
        controller.current = mic;
        current.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
          if (cancelled || track.kind !== Track.Kind.Audio) return;
          const element = track.attach(); element.dataset.participant = participant.identity;
          element.muted = !listeningRef.current || useGame.getState().muted.includes(participant.identity);
          audio.current?.appendChild(element);
        });
        current.on(RoomEvent.TrackUnsubscribed, track => track.detach().forEach(element => element.remove()));
        current.on(RoomEvent.ActiveSpeakersChanged, speakers => { if (!cancelled) useGame.setState({ speaking: speakers.map(p => p.identity) }); });
        current.on(RoomEvent.AudioPlaybackStatusChanged, () => { if (!cancelled) setAudioBlocked(!current.canPlaybackAudio); });
        for (const event of [RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished]) current.on(event, syncMicrophone);
        current.on(RoomEvent.MediaDevicesError, () => { mic?.set(false); if (!cancelled) setStatus('Microphone refusé ou débranché. L’écoute reste disponible.'); });
        current.on(RoomEvent.ParticipantPermissionsChanged, (_previous, participant) => {
          if (participant === current.localParticipant && !participant.permissions?.canPublish) { mic?.set(false); if (!cancelled) setCanPublish(false); }
        });
        const suspend = () => { mic?.set(false); if (!cancelled) { setConnected(false); setMicrophone(false); setStatus('Reconnexion au vocal…'); } };
        current.on(RoomEvent.Reconnecting, suspend);
        current.on(RoomEvent.SignalReconnecting, suspend);
        current.on(RoomEvent.Reconnected, () => { if (!cancelled) { setConnected(true); syncMicrophone(); setStatus(credentials.canPublish ? 'Dans la conversation' : 'À l’écoute des vivants'); } });
        current.on(RoomEvent.Disconnected, () => { suspend(); later(); });
        await current.connect(credentials.url, credentials.token);
        if (cancelled) { await current.disconnect(); return; }
        setCanPublish(credentials.canPublish && !!current.localParticipant.permissions?.canPublish);
        setConnected(true); syncMicrophone(); setStatus(credentials.canPublish ? 'Dans la conversation' : 'À l’écoute des vivants');
        try { await current.startAudio(); } catch { /* Playback state is reported below. */ }
        if (!cancelled) setAudioBlocked(!current.canPlaybackAudio);
      } catch (error) {
        if (!cancelled) { setStatus(error instanceof Error ? error.message : 'Connexion vocale impossible.'); setConnected(false); later(); }
      }
    })();
    return () => {
      cancelled = true; permission?.removeEventListener('change', permissionChanged); clearTimeout(requestTimeout); clearTimeout(retry); request.abort(); mic?.dispose();
      controller.current = null; room.current = null; void activeRoom?.disconnect();
      audio.current?.replaceChildren(); useGame.setState({ speaking: [] });
    };
  }, [enabled, generation, gameConnected, attempt]);

  useEffect(() => {
    listeningRef.current = listening;
    audio.current?.querySelectorAll('audio').forEach(element => { element.muted = !listening || muted.includes(element.dataset.participant ?? ''); });
  }, [muted, listening]);

  async function startAudio() {
    try { await room.current?.startAudio(); setAudioBlocked(!room.current?.canPlaybackAudio); }
    catch { setAudioBlocked(true); }
  }
  return { audio, connected, microphone, canPublish: canPublish && publishAllowed, listening, setListening, audioBlocked, status, setWanted, startAudio };
}
