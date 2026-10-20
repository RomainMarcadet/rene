import { selectedWordCategories, wordSelectionLabel, type RoomSettings } from '@rene/contracts';
import './settings.css';

export function ThemeSummary({ settings, onEdit }: { settings: RoomSettings; onEdit?: () => void }) {
  const adultEnabled = selectedWordCategories(settings).includes('adulte');
  const difficulty = settings.difficulty === 'all' ? '' : ` · difficulté ${{ easy: 'facile', medium: 'moyenne', hard: 'difficile' }[settings.difficulty]}`;
  const description = `${wordSelectionLabel(settings)}${difficulty}`;
  return <section className="theme-summary" aria-label="Thèmes des mots">
    <div className="theme-summary-copy">
      <div className="theme-summary-heading"><strong>Thèmes</strong>{adultEnabled && <span className="theme-adult-badge">18+ activé</span>}</div>
      <p title={description}>{description}</p>
    </div>
    {onEdit && <button type="button" className="button button-small" aria-label="Choisir les thèmes" onClick={onEdit}>Choisir</button>}
  </section>;
}
