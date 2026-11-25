// Rebuilds public/news/index.json from the day files that exist.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NEWS_DIR, listDates } from './lib/news.mjs';

const dates = listDates();
writeFileSync(join(NEWS_DIR, 'index.json'), `${JSON.stringify({ dates }, null, 2)}\n`);
console.log(`index.json lists ${dates.length} day(s); latest is ${dates[0] ?? 'none'}`);
