import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App.jsx';

vi.mock('./components/SongDetail.jsx', () => ({
  default: ({ tune, content }) => <div data-testid="tune-detail">{tune.title}:{content}</div>
}));

const tune = { filename: 'test.abc', title: 'Test', rhythm: 'reel', meter: '4/4', key: 'G', tags: ['irish'] };
const source = 'X:1\nT:Test\nQ:120\nK:G\nG4|';
const fetchTunes = async (url) => url.endsWith('tunes/index.json')
  ? Response.json([tune]) : new Response(source);

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '#list');
    vi.stubGlobal('fetch', vi.fn(fetchTunes));
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('loads, filters and opens tunes with a shareable URL', async () => {
    render(<App />);
    await screen.findByRole('button', { name: /Test/ });
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: ' irish ' } });
    fireEvent.click(screen.getByRole('button', { name: /Test/ }));
    expect(await screen.findByTestId('tune-detail')).toHaveTextContent('T:Test');
    expect(window.location.hash).toBe('#tune=test.abc');
    expect(localStorage.getItem('mtunebook:last-tune')).toBe('test.abc');
    fireEvent.click(screen.getByRole('button', { name: /All tunes/ }));
    expect(screen.getByRole('searchbox')).toHaveValue(' irish ');
  });

  it('restores the last opened tune when no URL selection is present', async () => {
    window.history.replaceState(null, '', window.location.pathname);
    localStorage.setItem('mtunebook:last-tune', 'test.abc');
    render(<App />);
    expect(await screen.findByTestId('tune-detail')).toHaveTextContent('T:Test');
    expect(window.location.hash).toBe('#tune=test.abc');
  });

  it('honors direct links and browser Back/Forward', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /Test/ }));
    await screen.findByTestId('tune-detail');
    act(() => window.history.back());
    await screen.findByRole('searchbox');
    act(() => window.history.forward());
    expect(await screen.findByTestId('tune-detail')).toHaveTextContent('T:Test');
  });

  it('opens a direct tune link instead of a different saved selection', async () => {
    localStorage.setItem('mtunebook:last-tune', 'missing.abc');
    window.history.replaceState(null, '', '#tune=test.abc');
    render(<App />);
    expect(await screen.findByTestId('tune-detail')).toHaveTextContent('T:Test');
  });

  it('keeps browsing functional when storage reads and writes fail', async () => {
    window.history.replaceState(null, '', window.location.pathname);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /Test/ }));
    await screen.findByTestId('tune-detail');
    fireEvent.click(screen.getByRole('button', { name: /All tunes/ }));
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('retries a failed index request', async () => {
    fetch.mockRejectedValueOnce(new Error('offline'));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load the tune list');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('button', { name: /Test/ });
  });

  it('does not mount playback with missing notation and retries a failed tune request', async () => {
    fetch.mockImplementation(async (url) => url.endsWith('index.json') ? Response.json([tune]) : new Response('', { status: 404 }));
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /Test/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load this tune');
    expect(screen.queryByTestId('tune-detail')).not.toBeInTheDocument();
    fetch.mockImplementation(fetchTunes);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('tune-detail')).toHaveTextContent('T:Test');
  });

  it('ignores a late response after navigating away', async () => {
    let resolveTune;
    fetch.mockImplementation(async (url) => url.endsWith('index.json')
      ? Response.json([tune]) : new Promise((resolve) => { resolveTune = resolve; }));
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /Test/ }));
    await waitFor(() => expect(resolveTune).toBeTypeOf('function'));
    fireEvent.click(screen.getByRole('button', { name: /All tunes/ }));
    await act(async () => resolveTune(new Response(source)));
    expect(screen.queryByTestId('tune-detail')).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });
});
