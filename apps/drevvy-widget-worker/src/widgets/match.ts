export function htmlHasSelector(html: string, selector: string): boolean {
  return selector
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .some((part) => matchSimple(html, part));
}

export function htmlHasAnySelector(html: string, selectors: string[]): boolean {
  return selectors.some((selector) => htmlHasSelector(html, selector));
}

function matchSimple(html: string, selector: string): boolean {
  const id = selector.match(/#([\w-]+)/);
  const className = selector.match(/\.([\w-]+)/);
  const attr = selector.match(/\[([\w:-]+)\s*([*^$~|]?=)\s*["']([^"']+)["']\s*i?\]/i);
  const tag = selector.match(/^([a-z][\w-]*)\b/i);
  if (!id && !className && !attr && !tag) return false;
  const tokens = html.match(/<[^>]+>/g) ?? [];
  return tokens.some((token) => {
    if (tag && !new RegExp(`^<${tag[1]}\\b`, 'i').test(token)) return false;
    if (id && !new RegExp(`\\bid\\s*=\\s*["']${id[1]}["']`, 'i').test(token)) return false;
    if (className) {
      const classes = token.match(/\bclass\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
      if (!classes.split(/\s+/).includes(className[1])) return false;
    }
    if (attr) {
      const name = attr[1] ?? '';
      const op = attr[2] ?? '=';
      const expected = (attr[3] ?? '').toLowerCase();
      const actual = (token.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] ?? '').toLowerCase();
      if (op === '*=' && !actual.includes(expected)) return false;
      if (op === '=' && actual !== expected) return false;
      if (op !== '*=' && op !== '=') return false;
    }
    return true;
  });
}
