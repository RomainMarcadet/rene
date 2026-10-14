import { useState } from 'react';
import { DEFAULT_APPEARANCE } from '@rene/contracts';
import { localProfile, notify, saveProfile, send, useGame } from '../store';
import { AvatarPortrait } from './AvatarPortrait';
import { AvatarEditor } from './AvatarEditor';
import { Modal } from './Modal';

export function Landing() {
  const session = useGame(s => s.session); const connected = useGame(s => s.connected);
  const [name, setName] = useState(localProfile().name || session?.name || '');
  const [appearance, setAppearance] = useState(localProfile().name ? localProfile().appearance : session?.appearance ?? DEFAULT_APPEARANCE);
  const [code, setCode] = useState(new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '');
  const [editing, setEditing] = useState(false); const [busy, setBusy] = useState(false);
  async function enter(join: boolean) {
    setBusy(true);
    try {
      saveProfile(name.trim(), appearance);
      await send(join ? { type: 'room.join', name: name.trim(), appearance, code: code.trim().toUpperCase() } : { type: 'room.create', name: name.trim(), appearance });
    } catch { notify('Impossible d’ouvrir la porte. Réessayez dans un instant.'); }
    finally { setBusy(false); }
  }
  return <main className="landing">
    <div className="landing-top"><span className="wordmark">RENÉ<span className="wordmark-dot">®</span></span><span className="edition">LE CLUB DES GENS LOUCHES<br />OUVERT À TOUS VOS AMIS</span></div>
    <section className="hero"><div className="hero-copy"><span className="pill">UNDERCOVER, MAIS ENTRE NOUS.</span><h1>On se connaît.<br /><span>Ou presque.</span></h1><p>Un salon, vos amis, un mot secret.<br />Et quelqu’un qui ment très bien.</p><div className="hero-meta"><span>4—12 personnes</span><span>100 % navigateur</span><span>0 ami fiable</span></div></div>
      <div className="hero-art" aria-hidden="true"><div className="art-orbit"/><span className="art-star">✳</span><div className="art-character character-one"><AvatarPortrait appearance={{ ...DEFAULT_APPEARANCE, skin: '#F5E742', body: '#087BA0', head: 'bean', hair: 'none', accessory: 'moustache' }} /></div><div className="art-character character-two"><AvatarPortrait appearance={{ ...DEFAULT_APPEARANCE, skin: '#EE89BA', body: '#F34531', head: 'pear', eyes: 'sleepy', accessory: 'glasses', hair: 'tuft' }} /></div><div className="art-character character-three"><AvatarPortrait appearance={{ ...DEFAULT_APPEARANCE, skin: '#65B847', body: '#EE89BA', head: 'square', accessory: 'hat', hair: 'none', mouth: 'surprised', nose: 'small' }} /></div><span className="art-caption">« Moi ? Jamais. »</span></div>
    </section>
    <section className="entry-section"><div className="entry-intro"><span className="eyebrow">01 / FAITES COMME CHEZ VOUS</span><h2>Entrez dans<br />le salon.</h2><p>Pas de compte. Pas de cérémonie.<br />Juste votre plus belle tête de suspect.</p></div>
      <form className="entry-card" onSubmit={event => { event.preventDefault(); void enter(Boolean(code)); }}>
        <button type="button" className="identity-preview" onClick={() => setEditing(true)} aria-label="Personnaliser mon avatar"><AvatarPortrait appearance={appearance} /><span>Changer de tête ↗</span></button>
        <div className="entry-fields"><label className="field">Votre petit nom<input name="name" aria-label="Pseudonyme" placeholder="René, par exemple" value={name} onChange={e => setName(e.target.value)} maxLength={24} required autoComplete="nickname" /></label><button className="button button-red" disabled={!connected || busy || !name.trim()} type="button" onClick={() => void enter(false)}>{busy ? 'On pousse la porte…' : 'Créer un salon'} <span>↗</span></button><div className="join-row"><label className="field"><span className="sr-only">Code du salon</span><input aria-label="Code du salon" placeholder="CODE DU SALON" value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6))} maxLength={6} autoComplete="off" /></label><button className="button button-cream" type="submit" disabled={!connected || busy || !name.trim() || code.length !== 6}>Rejoindre →</button></div></div>
      </form>
    </section>
    <section className="rules-strip" aria-label="Comment jouer"><div><b>01</b><p><strong>Gardez votre secret.</strong><br />Un mot pour tous. Ou presque.</p></div><div><b>02</b><p><strong>Parlez. Écoutez. Doutez.</strong><br />Un indice chacun, sans trop en dire.</p></div><div><b>03</b><p><strong>Démasquez l’intrus.</strong><br />Votez. Puis accusez votre meilleur ami.</p></div></section>
    <footer className="landing-footer"><strong>RENÉ</strong><span>LES BONS AMIS FONT LES MEILLEURS SUSPECTS.</span><button className="text-button" onClick={() => window.open('/?art=1', '_blank', 'noopener,noreferrer')}>L’atelier des drôles de têtes ↗</button></footer>
    {editing && <Modal title="Une tête à vous." onClose={() => setEditing(false)}><AvatarEditor value={appearance} onChange={setAppearance} /><button className="button button-yellow wide" onClick={() => { saveProfile(name, appearance); setEditing(false); }}>Ça, c’est moi →</button></Modal>}
  </main>;
}
