import ChordSheetJS from 'chordsheetjs';

export function parseChordPro(text) {
  if (!text) return '';
  // Remove ChordPro directives in braces {meta: ...} and chords in brackets [C], [G7] etc.
  let t = text.replace(/\{[^}]*\}/g, '');
  t = t.replace(/\[[^\]]*\]/g, '');
  // Normalize newlines and remove excessive empty lines
  t = t.replace(/\r/g, '');
  t = t.replace(/\n{3,}/g, '\n\n');
  // Trim trailing whitespace on lines and overall
  t = t.split('\n').map(l => l.replace(/\s+$/g, '')).join('\n');
  return t.trim();
}

export function renderLyricsOnlyHtml(rawText) {
  if (!rawText) return '';

  const html = [];
  let isInChorus = false;
  let pendingChorusLabel = '';

  const openChorus = () => {
    if (isInChorus) return;
    html.push('<div class="lyrics-chorus">');
    pendingChorusLabel = '';
    isInChorus = true;
  };

  const closeChorus = () => {
    if (!isInChorus) return;
    html.push('</div>');
    isInChorus = false;
  };

  rawText.replace(/\r/g, '').split('\n').forEach((line) => {
    const directive = line.trim().match(/^\{([^:}]+)(?::\s*([^}]*))?\}$/);

    if (directive) {
      const name = directive[1].trim().toLowerCase();
      const value = (directive[2] || '').trim();

      if (name === 'start_of_chorus' || name === 'soc') {
        openChorus();
      } else if (name === 'end_of_chorus' || name === 'eoc') {
        closeChorus();
      } else if ((name === 'comment' || name === 'c') && /^chorus\b/i.test(value)) {
        pendingChorusLabel = value;
      }
      return;
    }

    const lyrics = line.replace(/\[[^\]]*\]/g, '').replace(/\s+$/g, '');

    if (lyrics.trim() === '') {
      html.push('<div class="lyrics-line empty"></div>');
      return;
    }

    html.push(`<div class="lyrics-line">${escapeHtml(lyrics)}</div>`);
  });

  closeChorus();

  return html.join('');
}

export function renderChordsOnly(rawText) {
  if (!rawText) return '';
  
  const lines = rawText.replace(/\r/g, '').split('\n');
  const out = lines.map(line => {
    const matches = [];
    let m;
    const re = /\[([^\]]+)\]/g;
    while ((m = re.exec(line)) !== null) {
      matches.push(m[1].trim());
    }
    return matches.join(' ');
  });
  
  // Strip leading empty chord lines
  let firstNonEmpty = 0;
  while (firstNonEmpty < out.length && out[firstNonEmpty].trim() === '') firstNonEmpty++;
  const trimmed = out.slice(firstNonEmpty);
  
  if (trimmed.length === 0) {
    return '<div class="chords-only-line empty"></div>';
  }
  
  // Return HTML string as in vanilla version
  return trimmed.map(l => 
    l ? `<div class="chords-only-line">${escapeHtml(l)}</div>` : '<div class="chords-only-line empty"></div>'
  ).join('');
}

// Parse ChordPro text to chordsheetjs Song object
export function parseAndRenderChordPro(chordProText) {
  if (!chordProText) return null;
  try {
    const parser = new ChordSheetJS.ChordProParser();
    const song = parser.parse(chordProText);
    return song;
  } catch (error) {
    console.error('parsing chordPro error:', error);
    return null;
  }
}

// Render Song object to HTML string using chordsheetjs DivFormatter (responsive layout)
export function renderChordSheetHtml(song) {
  if (!song) return '';
  try {
    const formatter = new ChordSheetJS.HtmlDivFormatter();
    return sanitizeHtml(formatter.format(song));
  } catch (error) {
    console.error('render error:', error);
    return '';
  }
}

// Returns CSS needed for HtmlDivFormatter output, scoped to .chordsheet
export function getChordSheetCss() {
  const formatter = new ChordSheetJS.HtmlDivFormatter();
  return formatter.cssString('.chordsheet ');
}

function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function sanitizeHtml(html) {
  if (typeof html !== 'string') return '';

  const template = document.createElement('template');
  template.innerHTML = html;

  template.content.querySelectorAll('script, iframe, object, embed').forEach((node) => {
    node.remove();
  });

  template.content.querySelectorAll('*').forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();

      if (name.startsWith('on') || value.startsWith('javascript:')) {
        node.removeAttribute(attribute.name);
      }
    });
  });

  return template.innerHTML;
}
