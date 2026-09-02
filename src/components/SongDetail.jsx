import { useEffect, useRef, useState } from 'react';
import abcjs from 'abcjs';

const keyNames = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const notePattern = /([_^=]*)([A-Ga-g])([',]*)/g;

function transposeAbc(source, semitones) {
  if (!source || semitones === 0) return source;
  const keyMatch = source.match(/^K:([^\n\r]+)/m);
  const key = keyMatch?.[1].trim() || 'C';
  const root = key.match(/[A-Ga-g](?:#|b)?/)?.[0] || 'C';
  const rootIndex = keyNames.findIndex((name) => name.toLowerCase() === root.toLowerCase());
  const shift = rootIndex >= 0 ? rootIndex + semitones : semitones;
  const transposedKey = keyNames[(shift % 12 + 12) % 12] + key.slice(root.length);
  const headerEnd = source.indexOf('\n', source.indexOf('K:'));
  const header = source.slice(0, headerEnd + 1);
  const chords = [];
  const body = source.slice(headerEnd + 1).replace(/"[^"]*"/g, (chord) => {
    chords.push(chord);
    return `xxx${chords.length - 1}xxx`;
  });
  const notes = body.replace(notePattern, (match, accidental, letter, octave) => {
    const accidentalOffset = accidental.includes('^') ? accidental.length : accidental.includes('_') ? -accidental.length : 0;
    const base = keyNames.indexOf(letter.toUpperCase()) + accidentalOffset + semitones;
    const note = keyNames[(base % 12 + 12) % 12];
    const nextAccidental = note.length > 1 ? (note[1] === '#' ? '^' : '_') : '';
    return `${nextAccidental}${letter === letter.toLowerCase() ? note[0].toLowerCase() : note[0]}${octave}`;
  }).replace(/xxx(\d+)xxx/g, (_, index) => chords[index]);
  return header.replace(/^K:[^\n\r]+/m, `K:${transposedKey}`) + notes;
}

export default function TuneDetail({ tune, content, isLoading, error }) {
  const paper = useRef(null);
  const synth = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState('');
  const [tempo, setTempo] = useState(100);
  const [transpose, setTranspose] = useState(0);
  const transposedContent = transposeAbc(content, transpose);
  const originalKey = tune.key?.match(/[A-Ga-g](?:#|b)?/)?.[0] || 'C';
  const originalKeyIndex = keyNames.findIndex((name) => name.toLowerCase() === originalKey.toLowerCase());
  const getTargetKey = (semitones) => keyNames[((originalKeyIndex + semitones) % 12 + 12) % 12];

  useEffect(() => {
    synth.current?.stop(); synth.current = null; setPlaying(false); setAudioError('');
    if (transposedContent && paper.current) abcjs.renderAbc(paper.current, transposedContent, { responsive: 'resize', scale: 1.15, add_classes: true });
  }, [transposedContent]);
  useEffect(() => () => synth.current?.stop(), []);

  const play = async () => {
    try {
      setAudioError(''); synth.current?.stop();
      const visualObj = abcjs.renderAbc(paper.current, transposedContent, { responsive: 'resize', scale: 1.15, add_classes: true })[0];
      synth.current = new abcjs.synth.CreateSynth();
      await synth.current.init({ visualObj, options: { qpm: tempo } }); await synth.current.prime(); synth.current.start(); setPlaying(true);
    } catch (err) { console.error(err); setAudioError('The browser could not start playback.'); setPlaying(false); }
  };
  const stop = () => { synth.current?.stop(); setPlaying(false); };
  const togglePlayback = () => playing ? stop() : play();

  return <article className="tune-detail">
    <div className="tune-heading"><div><p className="eyebrow">{tune.rhythm} · {tune.meter} · {tune.key}</p><h1>{tune.title}</h1></div>
      <div className="playback-controls"><button className={`play-button${playing ? ' is-playing' : ''}`} onClick={togglePlayback} disabled={isLoading || !content} aria-pressed={playing}>{playing ? '■ Stop' : '▶ Play'}</button><label className="tempo-control">Tempo <input type="range" min="40" max="220" step="1" value={tempo} onChange={(event) => setTempo(Number(event.target.value))} /><output>{tempo} BPM</output></label><label className="key-control">Key <select value={transpose} onChange={(event) => { stop(); setTranspose(Number(event.target.value)); }}><option value="0">Original ({originalKey})</option>{Array.from({ length: 13 }, (_, index) => index - 6).filter((value) => value !== 0).map((value) => <option key={value} value={value}>{getTargetKey(value)}</option>)}</select></label></div>
    </div>
    {isLoading && <div className="empty-state light">Loading notation...</div>}
    {(error || audioError) && <div className="message error">{error || audioError}</div>}
    <div ref={paper} className="music-paper" aria-label={`Zapis nutowy: ${tune.title}`} />
  </article>;
}
