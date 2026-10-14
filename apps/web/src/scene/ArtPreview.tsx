import { useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import type { OrthographicCamera } from 'three';
import { OrbitControls } from '@react-three/drei';
import { DEFAULT_APPEARANCE, type Emote } from '@rene/contracts';
import { Avatar } from './Avatar';
import { Salon } from './Salon';
import { useReducedMotion } from './Hub';
function FitCamera() {
  const { camera, size } = useThree();
  useEffect(() => { const orthographic = camera as OrthographicCamera; orthographic.zoom = Math.min(size.width / 12.5, size.height / 8); orthographic.updateProjectionMatrix(); }, [camera, size]);
  return null;
}
export default function ArtPreview() {
  const [emote, setEmote] = useState<Emote>('wave'); const reduced = useReducedMotion();
  const specimens = [
    { ...DEFAULT_APPEARANCE, head: 'bean' as const, skin: '#F5E742' as const, body: '#087BA0' as const, accessory: 'moustache' as const, hair: 'none' as const },
    { ...DEFAULT_APPEARANCE, head: 'pear' as const, eyes: 'sleepy' as const, body: '#F34531' as const },
    { ...DEFAULT_APPEARANCE, head: 'square' as const, skin: '#65B847' as const, body: '#EE89BA' as const, hair: 'none' as const, accessory: 'hat' as const, nose: 'small' as const, mouth: 'surprised' as const },
  ];
  return <main className="art-page"><header className="room-header"><a href="/" className="wordmark">RENÉ</a><span className="eyebrow">L’ATELIER · ÉTUDE DE PERSONNAGES</span></header><div className="art-intro"><span className="pill">TROIS SPÉCIMENS. AUCUN ALIBI.</span><h1>De drôles de têtes.</h1><p>Trois silhouettes originales, un petit bout de salon. Faites tourner la caméra pour les voir sous tous les angles.</p></div><div className="art-canvas"><Canvas orthographic camera={{ position: [7, 6, 12], zoom: 63 }} dpr={[1, 1.5]}><FitCamera /><Salon fragment />{specimens.map((a, i) => <Avatar key={a.head} appearance={a} position={[(i - 1) * 3, 0, .8]} yaw={.15} name={['Le Haricot', 'La Poire', 'Le Pavé'][i]} emote={emote} reducedMotion={reduced} />)}<OrbitControls target={[0, 1, 0]} minZoom={15} maxZoom={100} maxPolarAngle={Math.PI / 2.1} /></Canvas></div><div className="art-controls">{([['wave', 'Un petit salut'], ['dance', 'La danse du doute'], ['suspect', 'Très, très suspect']] as const).map(([kind, label]) => <button key={kind} className={`button ${emote === kind ? 'button-yellow' : 'button-cream'}`} onClick={() => setEmote(kind)}>{label}</button>)}</div><p className="art-note">Scène de création artistique · Les personnages présentés ici sont des modèles d’avatar, pas des joueurs connectés.</p></main>;
}
