import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TuneDetail, { getOriginalTempo, transposeAbc } from './SongDetail.jsx';

const { strTranspose } = vi.hoisted(() => ({
  strTranspose: vi.fn((source, _parsed, steps) => source.replace('K:G', `K:shifted-${steps}`))
}));
vi.mock('abcjs', () => ({
  default: {
    parseOnly: vi.fn(() => [{}]),
    strTranspose,
    renderAbc: vi.fn(() => [{}]),
    synth: { CreateSynth: vi.fn() }
  }
}));

const tune = { filename: 'test.abc', title: 'Test', rhythm: 'reel', meter: '4/4', key: 'G' };
const content = 'X:1\nT:Test\nM:4/4\nL:1/8\nQ:1/4=132\nK:G\n"G"G4|';

describe('TuneDetail', () => {
  beforeEach(() => localStorage.clear());

  it('reads both supported tempo formats', () => {
    expect(getOriginalTempo('Q:120')).toBe(120);
    expect(getOriginalTempo('Q:1/4=132')).toBe(132);
  });

  it('uses abcjs to transpose notation and chord symbols', () => {
    expect(transposeAbc(content, 2)).toContain('K:shifted-2');
    expect(strTranspose).toHaveBeenCalledWith(content, [{}], 2);
  });

  it('starts with the tune tempo and labels semitone offsets', async () => {
    render(<TuneDetail tune={tune} content={content} isLoading={false} error="" />);
    await waitFor(() => expect(screen.getByLabelText('Tempo in BPM')).toHaveValue(132));
    expect(screen.getByRole('option', { name: 'A (+2)' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Key'), { target: { value: '2' } });
    expect(strTranspose).toHaveBeenCalled();
  });

  it('restores settings and resets tempo by clicking its label', async () => {
    localStorage.setItem('mtunebook:test.abc', JSON.stringify({ tempo: 90, transpose: -2 }));
    render(<TuneDetail tune={tune} content={content} isLoading={false} error="" />);
    await waitFor(() => expect(screen.getByLabelText('Tempo in BPM')).toHaveValue(90));
    fireEvent.click(screen.getByRole('button', { name: 'Tempo' }));
    expect(screen.getByLabelText('Tempo in BPM')).toHaveValue(132);
    expect(screen.getByLabelText('Key')).toHaveValue('-2');
  });
});
