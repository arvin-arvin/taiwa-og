const ALLOWED = new Set(['RUBY', 'RT', 'RP', 'RB']);
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE']);

/** Keeps only furigana tags and text; everything else is removed */
export function sanitizeFurigana(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  const out = document.createElement('div');

  const walk = (from, to) => {
    from.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        to.appendChild(document.createTextNode(node.textContent));
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (DROP.has(node.tagName)) return;
        if (ALLOWED.has(node.tagName)) {
          const el = document.createElement(node.tagName.toLowerCase());
          walk(node, el);
          to.appendChild(el);
        } else {
          walk(node, to);
        }
      }
    });
  };

  walk(doc.body, out);
  return out.innerHTML;
}