import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store';
import { isEditing } from '../keyboard';
import { useVoiceConnection } from '../voice/useVoiceConnection';

type MicrophoneMode = 'ptt' | 'open';
export function Voice({ generation }: { generation: number }) {
  const available = useGame(s => s.session?.voiceEnabled);
  const publishAllowed = useGame(s => {
    const room = s.room; const me = room?.players.find(p => p.id === s.session?.playerId);
    return !!me && (!room?.game || room.game.phase === 'results' || room.settings.deadCanSpeak || (me.alive && !me.waiting));
  });
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<MicrophoneMode>('ptt');
  const voice = useVoiceConnection(enabled, generation, publishAllowed);
  const holds = useRef(new Set<string>());
  const permitted = enabled && voice.connected && voice.canPublish;
  const { setWanted } = voice;
  function hold(source: string, pressed: boolean) {
    if (pressed && permitted && mode === 'ptt') holds.current.add(source); else holds.current.delete(source);
    setWanted(holds.current.size > 0 && permitted && mode === 'ptt');
  }
  useEffect(() => {
    holds.current.clear(); setWanted(false);
    const stop = () => { holds.current.clear(); setWanted(false); };
    const focus = () => { if (mode === 'ptt') stop(); };
    const down = (event: KeyboardEvent) => {
      if (event.code !== 'KeyV' || event.repeat || event.ctrlKey || event.metaKey || event.altKey || !permitted || mode !== 'ptt' || isEditing(event.target) || document.querySelector('dialog[open]')) return;
      event.preventDefault(); holds.current.add('keyboard'); setWanted(true);
    };
    const up = (event: KeyboardEvent) => {
      if (event.code !== 'KeyV' || mode !== 'ptt') return;
      holds.current.delete('keyboard'); setWanted(holds.current.size > 0);
    };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    window.addEventListener('blur', stop); document.addEventListener('visibilitychange', stop); document.addEventListener('focusin', focus);
    return () => {
      stop(); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up);
      window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', stop); document.removeEventListener('focusin', focus);
    };
  }, [permitted, mode, generation, setWanted]);
  return <section className="voice-panel" aria-label="Commandes du vocal" data-occluder><div ref={voice.audio} hidden />{available ? <>
    <div className="voice-header"><span className={`status-dot ${voice.connected ? '' : 'offline'}`} /><strong>{enabled ? 'Le salon vocal' : 'On se parle ?'}</strong></div>
    <p role="status">{enabled ? voice.status : 'Rejoignez pour écouter. Maintenez V pour parler.'}</p>
    <div className="voice-actions">{!enabled ? <button className="button button-dark" onClick={() => setEnabled(true)}>Rejoindre le vocal ↗</button> : <>
      <span className={`microphone-state ${voice.microphone ? 'transmitting' : ''}`} role="status">{voice.microphone ? '● Microphone : ouvert · transmission' : '○ Microphone : coupé'}{!voice.canPublish && ' · Écoute seule'}</span>
      {mode === 'ptt' ? <button className={`button talk-button ${voice.microphone ? 'button-green' : 'button-yellow'}`} disabled={!permitted} aria-pressed={voice.microphone}
        onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); hold(`pointer-${event.pointerId}`, true); }}
        onPointerUp={event => hold(`pointer-${event.pointerId}`, false)} onPointerCancel={event => hold(`pointer-${event.pointerId}`, false)} onLostPointerCapture={event => hold(`pointer-${event.pointerId}`, false)}
        onKeyDown={event => { if ((event.key === ' ' || event.key === 'Enter') && !event.repeat && permitted) { event.preventDefault(); hold('button-key', true); } }}
        onKeyUp={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); hold('button-key', false); } }}>Maintenir pour parler · V</button>
        : <button className={`button ${voice.microphone ? 'button-green' : 'button-cream'}`} disabled={!permitted} onClick={() => setWanted(!voice.microphone)}>{voice.microphone ? 'Couper mon microphone' : 'Ouvrir mon microphone'}</button>}
      <button className="button button-cream" aria-pressed={!voice.listening} onClick={() => voice.setListening(!voice.listening)}>{voice.listening ? 'Écoute : activée' : 'Écoute : désactivée'}</button>
    </>}</div>
    <details className="voice-settings" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}><summary>Réglages du vocal</summary>
      <div className="voice-settings-content" data-occluder>
      <label className="field voice-mode">Mode du microphone<select aria-label="Mode du microphone" value={mode} onChange={event => { holds.current.clear(); setWanted(false); setMode(event.target.value as MicrophoneMode); }}><option value="ptt">Maintenir pour parler · V (recommandé)</option><option value="open">Microphone ouvert · bouton marche / arrêt</option></select></label>
      <p className="hint">Gardez V ou le bouton enfoncé. Le micro se coupe pendant la saisie et si vous quittez la fenêtre.</p>
      {enabled && <button className="text-button" onClick={() => { holds.current.clear(); setWanted(false); setEnabled(false); }}>Quitter le vocal</button>}
      </div>
    </details>
    {voice.audioBlocked && enabled && <button className="button button-yellow" onClick={() => void voice.startAudio()}>Activer le son du navigateur →</button>}
  </> : <><strong>Le chat est ouvert.</strong><p>Le vocal n’est pas configuré sur ce salon.</p></>}</section>;
}
