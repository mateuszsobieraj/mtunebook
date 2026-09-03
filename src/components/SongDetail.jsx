import { useEffect, useMemo, useRef, useState } from 'react';
import abcjs from 'abcjs';

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
  try { return JSON.parse(localStorage.getItem(`mtunebook:${filename}`)) || {}; } catch { return {}; }
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
  const settingsTune = useRef('');
  const skipSettingsSave = useRef(true);
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState('');
  const originalTempo = getOriginalTempo(content);
  const [tempo, setTempo] = useState(100);
  const [transpose, setTranspose] = useState(0);
  const transposedContent = useMemo(() => transposeAbc(content, transpose), [content, transpose]);
  const originalKey = content?.match(/^K:\s*([A-Ga-g](?:#|b)?)/m)?.[1]
    || tune.key?.match(/[A-Ga-g](?:#|b)?/)?.[0] || 'C';
  const originalKeyIndex = keyNames.findIndex((name) => name.toLowerCase() === originalKey.toLowerCase());
  const getTargetKey = (semitones) => keyNames[((originalKeyIndex + semitones) % 12 + 12) % 12];

  if (settingsTune.current !== tune.filename) {
    settingsTune.current = tune.filename;
    skipSettingsSave.current = true;
  }

  const clearHighlight = () => {
    highlightedNotes.current.forEach((element) => element.classList.remove('is-playing-note'));
    highlightedNotes.current = [];
  };

  useEffect(() => {
    const settings = savedSettings(tune.filename);
    setTempo(Number.isFinite(settings.tempo) ? settings.tempo : originalTempo);
    setTranspose(Number.isFinite(settings.transpose) ? settings.transpose : 0);
  }, [tune.filename, originalTempo]);

  useEffect(() => {
    if (skipSettingsSave.current) { skipSettingsSave.current = false; return; }
    localStorage.setItem(`mtunebook:${tune.filename}`, JSON.stringify({ tempo, transpose }));
  }, [tempo, transpose, tune.filename]);

  useEffect(() => {
    operationId.current += 1;
    rebuildingTempo.current = false;
    synth.current?.stop();
    timing.current?.stop();
    clearHighlight();
    synth.current = null;
    playbackPosition.current = 0;
    setPlaying(false);
    setAudioError('');
    if (transposedContent && paper.current) abcjs.renderAbc(paper.current, transposedContent, renderOptions);
  }, [transposedContent]);

  useEffect(() => {
    if (!playing) return undefined;
    const monitor = window.setInterval(() => {
      if (synth.current && !rebuildingTempo.current && !synth.current.getIsRunning()) {
        setPlaying(false);
        playbackPosition.current = 0;
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

  const createSynth = async (qpm) => {
    const visualObj = abcjs.renderAbc(paper.current, transposedContent, renderOptions)[0];
    const nextSynth = new abcjs.synth.CreateSynth();
    await nextSynth.init({ visualObj, options: { qpm } });
    await nextSynth.prime();
    const nextTiming = new abcjs.TimingCallbacks(visualObj, {
      qpm,
      eventCallback: (event) => {
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
    rebuildingTempo.current = false;
    window.clearTimeout(tempoTimer.current);
    synth.current?.stop();
    timing.current?.stop();
    clearHighlight();
    playbackPosition.current = 0;
    setPlaying(false);
  };

  const play = async () => {
    try {
      const requestId = ++operationId.current;
      setAudioError('');
      synth.current?.stop();
      playbackPosition.current = 0;
      const { nextSynth, nextTiming } = await createSynth(tempo);
      if (requestId !== operationId.current) return;
      synth.current = nextSynth;
      timing.current = nextTiming;
      nextSynth.start();
      nextTiming.start();
      rebuildingTempo.current = false;
      setPlaying(true);
    } catch (err) {
      console.error(err);
      setAudioError('The browser could not start playback.');
      setPlaying(false);
    }
  };

  const restartAtTempo = async (nextTempo, requestId) => {
    try {
      const { nextSynth, nextTiming } = await createSynth(nextTempo);
      if (requestId !== operationId.current) return;
      nextSynth.seek(playbackPosition.current);
      synth.current = nextSynth;
      timing.current = nextTiming;
      nextSynth.start();
      nextTiming.start(playbackPosition.current);
      rebuildingTempo.current = false;
    } catch (err) {
      if (requestId !== operationId.current) return;
      rebuildingTempo.current = false;
      console.error(err);
      setAudioError('The playback tempo could not be changed.');
      setPlaying(false);
    }
  };

  const changeTempo = (value) => {
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
      if (event.target.matches('input, select, button')) return;
      if (event.code === 'Space') { event.preventDefault(); playing ? stop() : play(); }
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
        <button className={`play-button${playing ? ' is-playing' : ''}`} onClick={playing ? stop : play} disabled={isLoading || !content} aria-pressed={playing}>{playing ? '■ Stop' : '▶ Play'}</button>
        <div className="tempo-control"><button className="tempo-reset" type="button" onClick={resetTempo} title="Restore the original tempo">Tempo</button>
          <input aria-label="Tempo" type="range" min="40" max="220" step="1" value={tempo} onChange={(event) => changeTempo(event.target.value)} />
          <input aria-label="Tempo in BPM" className="tempo-number" type="number" min="40" max="220" value={tempo} onChange={(event) => changeTempo(event.target.value)} />
          <span>BPM</span>
        </div>
        <label className="key-control">Key <select aria-label="Key" value={transpose} onChange={(event) => { stop(); setTranspose(Number(event.target.value)); }}>
          <option value="0">{originalKey} (original, 0)</option>
          {Array.from({ length: 13 }, (_, index) => index - 6).filter(Boolean).map((value) => <option key={value} value={value}>{getTargetKey(value)} ({value > 0 ? '+' : ''}{value})</option>)}
        </select></label>
      </div>
    </div>
    {isLoading && <div className="empty-state light">Loading notation…</div>}
    {(error || audioError) && <div className="message error">{error || audioError}</div>}
    <div ref={paper} className="music-paper" aria-label={`Zapis nutowy: ${tune.title}`} />
  </article>;
}
