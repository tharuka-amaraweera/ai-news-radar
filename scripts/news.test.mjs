import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { normalizeUrl, parseFeed, toText } from './lib/feed.mjs';
import { validateAll, validateDay } from './lib/news.mjs';
import { buildMessage } from './notify.mjs';

const item = (overrides = {}) => ({
  headline: 'A new model ships',
  summary: 'A lab released a model today. It matters because it is cheaper to run than the last one.',
  url: 'https://example.com/a',
  source: 'Example',
  tag: 'Models',
  ...overrides,
});
const day = (date, items = [item()]) => ({ date, generatedAt: '2026-11-25T06:00:00Z', items });

function newsFolder(files) {
  const dir = mkdtempSync(join(tmpdir(), 'news-'));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), typeof content === 'string' ? content : JSON.stringify(content));
  }
  return dir;
}

test('toText reduces CDATA and escaped HTML to plain text', () => {
  assert.equal(toText('<![CDATA[<p>Hello <b>world</b> &amp; all</p>]]>'), 'Hello world & all');
  assert.equal(toText('&lt;p&gt;It&#8217;s here&lt;/p&gt;'), 'It’s here');
});

test('parseFeed reads RSS items', () => {
  const [story] = parseFeed(`<rss><channel><title>Feed</title>
    <atom:link href="https://example.com/feed" rel="self"/>
    <item><title>First &amp; best</title><link>https://example.com/1?utm_source=rss</link>
    <pubDate>Tue, 24 Nov 2026 10:00:00 GMT</pubDate>
    <description><![CDATA[<p>Body text</p>]]></description></item></channel></rss>`);
  assert.deepEqual(story, {
    title: 'First & best',
    url: 'https://example.com/1?utm_source=rss',
    published: '2026-11-24T10:00:00.000Z',
    snippet: 'Body text',
  });
});

test('parseFeed reads Atom entries and prefers the alternate link', () => {
  const [story] = parseFeed(`<feed><entry><title type="html">Release v2</title>
    <link rel="self" href="https://example.com/self"/>
    <link rel="alternate" type="text/html" href="https://example.com/v2?a=1&amp;b=2"/>
    <updated>2026-11-24T10:00:00Z</updated><content type="html">&lt;p&gt;Notes&lt;/p&gt;</content></entry></feed>`);
  assert.equal(story.url, 'https://example.com/v2?a=1&b=2');
  assert.equal(story.snippet, 'Notes');
});

test('parseFeed drops entries without a usable link', () => {
  assert.deepEqual(parseFeed('<rss><item><title>No link</title><link>javascript:alert(1)</link></item></rss>'), []);
});

test('normalizeUrl treats tracking variants as the same story', () => {
  assert.equal(normalizeUrl('https://www.example.com/a/?utm_source=x#top'), normalizeUrl('https://example.com/a'));
});

test('validateDay accepts a well formed day', () => {
  assert.deepEqual(validateDay(day('2026-11-25'), '2026-11-25'), []);
});

test('validateDay reports each kind of problem', () => {
  const errors = validateDay(
    day('2026-11-25', [
      item({ url: 'http://example.com/plain' }),
      item({ tag: 'Gossip', url: 'https://example.com/b' }),
      item({ summary: 'Too short', url: 'https://example.com/c' }),
      item({ url: 'https://example.com/b/' }),
    ]),
    '2026-11-26',
  ).join('\n');
  assert.match(errors, /"date" must be "2026-11-26"/);
  assert.match(errors, /item 1: "url" must be an https link/);
  assert.match(errors, /item 2: "tag" must be one of/);
  assert.match(errors, /item 3: "summary" must be/);
  assert.match(errors, /item 4: "url" repeats an earlier item/);
});

test('validateAll passes a consistent folder', () => {
  const dir = newsFolder({
    '2026-11-24.json': day('2026-11-24', [item({ url: 'https://example.com/old' })]),
    '2026-11-25.json': day('2026-11-25'),
    'index.json': { dates: ['2026-11-25', '2026-11-24'] },
  });
  assert.deepEqual(validateAll(dir), []);
});

test('validateAll catches a stale index, a repeat across days and broken JSON', () => {
  const dir = newsFolder({
    '2026-11-23.json': '{ not json',
    '2026-11-24.json': day('2026-11-24'),
    '2026-11-25.json': day('2026-11-25'),
    'index.json': { dates: ['2026-11-24'] },
  });
  const errors = validateAll(dir).join('\n');
  assert.match(errors, /2026-11-23\.json: not valid JSON/);
  assert.match(errors, /2026-11-25\.json: https:\/\/example\.com\/a was already published on 2026-11-24/);
  assert.match(errors, /index\.json: "dates" does not match/);
});

test('buildMessage gives the count, top headline and a link to the day', () => {
  assert.equal(
    buildMessage(day('2026-11-25', [item(), item({ url: 'https://example.com/b' })]), 'https://me.github.io/radar'),
    'AI News Radar, 25 Nov\n2 new stories. Top: A new model ships\nhttps://me.github.io/radar/#2026-11-25',
  );
});
