import { lazy, Suspense, useEffect } from 'react';
import { initialize, notify, retryConnection, useGame } from './store';
import { Landing } from './components/Landing';
import { RoomView } from './components/RoomView';
import { SceneBoundary } from './components/SceneBoundary';
const ArtPreview = lazy(() => import('./scene/ArtPreview'));
export default function App() {
  const room = useGame(s => s.room); const loading = useGame(s => s.loading); const connected = useGame(s => s.connected); const error = useGame(s => s.error); const session = useGame(s => s.session); const connectionMessage = useGame(s => s.connectionMessage);
  const art = new URLSearchParams(location.search).get('art') === '1';
  useEffect(() => { if (!art) void initialize(); }, [art]);
  if (art) return <SceneBoundary><Suspense fallback={<div className="initial-loading">Les trois spécimens arrivent…</div>}><ArtPreview /></Suspense></SceneBoundary>;
  return <><a className="skip-link" href="#main-content">Aller au jeu</a>{!connected && !loading && <div className="connection-banner" role="status">{connectionMessage ?? (session ? 'Connexion au salon en cours… Votre place est conservée.' : 'Le salon est momentanément injoignable.')}<button className="text-button" onClick={() => void retryConnection()}>Réessayer</button></div>}<div id="main-content">{loading ? <div className="initial-loading"><strong className="wordmark">RENÉ</strong><span>On ouvre le salon…</span></div> : room ? <RoomView room={room} /> : <Landing key={session?.playerId} />}</div>{error && <div className="toast" role="status"><span>{error}</span><button onClick={() => notify(null)} aria-label="Fermer la notification">✕</button></div>}</>;
}
