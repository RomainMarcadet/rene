import { useEffect, useRef, useState } from 'react';
import type { Room } from 'livekit-client';
import type { VoiceCredentials } from '@rene/contracts';
import { notify, useGame } from '../store';
export function Voice({ generation }: { generation: number }) {
  const available = useGame(s => s.session?.voiceEnabled); const muted = useGame(s => s.muted);
  const [enabled, setEnabled] = useState(false); const [connected, setConnected] = useState(false);
  const [microphone, setMicrophone] = useState(true); const [canPublish, setCanPublish] = useState(false);
  const [status, setStatus] = useState(''); const [audioBlocked, setAudioBlocked] = useState(false);
  const room = useRef<Room | null>(null); const microphoneWanted = useRef(true); const audio = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false; let activeRoom: Room | null = null; const request = new AbortController();
    setConnected(false); setStatus('Connexion au vocal…');
    void (async () => {
      try {
        const { Room: LiveRoom, RoomEvent, Track } = await import('livekit-client');
        const response = await fetch('/api/voice', { method: 'POST', credentials: 'same-origin', signal: request.signal });
        if (!response.ok) { const error = await response.json().catch(() => null); throw new Error(error?.error || 'Le vocal est momentanément indisponible. Le chat reste ouvert.'); }
        const credentials: VoiceCredentials = await response.json();
        if (cancelled) return;
        if (credentials.generation !== generation) { setStatus('Le salon vocal change. Synchronisation en cours…'); return; }
        activeRoom = new LiveRoom({ adaptiveStream: true, dynacast: true }); room.current = activeRoom;
        activeRoom.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
          if (track.kind === Track.Kind.Audio) { const element = track.attach(); element.dataset.participant = participant.identity; element.muted = useGame.getState().muted.includes(participant.identity); audio.current?.appendChild(element); }
        });
        activeRoom.on(RoomEvent.TrackUnsubscribed, track => track.detach().forEach(element => element.remove()));
        activeRoom.on(RoomEvent.ActiveSpeakersChanged, speakers => { if (!cancelled) useGame.setState({ speaking: speakers.map(p => p.identity) }); });
        activeRoom.on(RoomEvent.AudioPlaybackStatusChanged, () => setAudioBlocked(!activeRoom?.canPlaybackAudio));
        activeRoom.on(RoomEvent.Reconnecting, () => { if (!cancelled) { setConnected(false); setStatus('Reconnexion au vocal…'); } });
        activeRoom.on(RoomEvent.Reconnected, () => { if (!cancelled) { setConnected(true); setStatus(credentials.canPublish ? 'Dans la conversation' : 'À l’écoute des vivants'); } });
        activeRoom.on(RoomEvent.Disconnected, () => { if (!cancelled) { setConnected(false); setStatus('Vocal déconnecté. Quittez puis rejoignez pour réessayer.'); } });
        await activeRoom.connect(credentials.url, credentials.token);
        if (cancelled) { await activeRoom.disconnect(); return; }
        setCanPublish(credentials.canPublish); setConnected(true); setStatus(credentials.canPublish ? 'Dans la conversation' : 'À l’écoute des vivants');
        try { await activeRoom.startAudio(); } catch { setAudioBlocked(true); }
        if (credentials.canPublish && microphoneWanted.current) {
          try { await activeRoom.localParticipant.setMicrophoneEnabled(true); setMicrophone(true); }
          catch { microphoneWanted.current = false; setMicrophone(false); setStatus('Microphone refusé. Vous pouvez écouter et écrire.'); }
        } else setMicrophone(false);
      } catch (error) { if (!cancelled) { setStatus(error instanceof Error ? error.message : 'Connexion vocale impossible.'); setConnected(false); } }
    })();
    return () => { cancelled = true; request.abort(); room.current = null; void activeRoom?.disconnect(); audio.current?.replaceChildren(); useGame.setState({ speaking: [] }); };
  }, [enabled, generation]);
  useEffect(() => { audio.current?.querySelectorAll('audio').forEach(element => { element.muted = muted.includes(element.dataset.participant ?? ''); }); }, [muted]);
  async function toggleMicrophone() {
    try { await room.current?.localParticipant.setMicrophoneEnabled(!microphone); microphoneWanted.current = !microphone; setMicrophone(!microphone); }
    catch { notify('Le navigateur n’autorise pas le microphone. Activez sa permission ou utilisez le chat.'); }
  }
  return <section className="voice-panel"><div ref={audio} hidden />{available ? <><div className="voice-header"><span className={`status-dot ${connected ? '' : 'offline'}`} /><strong>{enabled ? 'Le salon vocal' : 'On se parle ?'}</strong></div><p>{enabled ? status : 'Entrez avec votre micro, ou restez au chat.'}</p><div className="voice-actions">{!enabled ? <button className="button button-dark" onClick={() => { microphoneWanted.current = true; setEnabled(true); }}>Rejoindre le vocal ↗</button> : <><button className={`button ${microphone ? 'button-green' : 'button-cream'}`} disabled={!connected || !canPublish} onClick={() => void toggleMicrophone()}>{!canPublish ? 'Écoute seule' : microphone ? 'Micro ouvert' : 'Micro coupé'}</button><button className="text-button" onClick={() => setEnabled(false)}>Quitter le vocal</button></>}</div>{audioBlocked && enabled && <button className="text-button" onClick={() => void room.current?.startAudio().then(() => setAudioBlocked(false))}>Activer le son du navigateur →</button>}</> : <><strong>Le chat est ouvert.</strong><p>Le vocal n’est pas configuré sur ce salon.</p></>}</section>;
}
