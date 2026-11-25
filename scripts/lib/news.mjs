// Shared rules for the news data that the daily agent writes and the site reads.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeUrl } from './feed.mjs';

export const NEWS_DIR = new URL('../../public/news/', import.meta.url).pathname;
export const TAGS = ['Models', 'Dev tools', 'Research', 'Software', 'Industry'];
export const LIMITS = { minItems: 1, maxItems: 12, headline: 140, summaryMin: 60, summaryMax: 600 };

const DAY_FILE = /^(\d{4}-\d{2}-\d{2})\.json$/;

/** Dates that have a day file, newest first. */
export function listDates(dir = NEWS_DIR) {
  return readdirSync(dir)
    .map((name) => name.match(DAY_FILE)?.[1])
    .filter(Boolean)
    .sort()
    .reverse();
}

export function readDay(date, dir = NEWS_DIR) {
  return JSON.parse(readFileSync(join(dir, `${date}.json`), 'utf8'));
}

/** Every URL already published, in canonical form. */
export function publishedUrls(dir = NEWS_DIR) {
  const urls = new Set();
  for (const date of listDates(dir)) {
    for (const item of readDay(date, dir).items ?? []) urls.add(normalizeUrl(item.url));
  }
  return urls;
}

function isText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Problems with one day's data, as readable strings. Empty means valid. */
export function validateDay(day, expectedDate) {
  const errors = [];
  if (day?.date !== expectedDate) errors.push(`"date" must be "${expectedDate}"`);
  if (Number.isNaN(Date.parse(day?.generatedAt))) errors.push('"generatedAt" must be an ISO timestamp');
  if (!Array.isArray(day?.items)) return [...errors, '"items" must be an array'];

  const { minItems, maxItems, headline, summaryMin, summaryMax } = LIMITS;
  if (day.items.length < minItems || day.items.length > maxItems) {
    errors.push(`must have ${minItems} to ${maxItems} items, found ${day.items.length}`);
  }

  const seen = new Set();
  day.items.forEach((item, index) => {
    const at = `item ${index + 1}`;
    if (!isText(item?.headline)) errors.push(`${at}: "headline" is missing`);
    else if (item.headline.length > headline) errors.push(`${at}: "headline" is over ${headline} characters`);

    if (!isText(item?.summary)) errors.push(`${at}: "summary" is missing`);
    else if (item.summary.length < summaryMin || item.summary.length > summaryMax) {
      errors.push(`${at}: "summary" must be ${summaryMin} to ${summaryMax} characters`);
    }

    if (!isText(item?.source)) errors.push(`${at}: "source" is missing`);
    if (!TAGS.includes(item?.tag)) errors.push(`${at}: "tag" must be one of ${TAGS.join(', ')}`);

    if (!isText(item?.url) || !/^https:\/\/[^\s]+$/.test(item.url)) {
      errors.push(`${at}: "url" must be an https link`);
    } else {
      const key = normalizeUrl(item.url);
      if (seen.has(key)) errors.push(`${at}: "url" repeats an earlier item`);
      seen.add(key);
    }
  });
  return errors;
}

/** Problems across the whole news folder: every day file, the index, and repeats between days. */
export function validateAll(dir = NEWS_DIR) {
  const errors = [];
  const dates = listDates(dir);
  const firstSeen = new Map();

  for (const date of [...dates].reverse()) {
    let day;
    try {
      day = readDay(date, dir);
    } catch (error) {
      errors.push(`${date}.json: not valid JSON (${error.message})`);
      continue;
    }
    for (const problem of validateDay(day, date)) errors.push(`${date}.json: ${problem}`);
    for (const item of Array.isArray(day.items) ? day.items : []) {
      if (!isText(item?.url)) continue;
      const key = normalizeUrl(item.url);
      if (firstSeen.has(key) && firstSeen.get(key) !== date) {
        errors.push(`${date}.json: ${item.url} was already published on ${firstSeen.get(key)}`);
      } else {
        firstSeen.set(key, date);
      }
    }
  }

  try {
    const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
    if (JSON.stringify(index.dates) !== JSON.stringify(dates)) {
      errors.push('index.json: "dates" does not match the day files; run "npm run index"');
    }
  } catch (error) {
    errors.push(`index.json: missing or not valid JSON (${error.message})`);
  }
  return errors;
}
