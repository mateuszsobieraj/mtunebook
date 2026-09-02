import { useMemo } from 'react';

export default function TuneList({ tunes = [], query, onSelect, isLoading, error }) {
  const groups = useMemo(() => {
    const result = {};
    tunes.forEach((tune) => { const letter = tune.title[0].toUpperCase(); (result[letter] ||= []).push(tune); });
    return Object.entries(result).sort(([a], [b]) => a.localeCompare(b)).map(([letter, items]) => ({
      letter, tunes: items.sort((a, b) => a.title.localeCompare(b.title))
    }));
  }, [tunes]);
  if (isLoading) return <div className="empty-state">Loading tunes...</div>;
  if (error) return <div className="empty-state">{error}</div>;
  if (!groups.length) return <div className="empty-state">{query ? `No tunes match "${query}".` : 'The tunebook is empty.'}</div>;
  return <div className="tune-list">{groups.map(({ letter, tunes: items }) =>
    <section key={letter} className="letter-section"><h2>{letter} <small>{items.length}</small></h2>
      <div className="tune-grid">{items.map((tune) =>
        <button key={tune.filename} className="tune-card" onClick={() => onSelect(tune)}>
          <strong>{tune.title}</strong><span>{[tune.rhythm, tune.meter, tune.key && `key ${tune.key}`].filter(Boolean).join(' · ')}</span>
        </button>)}</div>
    </section>)}</div>;
}
