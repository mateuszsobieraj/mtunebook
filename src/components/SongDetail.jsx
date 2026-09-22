import { useEffect, useMemo, useRef, useState } from 'react';
import abcjs from 'abcjs';
import { readPreference, writePreference } from '../storage.js';

const keyNames = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const renderOptions = { responsive: 'resize', scale: 0.9, add_classes: true };

export function transposeAbc(source, semitones) {
  if (!source || semitones === 0) return source;
  return abcjs.strTranspose(source, abcjs.parseOnly(source), semitones);
}

export function getOriginalTempo(source) {
  const value = source?.match(/^Q:\s*(?:\d+\s*\/\s*\d+\s*=\s*)?(\d+)/m)?.[1];
  return value ? Number(value) : 100;
}

function savedSettings(filename) {
  try { return JSON.parse(readPreference(`mtunebook:${filename}`)) || {}; } catch { return {}; }
}

export function keyLabel(value, semitones = 0) {
  const match = value?.trim().match(/^([A-Ga-g])([#b]?)(?:\s*(mixolydian|mix|dorian|dor|phrygian|phr|lydian|lyd|locrian|loc|aeolian|aeo|ionian|ion|minor|min|major|maj|m))?/i);
  if (!match) return value || 'C';
  const root = match[1].toUpperCase() + match[2];
  const mode = (match[3] || '').toLowerCase();
  const modes = { m: 'minor', min: 'minor', minor: 'minor', mix: 'mixolydian', dor: 'dorian', phr: 'phrygian', lyd: 'lydian', loc: 'locrian', aeo: 'aeolian', ion: 'ionian', maj: 'major' };
  const pitch = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1].toUpperCase()]
    + (match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0);
  const target = semitones === 0 ? root : keyNames[((pitch + semitones) % 12 + 12) % 12];
  return [target, modes[mode] || mode].filter(Boolean).join(' ');
}

export default function TuneDetail({ tune, content, isLoading, error }) {
  const paper = useRef(null);
  const synth = useRef(null);
  const timing = useRef(null);
  const highlightedNotes = useRef([]);
  const playbackPosition = useRef(0);
  const operationId = useRef(0);
  const tempoTimer = useRef(null);
  const rebuildingTempo = useRef(false);
  const preparingRef = useRef(false);
  const [preparing, setPreparing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState('');
  const [notationError, setNotationError] = useState('');
  const originalTempo = getOriginalTempo(content);
  const [tempo, setTempo] = useState(() => {
    const saved = savedSettings(tune.filename).tempo;
    return Math.max(40, Math.min(220, Number.isFinite(saved) ? saved : originalTempo));
  });
  const [transpose, setTranspose] = useState(() => {
    const saved = savedSettings(tune.filename).transpose;
    return Number.isInteger(saved) && Math.abs(saved) <= 6 ? saved : 0;
  });
  const transposition = useMemo(() => {
    try { return { content: transposeAbc(content, transpose) }; }
    catch { return { error: 'Unable to transpose this notation.' }; }
  }, [content, transpose]);
  const transposedContent = transposition.content;
  const originalKey = content?.match(/^K:[ \t]*([^\r\n]+)/m)?.[1] || tune.key || 'C';
  const canPlay = Boolean(content) && !isLoading && !error && !notationError && !transposition.error;

  const clearHighlight = () => {
    highlightedNotes.current.forEach((element) => element.classList.remove('is-playing-note'));
    highlightedNotes.current = [];
  };

  useEffect(() => {
    writePreference(`mtunebook:${tune.filename}`, JSON.stringify({ tempo, transpose }));
  }, [tempo, transpose, tune.filename]);

  useEffect(() => {
    operationId.current += 1;
    window.clearTimeout(tempoTimer.current);
    preparingRef.current = false;
    setPreparing(false);
    rebuildingTempo.current = false;
    synth.current?.stop();
    timing.current?.stop();
    clearHighlight();
    synth.current = null;
    playbackPosition.current = 0;
    setPlaying(false);
    setAudioError('');
    setNotationError('');
    if (paper.current) paper.current.replaceChildren();
    try {
      if (transposedContent && paper.current) abcjs.renderAbc(paper.current, transposedContent, renderOptions);
    } catch {
      setNotationError('Unable to display this notation.');
    }
  }, [transposedContent]);

  useEffect(() => {
    if (!playing) return undefined;
    const monitor = window.setInterval(() => {
      if (synth.current && !rebuildingTempo.current && !synth.current.getIsRunning()) {
        setPlaying(false);
        playbackPosition.current = 0;
        timing.current?.stop();
        clearHighlight();
      }
    }, 250);
    return () => window.clearInterval(monitor);
  }, [playing]);

  useEffect(() => () => {
    operationId.current += 1;
    window.clearTimeout(tempoTimer.current);
    synth.current?.stop();
    timing.current?.stop();
    clearHighlight();
  }, []);

  const createSynth = async (qpm, requestId) => {
    const visualObj = abcjs.renderAbc(paper.current, transposedContent, renderOptions)[0];
    const nextSynth = new abcjs.synth.CreateSynth();
    await nextSynth.init({ visualObj, options: { qpm } });
    if (requestId !== operationId.current) { nextSynth.stop(); return null; }
    await nextSynth.prime();
    if (requestId !== operationId.current) { nextSynth.stop(); return null; }
    const nextTiming = new abcjs.TimingCallbacks(visualObj, {
      qpm,
      eventCallback: (event) => {
        if (requestId !== operationId.current) return;
        clearHighlight();
        if (!event) {
          if (!rebuildingTempo.current) { setPlaying(false); playbackPosition.current = 0; }
          return;
        }
        highlightedNotes.current = (event.elements || []).flat().filter(Boolean);
        highlightedNotes.current.forEach((element) => element.classList.add('is-playing-note'));
      }
    });
    return { nextSynth, nextTiming };
  };

  const stop = () => {
    operationId.current += 1;
    preparingRef.current = false;
    setPreparing(false);
    rebuildingTempo.current = false;
    window.clearTimeout(tempoTimer.current);
    synth.current?.stop();
    timing.current?.stop();
    clearHighlight();
    playbackPosition.current = 0;
    setPlaying(false);
  };

  const play = async () => {
    if (!canPlay || preparingRef.current || playing) return;
    const requestId = ++operationId.current;
    preparingRef.current = true;
    setPreparing(true);
    try {
      setAudioError('');
      synth.current?.stop();
      timing.current?.stop();
      playbackPosition.current = 0;
      const prepared = await createSynth(tempo, requestId);
      if (!prepared) return;
      const { nextSynth, nextTiming } = prepared;
      synth.current = nextSynth;
      timing.current = nextTiming;
      nextSynth.start();
      nextTiming.start();
      rebuildingTempo.current = false;
      setPlaying(true);
    } catch (err) {
      if (requestId !== operationId.current) return;
      stop();
      console.error(err);
      setAudioError('The browser could not start playback.');
      setPlaying(false);
    } finally {
      if (requestId === operationId.current) {
        preparingRef.current = false;
        setPreparing(false);
      }
    }
  };

  const restartAtTempo = async (nextTempo, requestId) => {
    try {
      const prepared = await createSynth(nextTempo, requestId);
      if (!prepared) return;
      const { nextSynth, nextTiming } = prepared;
      nextSynth.seek(playbackPosition.current);
      synth.current = nextSynth;
      timing.current = nextTiming;
      nextSynth.start();
      nextTiming.start(playbackPosition.current);
      rebuildingTempo.current = false;
    } catch (err) {
      if (requestId !== operationId.current) return;
      stop();
      console.error(err);
      setAudioError('The playback tempo could not be changed.');
      setPlaying(false);
    }
  };

  const changeTempo = (value) => {
    if (preparingRef.current) return;
    const nextTempo = Math.max(40, Math.min(220, Number(value) || originalTempo));
    setTempo(nextTempo);
    if (!playing) return;

    const requestId = ++operationId.current;
    rebuildingTempo.current = true;
    window.clearTimeout(tempoTimer.current);
    const currentSynth = synth.current;
    if (currentSynth?.getIsRunning()) {
      const elapsed = currentSynth.stop();
      playbackPosition.current = Math.min(elapsed / currentSynth.duration, 1);
    }
    timing.current?.stop();
    clearHighlight();
    tempoTimer.current = window.setTimeout(() => restartAtTempo(nextTempo, requestId), 120);
  };

  const resetTempo = () => changeTempo(originalTempo);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || !canPlay) return;
      if (event.target instanceof Element && event.target.closest('input, select, button, textarea, a, [contenteditable]')) return;
      if (event.code === 'Space') { event.preventDefault(); playing || preparingRef.current ? stop() : play(); }
      if (event.key === 'ArrowUp') { event.preventDefault(); changeTempo(tempo + 1); }
      if (event.key === 'ArrowDown') { event.preventDefault(); changeTempo(tempo - 1); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return <article className="tune-detail">
    <div className="tune-heading">
      <div><p className="eyebrow">{tune.rhythm} · {tune.meter} · {tune.key}</p><h1>{tune.title}</h1></div>
      <div className="playback-controls">
        <button className={`play-button${playing ? ' is-playing' : ''}`} onClick={playing || preparing ? stop : play} disabled={!canPlay} aria-pressed={playing}>{preparing ? 'Cancel playback' : playing ? '■ Stop' : '▶ Play'}</button>
        {preparing && <span role="status">Preparing audio…</span>}
        <div className="tempo-control"><button className="tempo-reset" type="button" onClick={resetTempo} title="Restore the original tempo">Tempo</button>
          <input aria-label="Tempo" type="range" min="40" max="220" step="1" value={tempo} disabled={preparing} onChange={(event) => changeTempo(event.target.value)} />
          <input aria-label="Tempo in BPM" className="tempo-number" type="number" min="40" max="220" value={tempo} disabled={preparing} onChange={(event) => changeTempo(event.target.value)} />
          <span>BPM</span>
        </div>
        <label className="key-control">Key <select aria-label="Key" value={transpose} onChange={(event) => { stop(); setTranspose(Number(event.target.value)); }}>
          <option value="0">{keyLabel(originalKey)} (original, 0)</option>
          {Array.from({ length: 13 }, (_, index) => index - 6).filter(Boolean).map((value) => <option key={value} value={value}>{keyLabel(originalKey, value)} ({value > 0 ? '+' : ''}{value})</option>)}
        </select></label>
      </div>
    </div>
    {isLoading && <div className="empty-state light">Loading notation…</div>}
    {(error || audioError || notationError || transposition.error) && <div className="message error" role="alert">{error || audioError || notationError || transposition.error}</div>}
    <div ref={paper} className="music-paper" aria-label={`Zapis nutowy: ${tune.title}`} />
  </article>;
}
