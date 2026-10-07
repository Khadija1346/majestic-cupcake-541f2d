/** Town layout in tile units. One tile = 32 world pixels. */
export const T = 32
export const WORLD_W = 64
export const WORLD_H = 48

export type BuildingStyle = 'arena' | 'hall' | 'stalls' | 'bank' | 'gallery' | 'house' | 'hub' | 'community' | 'office'

export interface Building {
  id: string
  district: string | null
  name: string
  sub: string
  x: number
  y: number
  w: number
  h: number
  door: { x: number; y: number } // tile the player stands on to enter
  route: string
  style: BuildingStyle
  wall: string
  roof: string
  trim: string
}

export const BUILDINGS: Building[] = [
  { id: 'arena', district: 'arena', name: 'ARENA', sub: 'Leaderboards', x: 24, y: 2, w: 16, h: 8, door: { x: 31.5, y: 10.6 }, route: '/arena', style: 'arena', wall: '#c9773f', roof: '#a3322c', trim: '#f2b632' },
  { id: 'games', district: 'games', name: 'GAME DISTRICT', sub: 'GARRI SURVIVAL', x: 13, y: 15, w: 10, h: 6, door: { x: 18, y: 21.6 }, route: '/survival', style: 'hall', wall: '#2f3f9e', roof: '#1d1a4d', trim: '#f2b632' },
  { id: 'market', district: 'market', name: 'MARKET', sub: 'Oja · Stalls', x: 13, y: 27, w: 11, h: 5, door: { x: 18.5, y: 26.4 }, route: '/market', style: 'stalls', wall: '#d4552a', roof: '#f2b632', trim: '#1f8a5b' },
  { id: 'house', district: 'house', name: 'YOUR HOUSE', sub: 'Profile · Inventory', x: 1, y: 15, w: 6, h: 5, door: { x: 4, y: 20.6 }, route: '/citizen', style: 'house', wall: '#e8d2a6', roof: '#8b5a2b', trim: '#2f3f9e' },
  { id: 'citizenhub', district: 'citizenhub', name: 'CITIZEN HUB', sub: 'GARRI ID · Referrals', x: 37, y: 27, w: 9, h: 6, door: { x: 41.5, y: 26.4 }, route: '/hub', style: 'hub', wall: '#1f8a5b', roof: '#0f5136', trim: '#f7e3b0' },
  { id: 'community', district: 'community', name: 'COMMUNITY HUB', sub: 'Seasons · Events', x: 20, y: 39, w: 9, h: 6, door: { x: 24.5, y: 38.4 }, route: '/community', style: 'community', wall: '#a3322c', roof: '#5e1714', trim: '#f2b632' },
  { id: 'bank', district: 'bank', name: 'GARRI BANK', sub: 'Wallet · Rewards', x: 42, y: 15, w: 9, h: 6, door: { x: 46.5, y: 21.6 }, route: '/bank', style: 'bank', wall: '#f7e3b0', roof: '#2f3f9e', trim: '#f2b632' },
  { id: 'gallery', district: 'gallery', name: 'NFT GALLERY', sub: 'Citizen Collection', x: 57, y: 15, w: 6, h: 6, door: { x: 60, y: 21.6 }, route: '/gallery', style: 'gallery', wall: '#120f2e', roof: '#f2b632', trim: '#d4552a' },
  { id: 'mod', district: null, name: 'MOD OFFICE', sub: 'Moderators only', x: 43, y: 3, w: 6, h: 5, door: { x: 46, y: 8.6 }, route: '/mod', style: 'office', wall: '#5b5880', roof: '#2a2756', trim: '#f7e3b0' },
]

/** The Quest Board is a free-standing noticeboard on the plaza. */
export const QUEST_BOARD = { x: 25.5, y: 18, route: '/quests' }

export interface Rect { x: number; y: number; w: number; h: number }

