# AI News Radar

A short daily brief of AI and software engineering news, published as a small website
with a WhatsApp message when each day's brief goes live.

## How it works

```
Scheduled Claude Code agent (daily, 07:00 Europe/Berlin)
  fetch sources -> pick 8 to 10 stories -> write public/news/<date>.json -> push to main
        |
GitHub Actions (.github/workflows/deploy.yml)
  test -> validate news data -> build -> deploy to GitHub Pages -> send WhatsApp message
```

- The agent follows [agent/INSTRUCTIONS.md](agent/INSTRUCTIONS.md) and only ever writes
  JSON into `public/news/`.
- The workflow refuses to deploy if the news data is invalid, so a bad run leaves
  yesterday's site in place.
- The WhatsApp message is sent only for commits whose message starts with `news:`.

## One-time setup

1. **GitHub Pages:** in the repository, open Settings, then Pages, and set Source to
   "GitHub Actions".
2. **WhatsApp (CallMeBot, free for personal use):**
   - Follow the current steps on <https://www.callmebot.com/blog/free-api-whatsapp-messages/>
     to message the CallMeBot number from your phone. It replies with an API key.
   - In the repository, open Settings, then Secrets and variables, then Actions, and add:
     - `CALLMEBOT_PHONE`: your number with country code, for example `+491701234567`
     - `CALLMEBOT_APIKEY`: the key CallMeBot sent you
   - Without these secrets the site still deploys; the message step just skips itself.
3. **Scheduled agent:** create a daily scheduled task in Claude Code for this repository
   with the prompt "Read agent/INSTRUCTIONS.md and follow it exactly." Its cloud
   environment needs network access to the domains in
   [agent/sources.json](agent/sources.json).

To test the message without waiting for the daily run: Actions, "Deploy site and notify",
Run workflow, tick "notify".

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Run the site locally |
| `npm test` | Run the unit tests |
| `npm run fetch -- --out candidates.json` | Collect candidate stories from every source |
| `npm run index` | Rebuild `public/news/index.json` from the day files |
| `npm run validate` | Check every file in `public/news/` |

## Changing what you get

- **Sources:** edit [agent/sources.json](agent/sources.json). `type` is `rss` for any RSS
  or Atom feed.
- **Selection and tone:** edit [agent/INSTRUCTIONS.md](agent/INSTRUCTIONS.md).
- **Topics and limits:** `TAGS` and `LIMITS` in [scripts/lib/news.mjs](scripts/lib/news.mjs).
