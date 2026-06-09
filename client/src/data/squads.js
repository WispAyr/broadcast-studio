// Squad data for SideLiner's FanZone — Scotland v Haiti (FIFA World Cup 26, Group C).
// Used by MatchStatsModule (screen) + SquadsPanel (control) + the player/goal overlays.
// Accurate to ~8 June 2026 (Wikipedia squad tables). Photos = freely-licensed
// Wikimedia Commons portraits, hosted in the FanZone studio Media; null → the
// card shows a branded number/initials avatar.

const PHOTO_BASE = '/uploads/4c086bc8-fb67-4943-a2f2-1b5a72164578/players';
const HAVE = new Set([
  'aaron-hickey','andy-robertson','angus-gunn','anthony-ralston','ben-doak','carlens-arcus','che-adams',
  'craig-gordon','danley-jean-jacques','findlay-curtis','george-hirst','grant-hanley','hannes-delcroix',
  'jack-hendry','jean-kevin-duverne','jean-ricner-bellegarde','john-mcginn','john-souttar','johny-placide',
  'kenny-mclean','kieran-tierney','lawrence-shankland','lyndon-dykes','nathan-patterson','ryan-christie',
  'scott-mctominay','wilson-isidor',
]);
const P = (slug) => (HAVE.has(slug) ? `${PHOTO_BASE}/${slug}.jpg` : null);

export const TEAMS = {
  SCO: { name: 'Scotland', code: 'SCO', nick: 'Scotland', primary: '#0a2a66', accent: '#0065bf', flag: 'saltire' },
  HAI: { name: 'Haiti', code: 'HAI', nick: 'Les Grenadiers', primary: '#101a5c', accent: '#d21034', flag: 'haiti' },
};

