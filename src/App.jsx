import { useEffect, useMemo, useState } from 'react';

const NEWS_URL = `${import.meta.env.BASE_URL}news/`;
const ALL = 'All';

// The daily agent replaces these files, so always ask the server for the current copy.
async function loadJson(name) {
  const response = await fetch(`${NEWS_URL}${name}?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load ${name} (HTTP ${response.status}).`);
  return response.json();
}

function dateInHash() {
  return window.location.hash.slice(1);
}

function longDate(date) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function shortDate(date) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function Story({ item, number }) {
  return (
    <article className="story">
      <div className="story-meta">
        <span className="story-number">{String(number).padStart(2, '0')}</span>
        <span className="tag" data-tag={item.tag}>
          {item.tag}
        </span>
      </div>
      <h2>
        <a href={item.url} target="_blank" rel="noopener noreferrer">
          {item.headline}
        </a>
      </h2>
      <p>{item.summary}</p>
      <a className="source" href={item.url} target="_blank" rel="noopener noreferrer">
        {item.source}
        <span className="source-host"> · {hostOf(item.url)}</span>
        <span aria-hidden="true"> ↗</span>
      </a>
    </article>
  );
}

export default function App() {
  const [dates, setDates] = useState(null);
  const [date, setDate] = useState('');
  const [day, setDay] = useState(null);
  const [tag, setTag] = useState(ALL);
  const [error, setError] = useState('');

  useEffect(() => {
    loadJson('index.json')
      .then((index) => {
        const available = index.dates ?? [];
        setDates(available);
        setDate(available.includes(dateInHash()) ? dateInHash() : available[0] ?? '');
      })
      .catch((problem) => setError(problem.message));
  }, []);

  useEffect(() => {
    if (!dates) return undefined;
    const onHashChange = () => {
      if (dates.includes(dateInHash())) setDate(dateInHash());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [dates]);

  useEffect(() => {
    if (!date) return undefined;
    let current = true;
    setDay(null);
    setTag(ALL);
    setError('');
    loadJson(`${date}.json`)
      .then((loaded) => current && setDay(loaded))
      .catch((problem) => current && setError(problem.message));
    return () => {
      current = false;
    };
  }, [date]);

  const tags = useMemo(() => {
    const counts = new Map();
    for (const item of day?.items ?? []) counts.set(item.tag, (counts.get(item.tag) ?? 0) + 1);
    return [...counts.entries()];
  }, [day]);

  function show(nextDate) {
    window.history.replaceState(null, '', `#${nextDate}`);
    setDate(nextDate);
    window.scrollTo({ top: 0 });
  }

  const position = dates ? dates.indexOf(date) : -1;
  const older = position >= 0 ? dates[position + 1] : undefined;
  const newer = position > 0 ? dates[position - 1] : undefined;
  const stories = (day?.items ?? []).filter((item) => tag === ALL || item.tag === tag);

  return (
    <div className="page">
      <header className="masthead">
        <div className="brand">
          <span className="pulse" aria-hidden="true" />
          <h1>AI News Radar</h1>
        </div>
        <p className="tagline">The AI and software news worth your time, once a day.</p>
      </header>

      {dates && dates.length > 0 && (
        <nav className="days" aria-label="Choose a day">
          <button type="button" onClick={() => show(older)} disabled={!older}>
            <span aria-hidden="true">←</span> Older
          </button>
          <select name="day" value={date} onChange={(event) => show(event.target.value)} aria-label="Day">
            {dates.map((option, index) => (
              <option key={option} value={option}>
                {index === 0 ? `Latest · ${shortDate(option)}` : shortDate(option)}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => show(newer)} disabled={!newer}>
            Newer <span aria-hidden="true">→</span>
          </button>
        </nav>
      )}

      <main>
        {error && (
          <p className="notice" role="alert">
            {error} Check your connection and reload.
          </p>
        )}
        {!error && dates && dates.length === 0 && (
          <p className="notice">No briefs yet. The first one appears after the next daily run.</p>
        )}
        {!error && (!dates || (date && !day)) && <p className="notice">Loading…</p>}

        {day && (
          <>
            <div className="day-head">
              <h2 className="day-title">{longDate(day.date)}</h2>
              <p className="day-count">
                {day.items.length} {day.items.length === 1 ? 'story' : 'stories'}
              </p>
            </div>

            {tags.length > 1 && (
              <div className="filters" role="group" aria-label="Filter by topic">
                <button type="button" aria-pressed={tag === ALL} onClick={() => setTag(ALL)}>
                  All <span className="count">{day.items.length}</span>
                </button>
                {tags.map(([name, count]) => (
                  <button key={name} type="button" aria-pressed={tag === name} onClick={() => setTag(name)}>
                    {name} <span className="count">{count}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="stories">
              {stories.map((item) => (
                <Story key={item.url} item={item} number={day.items.indexOf(item) + 1} />
              ))}
            </div>
          </>
        )}
      </main>

      <footer className="footer">
        Summaries are written by an AI agent from the linked sources. Open the source before you rely on a detail.
      </footer>
    </div>
  );
}
