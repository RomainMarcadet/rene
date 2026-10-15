import { useState } from 'react';
import { DEFAULT_APPEARANCE, type AvatarAppearance } from '@rene/contracts';
import { AvatarPortrait } from './AvatarPortrait';
import { Modal } from './Modal';

const roles: { name: string; word: string; text: string; appearance: AvatarAppearance }[] = [
  { name: 'Civil', word: 'CHIEN', text: 'Votre mot est celui des autres Civils. Repérez ceux qui n’ont pas le même.', appearance: { ...DEFAULT_APPEARANCE, skin: '#F5E742', accessory: 'moustache' } },
  { name: 'Undercover', word: 'CHAT', text: 'Votre mot est légèrement différent. Fondez-vous dans la conversation.', appearance: { ...DEFAULT_APPEARANCE, head: 'square', skin: '#65B847', accessory: 'hat' } },
  { name: 'Mr. White', word: '?', text: 'Aucun mot ! Improvisez et écoutez pour trouver celui des Civils.', appearance: { ...DEFAULT_APPEARANCE, head: 'bean', skin: '#F5F2EA', mouth: 'surprised' } },
];
const steps = ['Les rôles', 'Le déroulement', 'Gagner', 'Un exemple'];
export function HowToPlay({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  return <Modal title="Comment jouer ?" onClose={onClose}>
    <nav className="tutorial-tabs" aria-label="Étapes des règles">{steps.map((label, i) => <button key={label} aria-current={i === step ? 'step' : undefined} onClick={() => setStep(i)}>{i + 1}. {label}</button>)}</nav>
    <div className="tutorial-content" key={step}>
      {step === 0 && <><h3>Trois rôles. Zéro ami fiable.</h3><div className="tutorial-roles">{roles.map(role => <article key={role.name}><AvatarPortrait appearance={role.appearance} /><h3>{role.name}</h3><strong className="tutorial-word">{role.word}</strong><p>{role.text}</p></article>)}</div><p className="callout">Civil ou Undercover ? Au départ, vous ne le savez pas. Vous voyez seulement votre mot. Gardez-le secret !</p></>}
      {step === 1 && <><h3>Un tour de soupçons.</h3><ol className="tutorial-phases"><li><b>01 · Description</b><p>Chacun donne un indice à son tour, sans dire son mot. Même Mr. White doit bluffer.</p></li><li><b>02 · Discussion</b><p>Comparez les indices, débattez au vocal ou dans le chat. Tout le monde est très innocent, évidemment.</p></li><li><b>03 · Vote</b><p>Chaque joueur vivant vote contre un autre. Le plus désigné est éliminé ; une égalité ouvre un départage.</p></li></ol><p className="hint">Pas de victoire ? Un nouveau tour commence. Les mots et les rôles restent les mêmes. Les éliminés observent, sans voter.</p></>}
      {step === 2 && <><h3>Qui aura le dernier mot ?</h3><div className="tutorial-wins"><article><b>Les Civils</b><p>Éliminez tous les Undercovers et Mr. Whites.</p><small>2 points par Civil.</small></article><article><b>Les Infiltrés</b><p>Survivez jusqu’à ce qu’il ne reste qu’un Civil vivant, avec au moins un Infiltré.</p><small>10 points par Undercover, 6 par Mr. White.</small></article><article><b>La surprise Mr. White</b><p>Après son élimination, une seule tentative pour deviner le mot exact des Civils. S’il le trouve, il gagne seul immédiatement !</p><small>6 points pour lui seul. Les synonymes ne comptent pas.</small></article></div></>}
      {step === 3 && <><h3>CHIEN ou CHAT ?</h3><div className="tutorial-example">{roles.slice(0, 2).map(role => <article key={role.name}><AvatarPortrait appearance={role.appearance} /><b>{role.name} · {role.word}</b><p>« {role.name === 'Civil' ? 'Compagnon' : 'Poils'} »</p></article>)}</div><p>Ces deux indices conviennent aux deux mots. Difficile de savoir qui est louche…</p><details><summary>Et si quelqu’un dit « laisse » ?</summary><p>Cela ressemble davantage à CHIEN. Un Undercover avec CHAT pourrait comprendre qu’il est l’intrus. Mr. White, lui, récolte des indices sans avoir de mot.</p></details><p className="hint">Un bon indice aide vos alliés sans offrir la réponse à Mr. White. Facile. Enfin, en théorie.</p></>}
    </div>
    <div className="modal-actions">{step > 0 && <button className="button button-cream" onClick={() => setStep(step - 1)}>← Précédent</button>}<button className="button button-yellow" onClick={() => step < 3 ? setStep(step + 1) : onClose()}>{step < 3 ? 'La suite →' : 'Prêt à soupçonner ✓'}</button></div>
  </Modal>;
}
