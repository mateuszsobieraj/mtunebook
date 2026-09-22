import abcjs from 'abcjs';
import { transposeAbc } from './SongDetail.jsx';

it('transposes real ABC notation, chord symbols, and a minor key together', () => {
  const source = 'X:1\nT:Minor tune\nM:4/4\nL:1/8\nK:Dm\n"Dm"D2 F2 A2 d2|';
  const transposed = transposeAbc(source, 2);
  expect(transposed).toContain('K:Em');
  expect(transposed).toContain('"Em"');
  const parsed = abcjs.parseOnly(transposed)[0];
  expect(parsed.warnings || []).toHaveLength(0);
  expect(parsed.getKeySignature()).toMatchObject({ root: 'E', mode: 'm' });
});