export const ROADS: Rect[] = [
  { x: 2, y: 22, w: 60, h: 3 },
  { x: 30, y: 10, w: 3, h: 36 },
  { x: 8, y: 11, w: 48, h: 3 },
  { x: 8, y: 35, w: 48, h: 3 },
  { x: 8, y: 11, w: 3, h: 27 },
  { x: 53, y: 11, w: 3, h: 27 },
]

export const PLAZA = { cx: 31.5, cy: 23.5, r: 6 }
export const GARDENS: Rect = { x: 42, y: 39, w: 20, h: 8 }
export const POND = { cx: 54, cy: 43, rx: 3.2, ry: 1.8 }

export interface ZoneDef { district: string; rect?: Rect; circle?: { cx: number; cy: number; r: number } }
export const ZONES: ZoneDef[] = [
  { district: 'plaza', circle: { cx: PLAZA.cx, cy: PLAZA.cy, r: PLAZA.r } },
  { district: 'gardens', rect: GARDENS },
]

export interface NpcDef {
  id: string
  name: string
  role: string
  x: number
  y: number
  range: number
  outfit: string
  cap: 'fila' | 'gele' | 'none'
  lines: string[]
}

export const NPCS: NpcDef[] = [
  { id: 'elder', name: 'Baba Agba', role: 'Town Elder', x: 35, y: 20, range: 1.5, outfit: '#f7e3b0', cap: 'fila', lines: [
    'Welcome, my child. This town was built one cup of garri at a time.',
    'Go to the Quest Board by the plaza — the people of this town always need help.',
    'The Game District is where the young test their survival. Plant before you are hungry!',
  ] },
  { id: 'aisha', name: 'Aisha', role: 'Quest Keeper', x: 27, y: 19.5, range: 1.5, outfit: '#1f8a5b', cap: 'gele', lines: [
    'Daily quests refresh every morning. Weekly ones every Monday.',
    'Some community quests only pay out when the season closes. Patience is wealth.',
  ] },
  { id: 'tunde', name: 'Tunde', role: 'Arena Guard', x: 29, y: 12, range: 2, outfit: '#a3322c', cap: 'none', lines: [
    'The Arena boards show Daily, Weekly, Season and All-Time champions.',
    'Every score gets a Game ID. Fake scores no dey pass here.',
  ] },
  { id: 'nkechi', name: 'Mama Nkechi', role: 'Market Queen', x: 18, y: 33.5, range: 2, outfit: '#d4552a', cap: 'gele', lines: [
    'Garri price dey change every day o! Sell when the price is sweet.',
    'Market stalls open to Citizens for trading next season.',
  ] },
  { id: 'emeka', name: 'Emeka', role: 'Okada Rider', x: 44, y: 23.5, range: 6, outfit: '#f2b632', cap: 'none', lines: [
    'Ah! I don lose my okada key somewhere between the Bank road and the Gardens…',
    'If you see am, na you be my person!',
  ] },
  { id: 'zainab', name: 'Zainab', role: 'Gardener', x: 48, y: 42, range: 3, outfit: '#2f3f9e', cap: 'gele', lines: [
    'The Gardens are calm. People say something shines behind the pond at night.',
    'Explorers who find the town’s secrets earn rare rewards.',
  ] },
  { id: 'kola', name: 'Kola', role: 'Bank Teller', x: 49, y: 22.8, range: 1.5, outfit: '#120f2e', cap: 'fila', lines: [
    'The GARRI Bank never holds your keys. You connect your own wallet.',
    'Hold & Earn rules will be published before any programme goes live. No fake promises here.',
  ] },
]

export const SECRET_SPOTS: Record<string, { x: number; y: number }> = {
  calabash: { x: 3, y: 45 },
  cowrie: { x: 61.5, y: 2.5 },
  adire: { x: 22.5, y: 4 },
  okadakey: { x: 51, y: 31 },
  goldencup: { x: 58.5, y: 45.5 },
}

/** Spawn point when entering town fresh — south side of the plaza. */
export const SPAWN = { x: 31.5, y: 29 }

export function buildingByRoute(route: string) {
  return BUILDINGS.find((b) => b.route === route)
}
