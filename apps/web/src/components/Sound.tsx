import { useEffect, useRef, useState } from 'react';
export function Sound({ phaseId, phase }: { phaseId?: string; phase?: string }) {
  const [enabled, setEnabled] = useState(false); const context = useRef<AudioContext | null>(null);
  useEffect(() => () => { void context.current?.close(); }, []);
  useEffect(() => {
    if (!enabled || !context.current || !phaseId) return;
    const audio = context.current; const start = audio.currentTime;
    const notes = phase === 'results' ? [330, 440, 660] : phase === 'vote' ? [262, 220] : [330, 392];
    notes.forEach((note, index) => { const oscillator = audio.createOscillator(); const gain = audio.createGain(); oscillator.type = 'sine'; oscillator.frequency.value = note; const at = start + index * .11; gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(.07, at + .02); gain.gain.exponentialRampToValueAtTime(.001, at + .18); oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(at); oscillator.stop(at + .2); });
  }, [enabled, phaseId, phase]);
  return <button className="text-button" aria-pressed={enabled} title="Petits sons aux changements de phase" onClick={() => { if (!context.current) context.current = new AudioContext(); void context.current.resume(); setEnabled(!enabled); }}>{enabled ? 'Sons activés ♫' : 'Sons coupés ♩'}</button>;
}
