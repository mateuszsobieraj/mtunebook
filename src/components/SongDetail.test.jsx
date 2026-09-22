import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TuneDetail, { getOriginalTempo, keyLabel, transposeAbc } from './SongDetail.jsx';

const audio = vi.hoisted(() => ({ synths: [], timings: [], init: null,
  strTranspose: vi.fn((source, _parsed, steps) => source.replace('K:G', `K:shifted-${steps}`))
}));
vi.mock('abcjs', () => ({
  default: {
    parseOnly: vi.fn(() => [{}]), strTranspose: audio.strTranspose,
    renderAbc: vi.fn(() => [{}]),
    synth: { CreateSynth: vi.fn(function () {
      const instance = { init: vi.fn((options) => audio.init?.(options) || Promise.resolve()),
        prime: vi.fn(async () => {}), start: vi.fn(), stop: vi.fn(() => 5),
        seek: vi.fn(), getIsRunning: vi.fn(() => true), duration: 20 };
      audio.synths.push(instance);
      return instance;
    }) },
    TimingCallbacks: vi.fn(function (_visual, options) {
      const instance = { start: vi.fn(), stop: vi.fn(), options };
      audio.timings.push(instance);
      return instance;
    })
  }
}));

const tune = { filename: 'test.abc', title: 'Test', rhythm: 'reel', meter: '4/4', key: 'G' };
const content = 'X:1\nT:Test\nM:4/4\nL:1/8\nQ:1/4=132\nK:G\n"G"G4|';
const detail = (props = {}) => <TuneDetail tune={tune} content={content} isLoading={false} error="" {...props} />;

describe('TuneDetail', () => {
  beforeEach(() => {
    localStorage.clear();
    audio.synths.length = 0;
    audio.timings.length = 0;
    audio.init = null;
    vi.clearAllMocks();
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('reads both supported tempo formats', () => {
    expect(getOriginalTempo('Q:120')).toBe(120);
    expect(getOriginalTempo('Q:1/4=132')).toBe(132);
  });

  it('uses abcjs to transpose notation and chord symbols', () => {
    expect(transposeAbc(content, 2)).toContain('K:shifted-2');
    expect(audio.strTranspose).toHaveBeenCalledWith(content, [{}], 2);
  });

  it.each([
    ['Dm', 2, 'E minor'], ['Dmix', 2, 'E mixolydian'], ['D dorian', -2, 'C dorian'],
    ['Db', 2, 'Eb'], ['Gbmin', 1, 'G minor'], ['A#', 1, 'B'], ['Cb', 1, 'C'], ['E#', 1, 'F#']
  ])('labels %s transposed by %s as %s', (key, steps, expected) => {
    expect(keyLabel(key, steps)).toBe(expected);
  });

  it('starts with the tune tempo and labels semitone offsets', () => {
    render(detail());
    expect(screen.getByLabelText('Tempo in BPM')).toHaveValue(132);
    expect(screen.getByRole('option', { name: 'A (+2)' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Key'), { target: { value: '2' } });
    expect(audio.strTranspose).toHaveBeenCalled();
  });

  it('restores settings and resets tempo by clicking its label', () => {
    localStorage.setItem('mtunebook:test.abc', JSON.stringify({ tempo: 90, transpose: -2 }));
    render(detail());
    expect(screen.getByLabelText('Tempo in BPM')).toHaveValue(90);
    fireEvent.click(screen.getByRole('button', { name: 'Tempo' }));
    expect(screen.getByLabelText('Tempo in BPM')).toHaveValue(132);
    expect(screen.getByLabelText('Key')).toHaveValue('-2');
  });

  it('works with unavailable storage and validates saved controls', () => {
    localStorage.setItem('mtunebook:test.abc', JSON.stringify({ tempo: -20, transpose: 99 }));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    render(detail());
    expect(screen.getByLabelText('Tempo in BPM')).toHaveValue(40);
    expect(screen.getByLabelText('Key')).toHaveValue('0');
    fireEvent.change(screen.getByLabelText('Tempo in BPM'), { target: { value: '110' } });
    expect(screen.getByLabelText('Tempo in BPM')).toHaveValue(110);
  });

  it('starts and stops both audio and note timing', async () => {
    render(detail());
    fireEvent.click(screen.getByRole('button', { name: /Play/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Stop/ }));
    expect(audio.synths[0].init).toHaveBeenCalledWith(expect.objectContaining({ options: { qpm: 132 } }));
    expect(audio.synths[0].start).toHaveBeenCalledTimes(1);
    expect(audio.synths[0].stop).toHaveBeenCalled();
    expect(audio.timings[0].stop).toHaveBeenCalled();
  });

  it('cancels preparation and ignores repeated keyboard events', async () => {
    let resolveInit;
    audio.init = () => new Promise((resolve) => { resolveInit = resolve; });
    render(detail());
    fireEvent.keyDown(document.body, { code: 'Space' });
    expect(screen.getByRole('status')).toHaveTextContent('Preparing audio');
    fireEvent.keyDown(document.body, { code: 'Space', repeat: true });
    expect(audio.synths).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel playback' }));
    await act(async () => resolveInit());
    expect(audio.synths[0].start).not.toHaveBeenCalled();
    expect(audio.synths[0].prime).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Play/ })).toBeEnabled();
  });

  it('does not start audio with the keyboard while notation is unavailable', () => {
    render(detail({ content: null, isLoading: true }));
    fireEvent.keyDown(document.body, { code: 'Space' });
    expect(audio.synths).toHaveLength(0);
    expect(screen.getByRole('button', { name: /Play/ })).toBeDisabled();
  });

  it('resumes at the current position after changing tempo', async () => {
    render(detail());
    fireEvent.click(screen.getByRole('button', { name: /Play/ }));
    await screen.findByRole('button', { name: /Stop/ });
    fireEvent.change(screen.getByLabelText('Tempo in BPM'), { target: { value: '90' } });
    await waitFor(() => expect(audio.synths).toHaveLength(2));
    await waitFor(() => expect(audio.synths[1].start).toHaveBeenCalled());
    expect(audio.synths[1].init).toHaveBeenCalledWith(expect.objectContaining({ options: { qpm: 90 } }));
    expect(audio.synths[1].seek).toHaveBeenCalledWith(0.25);
    expect(audio.timings[1].start).toHaveBeenCalledWith(0.25);
  });

  it('cleans up pending playback when the detail unmounts', async () => {
    let resolveInit;
    audio.init = () => new Promise((resolve) => { resolveInit = resolve; });
    const { unmount } = render(detail());
    fireEvent.click(screen.getByRole('button', { name: /Play/ }));
    unmount();
    await act(async () => resolveInit());
    expect(audio.synths[0].start).not.toHaveBeenCalled();
  });

  it('shows initialization errors and allows retrying', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    audio.init = () => Promise.reject(new Error('offline'));
    render(detail());
    fireEvent.click(screen.getByRole('button', { name: /Play/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not start playback');
    audio.init = null;
    fireEvent.click(screen.getByRole('button', { name: /Play/ }));
    await screen.findByRole('button', { name: /Stop/ });
  });
});
