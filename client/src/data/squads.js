// Squad data for SideLiner's FanZone — Scotland v Haiti (FIFA World Cup 26, Group C).
// Used by MatchStatsModule (screen) + SquadsPanel (control) + the goalscorer overlay.
// `photo` is a /uploads/... path once the freely-licensed (Wikimedia Commons) photos
// are downloaded into the FanZone studio Media; null → the card shows a branded avatar.
// Enriched from research; numbers/caps approximate where noted.

export const TEAMS = {
  SCO: { name: 'Scotland', code: 'SCO', nick: 'Scotland', primary: '#0a2a66', accent: '#0065bf', flag: 'saltire' },
  HAI: { name: 'Haiti', code: 'HAI', nick: 'Les Grenadiers', primary: '#00209f', accent: '#d21034', flag: 'haiti' },
};

// photoBase: where studio-hosted player photos live (set per studio at runtime if needed).
export const SCOTLAND = [
  { team: 'SCO', name: 'Angus Gunn', number: 1, pos: 'GK', club: 'Nottingham Forest', caps: 19, intlGoals: 0, role: '', photo: null },
  { team: 'SCO', name: 'Craig Gordon', number: 21, pos: 'GK', club: 'Hearts', caps: 81, intlGoals: 0, role: '', photo: null },
  { team: 'SCO', name: 'Andy Robertson', number: 3, pos: 'DF', club: 'Liverpool', caps: 92, intlGoals: 3, role: 'Captain', photo: null },
  { team: 'SCO', name: 'Kieran Tierney', number: 6, pos: 'DF', club: 'Celtic', caps: 47, intlGoals: 1, role: '', photo: null },
  { team: 'SCO', name: 'Jack Hendry', number: 15, pos: 'DF', club: 'Al-Ettifaq', caps: 35, intlGoals: 2, role: '', photo: null },
  { team: 'SCO', name: 'John Souttar', number: 4, pos: 'DF', club: 'Rangers', caps: 18, intlGoals: 1, role: '', photo: null },
  { team: 'SCO', name: 'Scott McKenna', number: 5, pos: 'DF', club: 'Dinamo Zagreb', caps: 35, intlGoals: 2, role: '', photo: null },
  { team: 'SCO', name: 'Anthony Ralston', number: 2, pos: 'DF', club: 'Celtic', caps: 11, intlGoals: 0, role: '', photo: null },
  { team: 'SCO', name: 'Nathan Patterson', number: 12, pos: 'DF', club: 'Everton', caps: 22, intlGoals: 1, role: '', photo: null },
  { team: 'SCO', name: 'Scott McTominay', number: 8, pos: 'MF', club: 'Napoli', caps: 60, intlGoals: 13, role: 'Key man', photo: null },
  { team: 'SCO', name: 'Billy Gilmour', number: 18, pos: 'MF', club: 'Napoli', caps: 38, intlGoals: 0, role: '', photo: null },
  { team: 'SCO', name: 'John McGinn', number: 7, pos: 'MF', club: 'Aston Villa', caps: 85, intlGoals: 19, role: '', photo: null },
  { team: 'SCO', name: 'Ryan Christie', number: 10, pos: 'MF', club: 'Bournemouth', caps: 54, intlGoals: 5, role: '', photo: null },
  { team: 'SCO', name: 'Lewis Ferguson', number: 16, pos: 'MF', club: 'Bologna', caps: 12, intlGoals: 1, role: '', photo: null },
  { team: 'SCO', name: 'Kenny McLean', number: 14, pos: 'MF', club: 'Norwich City', caps: 35, intlGoals: 3, role: '', photo: null },
  { team: 'SCO', name: 'Ben Doak', number: 11, pos: 'FW', club: 'Bournemouth', caps: 8, intlGoals: 0, role: 'One to watch', photo: null },
  { team: 'SCO', name: 'Che Adams', number: 9, pos: 'FW', club: 'Torino', caps: 35, intlGoals: 8, role: '', photo: null },
  { team: 'SCO', name: 'Lawrence Shankland', number: 20, pos: 'FW', club: 'Hearts', caps: 14, intlGoals: 4, role: '', photo: null },
  { team: 'SCO', name: 'Lyndon Dykes', number: 22, pos: 'FW', club: 'Charlton', caps: 30, intlGoals: 8, role: '', photo: null },
  { team: 'SCO', name: 'George Hirst', number: 19, pos: 'FW', club: 'Ipswich Town', caps: 4, intlGoals: 0, role: '', photo: null },
];

export const HAITI = [
  { team: 'HAI', name: 'Johny Placide', number: 1, pos: 'GK', club: 'free agent', caps: 70, intlGoals: 0, role: 'Captain', photo: null },
  { team: 'HAI', name: 'Wilson Isidor', number: 9, pos: 'FW', club: 'Sunderland', caps: 6, intlGoals: 2, role: 'Key man', photo: null },
  { team: 'HAI', name: 'Jean-Ricner Bellegarde', number: 8, pos: 'MF', club: 'Wolves', caps: 12, intlGoals: 1, role: '', photo: null },
  { team: 'HAI', name: 'Frantzdy Pierrot', number: 11, pos: 'FW', club: 'Kayserispor', caps: 30, intlGoals: 12, role: 'Top scorer', photo: null },
  { team: 'HAI', name: 'Duckens Nazon', number: 10, pos: 'FW', club: 'free agent', caps: 50, intlGoals: 21, role: '', photo: null },
  { team: 'HAI', name: 'Danley Jean-Jacques', number: 6, pos: 'MF', club: 'Montpellier', caps: 20, intlGoals: 1, role: '', photo: null },
  { team: 'HAI', name: 'Carlens Arcus', number: 2, pos: 'DF', club: 'Auxerre', caps: 22, intlGoals: 0, role: '', photo: null },
  { team: 'HAI', name: 'Ricardo Adé', number: 4, pos: 'DF', club: 'Baniyas', caps: 25, intlGoals: 1, role: '', photo: null },
];

export const ALL_PLAYERS = [...SCOTLAND, ...HAITI];

export function squad(team) {
  return team === 'HAI' ? HAITI : SCOTLAND;
}
