import { parseChordPro, renderChordsOnly, renderLyricsOnlyHtml, parseAndRenderChordPro } from './chordpro.js';

describe('chordpro utilities', () => {
  it('removes directives and chords from ChordPro text', () => {
    const input = '{title: Test}\n[C]Hello [G]world\n{artist: Me}\n';
    expect(parseChordPro(input)).toBe('Hello world');
  });

  it('renders only chord names from ChordPro text', () => {
    const input = 'Hello [C]world [G7]\nNext [Am]line';
    expect(renderChordsOnly(input)).toContain('C');
    expect(renderChordsOnly(input)).toContain('G7');
    expect(renderChordsOnly(input)).toContain('Am');
  });

  it('highlights chorus sections in lyrics-only HTML', () => {
    const input = '{title: Test}\n{c: Chorus x 2}\n{start_of_chorus}\n[C]Hello [G]world\n{end_of_chorus}\nVerse line';
    const html = renderLyricsOnlyHtml(input);

    expect(html).toContain('class="lyrics-chorus"');
    expect(html).not.toContain('Chorus x 2');
    expect(html).toContain('Hello world');
    expect(html).not.toContain('[C]');
  });

  it('parses valid ChordPro text into a song object', () => {
    const input = '{title: Test}\n[C]Hello [G]world';
    const song = parseAndRenderChordPro(input);
    expect(song).toBeTruthy();
    expect(song.title).toBe('Test');
  });
});