export const SCOTLAND = [
  { team: 'SCO', name: 'Angus Gunn', number: 1, pos: 'GK', club: 'Nottingham Forest', caps: 22, intlGoals: 0, age: 30, role: '', photo: P('angus-gunn') },
  { team: 'SCO', name: 'Craig Gordon', number: 21, pos: 'GK', club: 'Hearts', caps: 84, intlGoals: 0, age: 43, role: '', photo: P('craig-gordon') },
  { team: 'SCO', name: 'Liam Kelly', number: 12, pos: 'GK', club: 'Rangers', caps: 3, intlGoals: 0, age: 30, role: '', photo: null },
  { team: 'SCO', name: 'Andy Robertson', number: 3, pos: 'DF', club: 'Liverpool', caps: 94, intlGoals: 4, age: 32, role: 'Captain', photo: P('andy-robertson') },
  { team: 'SCO', name: 'Kieran Tierney', number: 6, pos: 'DF', club: 'Celtic', caps: 56, intlGoals: 2, age: 29, role: 'Key man', photo: P('kieran-tierney') },
  { team: 'SCO', name: 'Aaron Hickey', number: 2, pos: 'DF', club: 'Brentford', caps: 21, intlGoals: 0, age: 24, role: '', photo: P('aaron-hickey') },
  { team: 'SCO', name: 'Grant Hanley', number: 5, pos: 'DF', club: 'Hibernian', caps: 68, intlGoals: 2, age: 34, role: '', photo: P('grant-hanley') },
  { team: 'SCO', name: 'Jack Hendry', number: 13, pos: 'DF', club: 'Al-Ettifaq', caps: 38, intlGoals: 3, age: 31, role: '', photo: P('jack-hendry') },
  { team: 'SCO', name: 'John Souttar', number: 15, pos: 'DF', club: 'Rangers', caps: 24, intlGoals: 2, age: 29, role: '', photo: P('john-souttar') },
  { team: 'SCO', name: 'Dominic Hyam', number: 16, pos: 'DF', club: 'Wrexham', caps: 4, intlGoals: 0, age: 30, role: '', photo: null },
  { team: 'SCO', name: 'Nathan Patterson', number: 22, pos: 'DF', club: 'Everton', caps: 26, intlGoals: 1, age: 24, role: '', photo: P('nathan-patterson') },
  { team: 'SCO', name: 'Anthony Ralston', number: 24, pos: 'DF', club: 'Celtic', caps: 27, intlGoals: 1, age: 27, role: '', photo: P('anthony-ralston') },
  { team: 'SCO', name: 'Scott McKenna', number: 26, pos: 'DF', club: 'Dinamo Zagreb', caps: 50, intlGoals: 1, age: 29, role: '', photo: null },
  { team: 'SCO', name: 'Scott McTominay', number: 4, pos: 'MF', club: 'Napoli', caps: 70, intlGoals: 15, age: 29, role: 'Key man', photo: P('scott-mctominay') },
  { team: 'SCO', name: 'John McGinn', number: 7, pos: 'MF', club: 'Aston Villa', caps: 86, intlGoals: 20, age: 31, role: 'Top scorer', photo: P('john-mcginn') },
  { team: 'SCO', name: 'Ryan Christie', number: 11, pos: 'MF', club: 'Bournemouth', caps: 68, intlGoals: 10, age: 31, role: '', photo: P('ryan-christie') },
  { team: 'SCO', name: 'Ben Doak', number: 17, pos: 'MF', club: 'Bournemouth', caps: 14, intlGoals: 1, age: 20, role: 'Key man', photo: P('ben-doak') },
  { team: 'SCO', name: 'Kenny McLean', number: 23, pos: 'MF', club: 'Norwich City', caps: 58, intlGoals: 3, age: 34, role: '', photo: P('kenny-mclean') },
  { team: 'SCO', name: 'Lewis Ferguson', number: 19, pos: 'MF', club: 'Bologna', caps: 24, intlGoals: 1, age: 26, role: '', photo: null },
  { team: 'SCO', name: 'Findlay Curtis', number: 25, pos: 'MF', club: 'Kilmarnock', caps: 3, intlGoals: 1, age: 20, role: '', photo: P('findlay-curtis') },
  { team: 'SCO', name: 'Tyler Fletcher', number: 8, pos: 'MF', club: 'Manchester United', caps: 2, intlGoals: 0, age: 19, role: '', photo: null },
  { team: 'SCO', name: 'Che Adams', number: 10, pos: 'FW', club: 'Torino', caps: 47, intlGoals: 13, age: 29, role: '', photo: P('che-adams') },
  { team: 'SCO', name: 'Lyndon Dykes', number: 9, pos: 'FW', club: 'Charlton Athletic', caps: 51, intlGoals: 10, age: 30, role: '', photo: P('lyndon-dykes') },
  { team: 'SCO', name: 'Lawrence Shankland', number: 20, pos: 'FW', club: 'Hearts', caps: 20, intlGoals: 7, age: 30, role: '', photo: P('lawrence-shankland') },
  { team: 'SCO', name: 'George Hirst', number: 18, pos: 'FW', club: 'Ipswich Town', caps: 10, intlGoals: 1, age: 27, role: '', photo: P('george-hirst') },
  { team: 'SCO', name: 'Ross Stewart', number: 14, pos: 'FW', club: 'Southampton', caps: 3, intlGoals: 0, age: 29, role: '', photo: null },
];

