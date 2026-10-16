const INTERESTING = /chat|widget|tel:|mailto:|gubagoo|activengage|carnow|podium|kenect|contactatonce|fullpath|autoleadstar|impel|spincar|matador/i;

export function buildPageExcerpt(html: string, maxChars = 12_000): string {
  const links: string[] = [];
  for (const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) {
    const link = match[1];
    if (link && INTERESTING.test(link)) links.push(link);
  }
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `LINKS:\n${links.join('\n')}\nTEXT:\n${text}`.slice(0, maxChars);
}
