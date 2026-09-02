import { useEffect, useState } from 'react';
import TuneList from './components/SongList.jsx';
import TuneDetail from './components/SongDetail.jsx';

export default function App() {
  const base = import.meta.env.BASE_URL;
  const [tunes, setTunes] = useState([]);
  const [current, setCurrent] = useState(null);
  const [query, setQuery] = useState('');
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tuneLoading, setTuneLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${base}tunes/index.json`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error()))
      .then(setTunes)
      .catch(() => setError('Unable to load the tune list.'))
      .finally(() => setLoading(false));
  }, [base]);

  useEffect(() => {
    if (!current) { setContent(null); setError(''); return; }
    const controller = new AbortController();
    setTuneLoading(true); setError('');
    fetch(`${base}tunes/${current.filename}`, { signal: controller.signal })
      .then((response) => response.ok ? response.text() : Promise.reject(new Error()))
      .then(setContent)
      .catch((err) => { if (err.name !== 'AbortError') setError('Unable to load this tune.'); })
      .finally(() => { if (!controller.signal.aborted) setTuneLoading(false); });
    return () => controller.abort();
  }, [base, current]);

  const filtered = tunes.filter((tune) =>
    [tune.title, tune.rhythm, tune.key, ...(tune.tags || [])].join(' ').toLowerCase().includes(query.toLowerCase())
  );
  const goHome = () => { setCurrent(null); setQuery(''); };

  return <div className="app">
    <header className="site-header">
      <button className="brand" onClick={goHome} aria-label="Go to tune list">
        <span className="brand-mark">𝄞</span><span>MTunebook</span>
      </button>
      {!current && <input className="search" type="search" placeholder="Search by title, rhythm, or key..." value={query} onChange={(e) => setQuery(e.target.value)} />}
    </header>
    <main>{current
      ? <TuneDetail tune={current} content={content} isLoading={tuneLoading} error={error} />
      : <TuneList tunes={filtered} query={query} onSelect={setCurrent} isLoading={loading} error={error} />}
    </main>
  </div>;
}
