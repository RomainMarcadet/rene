import { useState } from 'react';
import { PUBLIC_WORD_CATEGORIES, SettingsSchema, WORD_CATEGORY_LABELS, roleCounts, selectedWordCategories, validComposition, type RoomSnapshot, type WordCategory } from '@rene/contracts';
import { send } from '../store';
import './settings.css';

export function Settings({ room, onClose }: { room: RoomSnapshot; onClose: () => void }) {
  const [settings, setSettings] = useState(() => SettingsSchema.parse(room.settings));
  const [categories, setCategories] = useState<WordCategory[]>(() => selectedWordCategories(room.settings));
  const [busy, setBusy] = useState(false);
  const count = room.players.length;
  const roles = roleCounts(count, settings);
  const toggleCategory = (category: WordCategory) => setCategories(current => current.includes(category)
    ? current.filter(item => item !== category) : [...current, category]);
  const setAdultContent = (enabled: boolean) => {
    setSettings(current => ({ ...current, adultContent: enabled }));
    setCategories(current => enabled ? [...new Set([...current, 'adulte' as const])] : current.filter(category => category !== 'adulte'));
  };

  return <form className="room-settings" onSubmit={async event => {
    event.preventDefault();
    if (!categories.length || busy) return;
    setBusy(true);
    if (await send({ type: 'settings.update', settings: { ...settings, category: 'all', categories } })) onClose();
    setBusy(false);
  }}>
    <fieldset className="word-themes">
      <legend>Les thèmes de votre soirée</legend>
      <p className="hint">Choisissez un ou plusieurs thèmes pour toute la salle. Les mots restent la surprise.</p>
      <div className="word-theme-presets">
        <button className="button button-small" type="button" disabled={busy} onClick={() => setCategories([...PUBLIC_WORD_CATEGORIES, ...(settings.adultContent ? ['adulte' as const] : [])])}>Tous les thèmes classiques</button>
        <button className="button button-small" type="button" disabled={busy} onClick={() => { setCategories([]); setSettings(current => ({ ...current, adultContent: false })); }}>Tout décocher</button>
      </div>
      <div className="word-theme-grid">
        {PUBLIC_WORD_CATEGORIES.map(category => <label className="word-theme-chip" key={category}>
          <input type="checkbox" checked={categories.includes(category)} onChange={() => toggleCategory(category)} disabled={busy} />
          <span>{WORD_CATEGORY_LABELS[category]}</span>
        </label>)}
      </div>
      <label className={`adult-theme${settings.adultContent ? ' is-active' : ''}`}>
        <input type="checkbox" checked={settings.adultContent} onChange={event => setAdultContent(event.target.checked)} disabled={busy} aria-describedby="adult-theme-description" />
        <span><strong>Activer le pack 18+</strong><small id="adult-theme-description">Références politiques, historiques et humour noir. Activé pour toute la salle.</small></span>
      </label>
      <p className="word-theme-count" role="status">{categories.length ? `${categories.length} thème${categories.length > 1 ? 's' : ''} sélectionné${categories.length > 1 ? 's' : ''}` : 'Sélectionnez au moins un thème pour enregistrer.'}</p>
    </fieldset>

    <label className="field">Difficulté<select value={settings.difficulty} onChange={event => setSettings({ ...settings, difficulty: event.target.value as typeof settings.difficulty })}>
      <option value="all">Toutes</option><option value="easy">Facile</option><option value="medium">Moyenne</option><option value="hard">Difficile</option>
    </select></label>
    <label className="checkbox"><input type="checkbox" checked={settings.automaticRoles} onChange={event => setSettings({ ...settings, automaticRoles: event.target.checked })} />Répartition automatique des rôles</label>
    <p className="settings-summary">{count} joueurs : {roles.civilian} Civils · {roles.undercover} Undercover · {roles.white} Mr. White</p>
    <div className="settings-grid">
      {!settings.automaticRoles && <>
        <label className="field">Undercovers<input type="number" min={0} max={10} value={settings.undercoverCount} onChange={event => setSettings({ ...settings, undercoverCount: Number(event.target.value) })} required /></label>
        <label className="field">Mr. Whites<input type="number" min={0} max={10} value={settings.whiteCount} onChange={event => setSettings({ ...settings, whiteCount: Number(event.target.value) })} required /></label>
      </>}
      {([
        ['descriptionSeconds', 'Description (secondes)', 10, 180], ['discussionSeconds', 'Discussion (secondes)', 15, 600],
        ['voteSeconds', 'Vote (secondes)', 10, 120], ['guessSeconds', 'Mr. White (secondes)', 10, 120], ['roundsPerSession', 'Parties dans la session', 1, 20],
      ] as const).map(([key, label, min, max]) => <label className="field" key={key}>{label}<input type="number" min={min} max={max} value={settings[key]} onChange={event => setSettings({ ...settings, [key]: Number(event.target.value) })} required /></label>)}
    </div>
    <label className="checkbox"><input type="checkbox" checked={settings.hostCanSkipDiscussion} onChange={event => setSettings({ ...settings, hostCanSkipDiscussion: event.target.checked })} />L’hôte peut avancer au vote</label>
    <label className="checkbox"><input type="checkbox" checked={settings.deadCanSpeak} onChange={event => setSettings({ ...settings, deadCanSpeak: event.target.checked })} />Les éliminés peuvent discuter avec les vivants</label>
    {!validComposition(count, settings) && <p className="hint">Pour commencer : 4 à 12 joueurs, au moins 2 Civils et 1 Infiltré.</p>}
    <button type="submit" className="button button-yellow wide" disabled={busy || !categories.length}>Enregistrer les règles</button>
  </form>;
}
