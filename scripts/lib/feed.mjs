// Small RSS/Atom reader with no dependencies. Feed text is untrusted input:
// everything is reduced to plain text here and never executed or rendered as HTML.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] !== '#') return ENTITIES[entity.toLowerCase()] ?? match;
    const isHex = entity[1].toLowerCase() === 'x';
    const code = parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
    try {
      return String.fromCodePoint(code);
    } catch {
      return match;
    }
  });
}

/** Reduce a feed field (CDATA, escaped HTML or plain text) to one line of plain text. */
export function toText(raw = '') {
  const unwrapped = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  const stripped = decodeEntities(unwrapped).replace(/<[^>]*>/g, ' ');
  return decodeEntities(stripped).replace(/\s+/g, ' ').trim();
}

function inner(block, name) {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return match ? match[1] : '';
}

function linkOf(block) {
  const text = toText(inner(block, 'link'));
  if (/^https?:\/\//.test(text)) return text;
  const attrs = [...block.matchAll(/<link\b([^>]*)>/gi)].map((m) => m[1]);
  const pick =
    attrs.find((a) => /rel=["']alternate["']/.test(a)) ??
    attrs.find((a) => !/rel=/.test(a)) ??
    attrs[0];
  const href = pick?.match(/href=["']([^"']+)["']/)?.[1];
  return href ? decodeEntities(href) : '';
}

function dateOf(block) {
  for (const name of ['pubDate', 'published', 'updated', 'dc:date']) {
    const time = Date.parse(toText(inner(block, name)));
    if (!Number.isNaN(time)) return new Date(time).toISOString();
  }
  return null;
}

/** Parse an RSS or Atom document into [{ title, url, published, snippet }]. */
export function parseFeed(xml) {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? [];
  return blocks
    .map((block) => ({
      title: toText(inner(block, 'title')),
      url: linkOf(block),
      published: dateOf(block),
      snippet: toText(
        inner(block, 'description') ||
          inner(block, 'summary') ||
          inner(block, 'content:encoded') ||
          inner(block, 'content'),
      ),
    }))
    .filter((item) => item.title && /^https?:\/\//.test(item.url));
}

/** Canonical form of a URL, used to spot the same story across days and sources. */
export function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|ref$|source$)/i.test(key)) parsed.searchParams.delete(key);
    }
    parsed.hostname = parsed.hostname.replace(/^www\./, '');
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return url;
  }
}

export function truncate(text, max) {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}
