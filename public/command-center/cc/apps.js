/* Big Booda's app roster — edit here to add/remove tiles. `local:true` = only reachable on the laptop.
   img: the app's own logo (cc/icons/). url: '' = link not set yet; tapping the tile asks for it once and remembers it on this device. */
window.BB_APPS = [
  { id: 'crm',     name: 'Chill Pros CRM', short: 'CRM',    url: 'https://chill-bros.vercel.app',            color: '#1fb6ff', glyph: 'snow', img: 'cc/icons/crm.webp' },
  { id: 'hq',      name: 'Chill Pros HQ',  short: 'HQ',     url: 'https://chill-pros-hq.vercel.app',         color: '#19ff9c', glyph: 'crown', img: 'cc/icons/hq.webp' },
  { id: 'bbb',     name: 'BBB Betting',    short: 'BBB',    url: 'https://bb-owner-command-center.vercel.app', color: '#a64dff', glyph: 'ball', img: 'cc/icons/bbb.webp' },
  { id: 'trading', name: 'Trading',        short: 'Trade',  url: '',                                         color: '#00e0a4', glyph: 'chart' },
  { id: 'alpha',   name: 'Alpha Hunter',   short: 'Crypto', url: 'https://alpha-hunter-ex8w.vercel.app',     color: '#ffb000', glyph: 'coin' },
  { id: 'credit',  name: 'Credit',         short: 'Credit', url: '',                                         color: '#4d8dff', glyph: 'card' },
  { id: 'forge',   name: 'BoodaForge',     short: 'Forge',  url: 'https://ui-forge-black.vercel.app',        color: '#ff3d7f', glyph: 'anvil' },
  { id: 'bidlume', name: 'Bidlume',        short: 'Bids',   url: 'https://bidlume.app',                      color: '#3dfcff', glyph: 'doc' },
  { id: 'invoice', name: 'Invoicing',      short: 'Pay',    url: 'https://chill-pros-invoicing.vercel.app',  color: '#2bd66b', glyph: 'dollar', img: 'cc/icons/invoice.webp' },
  { id: 'braei',   name: 'Brae.I.',        short: 'Brae.I', url: 'http://127.0.0.1:3000',                    color: '#ffe14d', glyph: 'smile', local: true },
  { id: 'studio',  name: 'AI Image Studio',short: 'Studio', url: 'http://127.0.0.1:8188',                    color: '#ff2bd6', glyph: 'spark', local: true }
];

/* Where the operations buttons go (inside the Chill Pros CRM). */
window.BB_ROUTES = {
  dispatch:    { app: 'crm', label: 'Dispatch',    blurb: 'Route calls, assign techs and watch the board.' },
  jobs:        { app: 'crm', label: 'Jobs',        blurb: 'Open work orders, quotes and job history.' },
  technicians: { app: 'crm', label: 'Technicians', blurb: 'Crew roster, clock-ins and readings.' },
  customers:   { app: 'crm', label: 'Customers',   blurb: 'Customer records, equipment and invoices.' },
  finances:    { app: 'hq',  label: 'Finances',    blurb: 'Dollar goals, invoices awaiting payment and money owed.' },
  analytics:   { app: 'hq',  label: 'Analytics',   blurb: 'Track record, profit dashboard and goals.' }
};

/* The big money tiles in the middle panel, in order, with the line under each name. */
window.BB_BIG = [
  { id: 'crm',     sub: 'Chill Pros money' },
  { id: 'bbb',     sub: 'Bet now · today\'s picks' },
  { id: 'trading', sub: 'Stocks & markets' },
  { id: 'alpha',   sub: 'Alpha Hunter crypto' },
  { id: 'credit',  sub: 'Credit & score' }
];
