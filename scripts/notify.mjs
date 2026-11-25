// Sends the "today's brief is live" WhatsApp message through CallMeBot.
// Runs in GitHub Actions after the site deploys. Reads three environment variables:
// CALLMEBOT_PHONE, CALLMEBOT_APIKEY (repository secrets) and PAGE_URL.
import { pathToFileURL } from 'node:url';
import { listDates, readDay } from './lib/news.mjs';

export function buildMessage(day, pageUrl) {
  const [year, month, dayOfMonth] = day.date.split('-').map(Number);
  const label = new Date(Date.UTC(year, month - 1, dayOfMonth)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const count = day.items.length;
  const base = pageUrl.endsWith('/') ? pageUrl : `${pageUrl}/`;
  return [
    `AI News Radar, ${label}`,
    `${count} new ${count === 1 ? 'story' : 'stories'}. Top: ${day.items[0].headline}`,
    `${base}#${day.date}`,
  ].join('\n');
}

async function main() {
  const { CALLMEBOT_PHONE: phone, CALLMEBOT_APIKEY: apikey, PAGE_URL: pageUrl } = process.env;
  if (!phone || !apikey) {
    console.log('CALLMEBOT_PHONE or CALLMEBOT_APIKEY is not set, so no WhatsApp message was sent.');
    return;
  }
  if (!pageUrl) throw new Error('PAGE_URL is not set');

  const latest = listDates()[0];
  if (!latest) throw new Error('There is no news to announce');

  const query = new URLSearchParams({ phone, text: buildMessage(readDay(latest), pageUrl), apikey });
  const response = await fetch(`https://api.callmebot.com/whatsapp.php?${query}`, {
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await response.text()).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!response.ok) throw new Error(`CallMeBot answered HTTP ${response.status}: ${body.slice(0, 200)}`);
  console.log(`WhatsApp message for ${latest} handed to CallMeBot: ${body.slice(0, 200)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
