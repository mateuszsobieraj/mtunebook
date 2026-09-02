import { fireEvent, render, screen } from '@testing-library/react';
import SongDetail from './SongDetail.jsx';

describe('SongDetail', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('scales song content with the font controls', () => {
    render(
      <SongDetail
        song={{ title: 'Test Song', artist: 'Tester' }}
        content={`{title: Test Song}\n[C]Hello`}
        isLoading={false}
        viewMode="lyrics"
        onSetViewMode={vi.fn()}
        onBack={vi.fn()}
      />
    );

    const content = document.querySelector('.song-content');

    expect(content).toHaveStyle({ '--song-font-scale': '1' });

    fireEvent.click(screen.getByTitle('Increase font size'));

    expect(content).toHaveStyle({ '--song-font-scale': '1.1' });
  });
});
