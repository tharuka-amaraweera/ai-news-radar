// Collects fresh candidate stories from every source in agent/sources.json.
// Usage: node scripts/fetch-sources.mjs [--out file] [--hours 48]
// Stories already published on the site are left out, so the agent only sees new ones.
import { readFileSync, writeFileSync } from 'node:fs';
import { normalizeUrl, parseFeed, truncate } from './lib/feed.mjs';
import { publishedUrls } from './lib/news.mjs';

const PER_SOURCE = 10;
const SNIPPET_LENGTH = 320;
const TIMEOUT_MS = 20_000;

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

async function download(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'news-reader/1.0', accept: '*/*' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

const readers = {
  rss: (body) => parseFeed(body),
  hn: (body) =>
    JSON.parse(body).hits.map((hit) => ({
      title: hit.title,
      url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
      published: hit.created_at,
      snippet: `${hit.points} points and ${hit.num_comments} comments on Hacker News.`,
    })),
  'hf-papers': (body) =>
    JSON.parse(body).map((entry) => ({
      title: entry.paper.title,
      url: `https://huggingface.co/papers/${entry.paper.id}`,
      published: entry.publishedAt,
      snippet: `${entry.paper.upvotes ?? 0} upvotes. ${entry.paper.summary ?? ''}`.replace(/\s+/g, ' '),
    })),
};

const hours = Number(option('hours', 48));
const cutoff = Date.now() - hours * 3_600_000;
const sources = JSON.parse(readFileSync(new URL('../agent/sources.json', import.meta.url), 'utf8'));
const alreadyPublished = publishedUrls();
const offered = new Set();

const results = await Promise.all(
  sources.map(async (source) => {
    try {
      const items = readers[source.type](await download(source.url));
      return { source, items };
    } catch (error) {
      return { source, error: error.message };
    }
  }),
);

const report = [];
const items = [];
for (const { source, items: found = [], error } of results) {
  const fresh = found
    .filter((item) => !item.published || Date.parse(item.published) >= cutoff)
    .filter((item) => {
      const key = normalizeUrl(item.url);
      if (alreadyPublished.has(key) || offered.has(key)) return false;
      offered.add(key);
      return true;
    })
    .slice(0, PER_SOURCE);
  report.push({ name: source.name, ok: !error, error, candidates: fresh.length });
  for (const item of fresh) {
    items.push({
      title: truncate(item.title, 200),
      url: item.url,
      source: source.name,
      published: item.published,
      snippet: truncate(item.snippet ?? '', SNIPPET_LENGTH),
    });
  }
}

const output = JSON.stringify(
  { fetchedAt: new Date().toISOString(), windowHours: hours, sources: report, items },
  null,
  2,
);
const outFile = option('out');
if (outFile) writeFileSync(outFile, output);
else console.log(output);

const working = report.filter((entry) => entry.ok).length;
console.error(`${items.length} candidates from ${working} of ${report.length} sources`);
for (const entry of report.filter((e) => !e.ok)) console.error(`  failed: ${entry.name} (${entry.error})`);
if (working < 3) {
  console.error('Fewer than 3 sources responded. Check network access before publishing.');
  process.exit(1);
}
