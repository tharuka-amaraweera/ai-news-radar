# AI News Radar

A daily brief of AI and software engineering news. Every morning an AI agent reads a fixed
list of sources, picks the 8 to 10 stories that matter most, and publishes them to a small
website. When the new brief is live, you get a WhatsApp message with a link.

**Site:** <https://tharuka-amaraweera.github.io/ai-news-radar/>

## Contents

- [Reading the brief](#reading-the-brief)
- [How it works](#how-it-works)
- [Set it up](#set-it-up)
- [Day to day](#day-to-day)
- [Make it yours](#make-it-yours)
- [When something goes wrong](#when-something-goes-wrong)
- [Run it on your computer](#run-it-on-your-computer)
- [Costs and limits](#costs-and-limits)

## Reading the brief

Open the site in any browser, on a phone or a laptop. It needs no login and no app.

- **Stories** are listed from most to least important. Each one has a headline, a short
  summary, a topic, and a link to the original source.
- **Topic buttons** (Models, Dev tools, Research, Software, Industry) filter the day's
  stories.
- **Older / Newer** and the day picker let you go back to earlier briefs.
- **The WhatsApp link** opens the brief for that specific day.

To put it on your phone's home screen like an app:

- **iPhone (Safari):** tap Share, then "Add to Home Screen".
- **Android (Chrome):** tap the menu, then "Add to Home screen".

The summaries are written by an AI agent from the linked sources. Open the source before
you rely on a detail.

## How it works

```
1. Scheduled Claude Code agent      runs once a day in Anthropic's cloud
   - collects candidate stories from the sources
   - picks 8 to 10 and writes a summary for each
   - saves them as public/news/<date>.json and pushes to main
                |
2. GitHub Actions                   starts automatically on that push
   - runs the tests and checks the news file
   - builds the site and deploys it to GitHub Pages
   - sends the WhatsApp message
                |
3. You                              tap the link and read
```

There is no server and no database. The "database" is one small JSON file per day, stored
in this repository, and the site is static files served by GitHub Pages.

Three design choices keep it reliable:

- **The agent only writes data.** It adds files under `public/news/` and never touches the
  site's code.
- **Bad data never reaches the site.** The workflow checks the news file before deploying.
  If the check fails, the deploy stops and the site keeps showing the last good brief.
- **You are only messaged for new briefs.** The WhatsApp step runs for the agent's commits
  (their message starts with `news:`), not when you change code.

| Part | Where it lives |
|---|---|
| The website | [src/](src/) |
| The daily news files | [public/news/](public/news/) |
| The agent's instructions | [agent/INSTRUCTIONS.md](agent/INSTRUCTIONS.md) |
| The list of sources | [agent/sources.json](agent/sources.json) |
| Fetching, checking and messaging scripts | [scripts/](scripts/) |
| Build, deploy and message workflow | [.github/workflows/deploy.yml](.github/workflows/deploy.yml) |

## Set it up

You do each of these once.

### 1. Turn on GitHub Pages

In the repository on GitHub: **Settings → Pages → Source → GitHub Actions**.

Then open the **Actions** tab. If the first run failed because Pages was not on yet, open
it and choose **Re-run all jobs**. When it finishes, the site is live at the address at
the top of this page.

### 2. Connect WhatsApp

Messages are sent through [CallMeBot](https://www.callmebot.com/blog/free-api-whatsapp-messages/),
a free service for personal use.

1. Follow the steps on the CallMeBot page: you message their number from your phone, and
   it replies with an API key.
2. In the repository: **Settings → Secrets and variables → Actions → New repository secret**.
   Add two secrets:

   | Name | Value |
   |---|---|
   | `CALLMEBOT_PHONE` | Your number with country code, for example `+491701234567` |
   | `CALLMEBOT_APIKEY` | The key CallMeBot sent you |

3. Test it: **Actions → Deploy site and notify → Run workflow**, tick **notify**, and run.
   You should get a message within a minute or two.

If you skip this step the site still updates every day. The message step notices the
secrets are missing and does nothing.

### 3. Schedule the daily agent

Create a scheduled task in Claude Code (it needs a paid Claude plan):

- **Repository:** this one
- **Schedule:** daily, at the time you want the brief
- **Prompt:** `Read agent/INSTRUCTIONS.md and follow it exactly.`
- **Network access:** the task's cloud environment must be able to reach the news sources.
  Either set network access to Full, or add the domains from
  [agent/sources.json](agent/sources.json) to its allowed domains.

Run it once by hand to confirm that it can reach the sources and push to `main`.

## Day to day

Nothing to do. Each morning the agent publishes, the site updates, and your phone gets the
message. If the agent finds that today's brief already exists, it stops without changing
anything, so running it twice is safe.

You can watch or manage the schedule at <https://claude.ai/code/routines>, and see every
deploy in the repository's **Actions** tab.

## Make it yours

| To change | Edit |
|---|---|
| Which sites are read | [agent/sources.json](agent/sources.json). Add any RSS or Atom feed with `"type": "rss"`. |
| What gets picked, how many stories, the writing style | [agent/INSTRUCTIONS.md](agent/INSTRUCTIONS.md) |
| The timezone used for "today" | Step 1 of [agent/INSTRUCTIONS.md](agent/INSTRUCTIONS.md) |
| The topic names and the length limits | `TAGS` and `LIMITS` in [scripts/lib/news.mjs](scripts/lib/news.mjs). New topics also need a colour in [src/styles.css](src/styles.css). |
| The wording of the WhatsApp message | `buildMessage` in [scripts/notify.mjs](scripts/notify.mjs) |
| How the site looks | [src/styles.css](src/styles.css) and [src/App.jsx](src/App.jsx) |

Commit and push your change. The site redeploys, and the agent uses the new instructions
on its next run.

## When something goes wrong

| What you see | Where to look |
|---|---|
| No new brief today | <https://claude.ai/code/routines>: did the run happen, and what did it report? Scheduled runs pause when your Claude usage is used up. |
| The agent reports that sources failed | Its cloud environment cannot reach those sites. Add the domains to the environment's allowed domains. |
| The agent reports that the push was refused | The repository is blocking direct pushes to `main`. Check the branch protection rules. |
| The brief was pushed but the site did not change | **Actions** tab. A failed "Check the news data" step lists exactly what is wrong with the file. |
| The site updated but no WhatsApp message came | **Actions** tab, "notify" job. Check the two secrets, and that your CallMeBot key is still active. |
| The site shows an old brief | Reload the page. GitHub Pages can take a few minutes to show a new deploy. |

## Run it on your computer

You need Node.js 22 or newer.

```
npm install
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Run the site locally |
| `npm test` | Run the unit tests |
| `npm run fetch -- --out candidates.json` | Collect candidate stories from every source |
| `npm run index` | Rebuild `public/news/index.json` from the day files |
| `npm run validate` | Check every file in `public/news/` |
| `npm run build` | Build the site into `dist/` |

## Costs and limits

- **GitHub Pages and Actions** are free for a public repository. Public also means anyone
  with the link can read the site.
- **The scheduled agent** uses your Claude plan's usage. It runs once a day.
- **CallMeBot** is free for personal use. It is an unofficial shared service: your phone
  number and the short message text pass through it, and delivery is not guaranteed.
- **Sources** are limited to sites that publish a feed, so a story that appears nowhere in
  [agent/sources.json](agent/sources.json) will not show up.
