import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App.jsx';

vi.mock('./components/SongList.jsx', () => ({
  default: ({ songs, query, onSelect, isLoading }) => (
    <div data-testid="mock-song-list">
      {isLoading ? 'Loading' : `Songs:${songs.length}:${query}`}
      <button onClick={() => onSelect({ filename: 'test.chordpro', title: 'Test Song', artist: 'Tester' })}>Select</button>
    </div>
  )
}));

vi.mock('./components/SongDetail.jsx', () => ({
  default: ({ song, content, isLoading, error, viewMode, onSetViewMode }) => (
    <div data-testid="mock-song-detail">
      <div>{song?.title}</div>
      <div>{isLoading ? 'Loading song' : content}</div>
      <div>{error}</div>
      <button onClick={() => onSetViewMode('lyrics')}>Lyrics</button>
    </div>
  )
}));

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (url.endsWith('/songs/index.json')) {
        return Response.json([
          {
            filename: 'test.chordpro',
            title: 'Test Song',
            artist: 'Tester',
            genres: ['Bluegrass'],
            tags: ['banjo'],
            speed: 'fast'
          }
        ]);
      }

      return new Response('{title: Test Song}\n[C]Hello', {
        headers: { 'content-type': 'text/plain' }
      });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.className = '';
  });

  it('renders song list by default and can go home after selecting a song', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-song-list')).toHaveTextContent('Songs:1:');
    });

    expect(screen.getByTestId('mock-song-list')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-song-detail')).not.toBeInTheDocument();

    const selectButton = screen.getByRole('button', { name: /Select/i });
    fireEvent.click(selectButton);

    expect(screen.getByTestId('mock-song-detail')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('mock-song-detail')).toHaveTextContent('Hello');
    });

    fireEvent.click(screen.getByRole('button', { name: /Go to song list/i }));

    expect(screen.getByTestId('mock-song-list')).toBeInTheDocument();
  });

  it('searches song metadata from the manifest', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-song-list')).toHaveTextContent('Songs:1:');
    });

    fireEvent.change(screen.getByPlaceholderText(/Search by title/i), {
      target: { value: 'banjo' }
    });

    expect(screen.getByTestId('mock-song-list')).toHaveTextContent('Songs:1:banjo');

    fireEvent.change(screen.getByPlaceholderText(/Search by title/i), {
      target: { value: 'jazz' }
    });

    expect(screen.getByTestId('mock-song-list')).toHaveTextContent('Songs:0:jazz');
  });
});
