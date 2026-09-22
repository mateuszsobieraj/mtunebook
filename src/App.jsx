import { lazy, Suspense, useEffect, useState } from 'react';
import TuneList from './components/SongList.jsx';
import { readPreference, writePreference } from './storage.js';

const TuneDetail = lazy(() => import('./components/SongDetail.jsx'));
const lastTuneKey = 'mtunebook:last-tune';
const filenameFromHash = () => new URLSearchParams(window.location.hash.slice(1)).get('tune');

export default function App() {
  const base = import.meta.env.BASE_URL;
  const [tunes, setTunes] = useState([]);
  const [filename, setFilename] = useState(() =>
    window.location.hash ? filenameFromHash() : readPreference(lastTuneKey)
  );
  const [query, setQuery] = useState('');
  const [notation, setNotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [retry, setRetry] = useState(0);
  const current = tunes.find((tune) => tune.filename === filename);

  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, '', filename ? `#tune=${encodeURIComponent(filename)}` : '#list');
    }
    const syncLocation = () => {
      const next = filenameFromHash();
      setFilename(next);
      writePreference(lastTuneKey, next);
    };
    window.addEventListener('hashchange', syncLocation);
    return () => window.removeEventListener('hashchange', syncLocation);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setListError('');
    fetch(`${base}tunes/index.json`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error()))
      .then((items) => { if (!controller.signal.aborted) setTunes(items); })
      .catch(() => { if (!controller.signal.aborted) setListError('Unable to load the tune list.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [base, retry]);

  useEffect(() => {
    if (!current) return;
    const controller = new AbortController();
    setNotation(null);
    fetch(`${base}tunes/${encodeURIComponent(current.filename)}`, { signal: controller.signal })
      .then((response) => response.ok ? response.text() : Promise.reject(new Error()))
      .then((content) => {
        if (!controller.signal.aborted) setNotation({ filename: current.filename, content });
      })
      .catch(() => {
        if (!controller.signal.aborted) setNotation({ filename: current.filename, error: 'Unable to load this tune.' });
      });
    return () => controller.abort();
  }, [base, current, retry]);

  const navigate = (next) => {
    window.location.hash = next ? `tune=${encodeURIComponent(next)}` : 'list';
    setFilename(next);
    writePreference(lastTuneKey, next);
  };
  const filtered = tunes.filter((tune) =>
    [tune.title, tune.rhythm, tune.key, ...(tune.tags || [])].join(' ').toLowerCase().includes(query.trim().toLowerCase())
  );
  const readyNotation = notation?.filename === filename ? notation : null;
  const error = listError || (!loading && filename && !current ? 'This tune was not found.' : '') || readyNotation?.error;
  const loadingNotation = <div className="empty-state" role="status">Loading notation…</div>;

  return <div className="app">
    <header className="site-header">
      <button className="brand" onClick={() => navigate(null)} aria-label="Go to tune list">
        <span className="brand-mark" aria-hidden="true">𝄞</span><span>MTunebook</span>
      </button>
      {!filename && <input className="search" aria-label="Search tunes" type="search" placeholder="Search by title, rhythm, or key…" value={query} onChange={(e) => setQuery(e.target.value)} />}
    </header>
    <main>
      {filename && <button className="back-button" onClick={() => navigate(null)}>← All tunes</button>}
      {error ? <div className="empty-state" role="alert">
        <p>{error}</p>
        <button onClick={() => { setNotation(null); setRetry((value) => value + 1); }}>Try again</button>
      </div> : loading ? <div className="empty-state" role="status">Loading tunes…</div>
        : current ? readyNotation ? <Suspense fallback={loadingNotation}>
          <TuneDetail key={current.filename} tune={current} content={readyNotation.content} isLoading={false} error="" />
        </Suspense> : loadingNotation
          : <TuneList tunes={filtered} query={query} onSelect={(tune) => navigate(tune.filename)} />}
    </main>
  </div>;
}