export const HAITI = [
  { team: 'HAI', name: 'Johny Placide', number: 1, pos: 'GK', club: 'Bastia', caps: 81, intlGoals: 0, age: 38, role: 'Captain', photo: P('johny-placide') },
  { team: 'HAI', name: 'Alexandre Pierre', number: 12, pos: 'GK', club: 'Sochaux', caps: 15, intlGoals: 0, age: 25, role: '', photo: null },
  { team: 'HAI', name: 'Josue Duverger', number: 23, pos: 'GK', club: 'Cosmos Koblenz', caps: 6, intlGoals: 0, age: 26, role: '', photo: null },
  { team: 'HAI', name: 'Carlens Arcus', number: 2, pos: 'DF', club: 'Angers', caps: 53, intlGoals: 1, age: 29, role: '', photo: P('carlens-arcus') },
  { team: 'HAI', name: 'Ricardo Adé', number: 4, pos: 'DF', club: 'LDU Quito', caps: 59, intlGoals: 2, age: 36, role: '', photo: null },
  { team: 'HAI', name: 'Hannes Delcroix', number: 5, pos: 'DF', club: 'Lugano', caps: 7, intlGoals: 0, age: 27, role: '', photo: P('hannes-delcroix') },
  { team: 'HAI', name: 'Jean-Kévin Duverne', number: 22, pos: 'DF', club: 'Gent', caps: 17, intlGoals: 1, age: 28, role: '', photo: P('jean-kevin-duverne') },
  { team: 'HAI', name: 'Keeto Thermoncy', number: 3, pos: 'DF', club: 'Young Boys', caps: 1, intlGoals: 0, age: 20, role: '', photo: null },
  { team: 'HAI', name: 'Martin Experience', number: 8, pos: 'DF', club: 'Nancy', caps: 21, intlGoals: 0, age: 27, role: '', photo: null },
  { team: 'HAI', name: 'Duke Lacroix', number: 13, pos: 'DF', club: 'Colorado Springs', caps: 16, intlGoals: 3, age: 32, role: '', photo: null },
  { team: 'HAI', name: 'Wilguens Paugain', number: 24, pos: 'DF', club: 'Zulte Waregem', caps: 8, intlGoals: 0, age: 24, role: '', photo: null },
  { team: 'HAI', name: 'Jean-Ricner Bellegarde', number: 10, pos: 'MF', club: 'Wolves', caps: 10, intlGoals: 0, age: 27, role: 'Key man', photo: P('jean-ricner-bellegarde') },
  { team: 'HAI', name: 'Danley Jean Jacques', number: 17, pos: 'MF', club: 'Philadelphia Union', caps: 30, intlGoals: 6, age: 26, role: 'Key man', photo: P('danley-jean-jacques') },
  { team: 'HAI', name: 'Carl Sainte', number: 6, pos: 'MF', club: 'El Paso Locomotive', caps: 26, intlGoals: 0, age: 23, role: '', photo: null },
  { team: 'HAI', name: 'Leverton Pierre', number: 14, pos: 'MF', club: 'Vizela', caps: 33, intlGoals: 0, age: 28, role: '', photo: null },
  { team: 'HAI', name: 'Dominique Simon', number: 25, pos: 'MF', club: 'Tatran Prešov', caps: 2, intlGoals: 0, age: 25, role: '', photo: null },
  { team: 'HAI', name: 'Woodensky Pierre', number: 26, pos: 'MF', club: 'Violette', caps: 1, intlGoals: 0, age: 21, role: 'Only home-based player', photo: null },
  { team: 'HAI', name: 'Duckens Nazon', number: 9, pos: 'FW', club: 'Esteghlal', caps: 78, intlGoals: 44, age: 32, role: 'Top scorer', photo: null },
  { team: 'HAI', name: 'Frantzdy Pierrot', number: 20, pos: 'FW', club: 'Çaykur Rizespor', caps: 51, intlGoals: 34, age: 31, role: 'Key man', photo: null },
  { team: 'HAI', name: 'Wilson Isidor', number: 18, pos: 'FW', club: 'Sunderland', caps: 4, intlGoals: 2, age: 25, role: 'Key man', photo: P('wilson-isidor') },
  { team: 'HAI', name: 'Derrick Etienne Jr.', number: 7, pos: 'FW', club: 'Toronto FC', caps: 48, intlGoals: 8, age: 29, role: '', photo: null },
  { team: 'HAI', name: 'Louicius Deedson', number: 11, pos: 'FW', club: 'FC Dallas', caps: 32, intlGoals: 10, age: 25, role: '', photo: null },
  { team: 'HAI', name: 'Ruben Providence', number: 15, pos: 'FW', club: 'Almere City', caps: 15, intlGoals: 3, age: 24, role: '', photo: null },
  { team: 'HAI', name: 'Lenny Joseph', number: 16, pos: 'FW', club: 'Ferencváros', caps: 2, intlGoals: 1, age: 25, role: '', photo: null },
  { team: 'HAI', name: 'Yassin Fortune', number: 19, pos: 'FW', club: 'Vizela', caps: 4, intlGoals: 0, age: 24, role: '', photo: null },
  { team: 'HAI', name: 'Josue Casimir', number: 21, pos: 'FW', club: 'Auxerre', caps: 7, intlGoals: 0, age: 23, role: '', photo: null },
];

export const ALL_PLAYERS = [...SCOTLAND, ...HAITI];
export function squad(team) { return team === 'HAI' ? HAITI : SCOTLAND; }
