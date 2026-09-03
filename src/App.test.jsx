import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App.jsx';

vi.mock('./components/SongList.jsx', () => ({
  default: ({ tunes, query, onSelect, isLoading }) => <div data-testid="tune-list">
    {isLoading ? 'Loading' : `Tunes:${tunes.length}:${query}`}
    <button onClick={() => onSelect({ filename: 'test.abc', title: 'Test', rhythm: 'reel', meter: '4/4', key: 'G' })}>Select</button>
  </div>
}));

vi.mock('./components/SongDetail.jsx', () => ({
  default: ({ tune, content }) => <div data-testid="tune-detail">{tune.title}:{content}</div>
}));

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn(async (url) => url.endsWith('tunes/index.json')
      ? Response.json([{ filename: 'test.abc', title: 'Test', rhythm: 'reel', meter: '4/4', key: 'G', tags: ['irish'] }])
      : new Response('X:1\nT:Test\nQ:120\nK:G\nG4|')));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('loads, filters and opens tunes', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('tune-list')).toHaveTextContent('Tunes:1:'));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'irish' } });
    expect(screen.getByTestId('tune-list')).toHaveTextContent('Tunes:1:irish');
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    await waitFor(() => expect(screen.getByTestId('tune-detail')).toHaveTextContent('T:Test'));
    expect(localStorage.getItem('mtunebook:last-tune')).toBe('test.abc');
  });

  it('restores the last opened tune', async () => {
    localStorage.setItem('mtunebook:last-tune', 'test.abc');
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('tune-detail')).toBeInTheDocument());
  });
});
