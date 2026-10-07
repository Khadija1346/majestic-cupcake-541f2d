/**
 * Static town content (events calendar, upcoming games, seasons). No player
 * data, balances, scores or rewards live here — those come from the server
 * ledger only.
 */
export const TOWN_EVENTS = [
  { id: 'founders', name: 'Founders’ Gathering', icon: '🥁', when: 'All of Season 1', desc: 'Every Citizen who completes the tutorial in Season 1 qualifies for the Genesis Citizen collectible.', status: 'Live' },
  { id: 'season-board', name: 'Season Arena', icon: '🏟️', when: 'Oct 1 – Dec 31', desc: 'The top 10 Citizens on the verified Season leaderboard when the season closes become eligible for the Town Champion collectible.', status: 'Live' },
  { id: 'harmattan', name: 'Harmattan Runs', icon: '🌪️', when: 'All season', desc: 'Harmattan-mode runs score 1.5× and count towards the Harmattan Survivor seasonal quest.', status: 'Live' },
  { id: 'harvest-week', name: 'Harvest Week', icon: '🌾', when: 'Date to be announced', desc: 'A community harvest event. Details are announced on GARRI’s X and Telegram before it starts.', status: 'Planned' },
]

export const FUTURE_GAMES = [
  { id: 'ayo', name: 'Ayo Olopon', icon: '🪨', desc: 'The classic seed-sowing strategy game, Citizen vs Citizen.' },
  { id: 'okada', name: 'Okada Rush', icon: '🏍️', desc: 'Weave through traffic delivering garri across town before the rain.' },
  { id: 'suya', name: 'Suya Stack', icon: '🍢', desc: 'A fast stacking game at the night market. How high can you go?' },
  { id: 'danfo', name: 'Danfo Driver', icon: '🚐', desc: 'Pick up passengers, shout the route, keep the conductor happy.' },
]

export const SEASONS = [
  { id: 's1', name: 'Season 1 · Harmattan Harvest', range: 'Oct 1 – Dec 31, 2026', status: 'LIVE' },
  { id: 's2', name: 'Season 2 · Rainmakers', range: 'Q1 2027', status: 'UPCOMING' },
  { id: 's3', name: 'Season 3 · Market Kings', range: 'Q2 2027', status: 'PLANNED' },
]
