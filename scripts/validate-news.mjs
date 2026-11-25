// Checks every file in public/news. The deploy stops if this fails,
// so a bad daily run can never break the live site.
import { listDates, validateAll } from './lib/news.mjs';

const errors = validateAll();
if (errors.length > 0) {
  console.error(`News data has ${errors.length} problem(s):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(`News data is valid (${listDates().length} day(s)).`);
