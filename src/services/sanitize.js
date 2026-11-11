const ALLOWED = new Set(['RUBY', 'RT', 'RP', 'RB']);
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE']);
const KANJI = /[\u3400-\u9fff々]/;

/**
 * Keeps only furigana tags and text; everything else is removed.
 * Optionally wraps kanji and target words in highlight spans.
 */
export function sanitizeFurigana(html, { highlightKanji = false, targets = [] } = {}) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(String(html), 'text/html');

  // Pass 1: the plain text (readings excluded) and which characters sit inside a target word
  let plain = '';
  const collect = (node, inReading) => {
    node.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) {
        if (!inReading) plain += n.textContent;
      } else if (n.nodeType === Node.ELEMENT_NODE && !DROP.has(n.tagName)) {
        collect(n, inReading || n.tagName === 'RT' || n.tagName === 'RP');
      }
    });
  };
  collect(doc.body, false);

  const marked = new Array(plain.length).fill(false);
  targets.filter(Boolean).forEach((word) => {
    let i = plain.indexOf(word);
    while (i !== -1) {
      for (let k = i; k < i + word.length; k++) marked[k] = true;
      i = plain.indexOf(word, i + word.length);
    }
  });

  // Pass 2: rebuild the HTML from allowed tags only, adding highlight spans
  let offset = 0;
  const out = document.createElement('div');

  const emitText = (text, to, inReading) => {
    if (inReading) {
      to.appendChild(document.createTextNode(text));
      return;
    }
    let run = '';
    let runClass = '';
    const flush = () => {
      if (!run) return;
      if (runClass) {
        const span = document.createElement('span');
        span.className = runClass;
        span.textContent = run;
        to.appendChild(span);
      } else {
        to.appendChild(document.createTextNode(run));
      }
      run = '';
    };
    for (const ch of text) {
      const classes = [];
      if (highlightKanji && KANJI.test(ch)) classes.push('hl-kanji');
      if (marked[offset]) classes.push('hl-target');
      const cls = classes.join(' ');
      if (cls !== runClass) {
        flush();
        runClass = cls;
      }
      run += ch;
      offset += ch.length;
    }
    flush();
  };

  const walk = (from, to, inReading) => {
    from.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        emitText(node.textContent, to, inReading);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (DROP.has(node.tagName)) return;
        if (ALLOWED.has(node.tagName)) {
          const el = document.createElement(node.tagName.toLowerCase());
          walk(node, el, inReading || node.tagName === 'RT' || node.tagName === 'RP');
          to.appendChild(el);
        } else {
          walk(node, to, inReading);
        }
      }
    });
  };

  walk(doc.body, out, false);
  return out.innerHTML;
}