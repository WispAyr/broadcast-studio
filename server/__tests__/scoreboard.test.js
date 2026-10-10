/**
 * Scoreboard renderer: react (built-in sl_score) vs rive (gfx_score overlay that
 * follows scoreboard_state without remounting).
 */
const Database = require('better-sqlite3');

const mockDb = new Database(':memory:');
jest.mock('../src/db', () => ({ db: mockDb }));

const mockSent = [];
jest.mock('../src/ws', () => ({
  getIO: () => ({ to: (room) => ({ emit: (event, payload) => mockSent.push({ room, event, payload }) }) }),
}));

const scoreboard = require('../src/scoreboard');
const S = 'studio-1';
const events = (name) => mockSent.filter((e) => e.event === name);
const overlays = () => mockSent.filter((e) => e.event === 'push_overlay' || e.event === 'remove_overlay')
  .map((e) => `${e.event}:${e.payload.overlay ? e.payload.overlay.type : e.payload.overlayType}`);

beforeEach(() => { mockSent.length = 0; mockDb.exec('DELETE FROM scoreboard'); });

describe('react renderer (default, unchanged behaviour)', () => {
  test('a goal pushes sl_score with the new score, and flags the goal', () => {
    scoreboard.apply(S, { home_name: 'kil', away_name: 'ayr' });
    mockSent.length = 0;
    scoreboard.adjust(S, 'home', 1);
    expect(overlays()).toEqual(['push_overlay:sl_score']);
    expect(events('push_overlay')[0].payload.overlay.score).toBe('1-0');
    expect(events('scoreboard_state')[0].payload).toMatchObject({ home_name: 'KIL', home_goals: 1, goal: 'home', visible: true });
    expect(mockSent.every((e) => e.room === `studio:${S}`)).toBe(true);
  });

  test('hide removes sl_score', () => {
    scoreboard.apply(S, { visible: 1 });
    mockSent.length = 0;
    scoreboard.apply(S, { visible: 0 });
    expect(overlays()).toEqual(['remove_overlay:sl_score']);
  });
});

describe('rive renderer', () => {
  beforeEach(() => { scoreboard.setRenderer(S, 'rive'); mockSent.length = 0; });

  test('show pushes gfx_score once, with the current state in the URL', () => {
    scoreboard.apply(S, { home_name: 'KIL', away_name: 'AYR', home_goals: 2, away_goals: 1, minute: "63'" });
    expect(overlays()).toEqual([]);
    scoreboard.apply(S, { visible: 1 });
    const push = events('push_overlay');
    expect(push).toHaveLength(1);
    expect(push[0].payload.overlay.type).toBe('gfx_score');
    const u = new URL(push[0].payload.overlay.url, 'http://x');
    expect(u.pathname).toBe('/player/sideliners/rive/overlay.html');
    expect(Object.fromEntries(u.searchParams)).toEqual({ home: 'KIL', away: 'AYR', hs: '2', as: '1', clock: "63'" });
  });

  test('goals and clock nudges while on air never re-push (no remount), only scoreboard_state', () => {
    scoreboard.apply(S, { visible: 1 });
    mockSent.length = 0;
    scoreboard.adjust(S, 'away', 1);
    scoreboard.adjustMinute(S, 1);
    scoreboard.adjust(S, 'away', -1);
    expect(overlays()).toEqual([]);
    expect(events('scoreboard_state').map((e) => e.payload.goal)).toEqual(['away', null, null]);
  });

  test('a goal from a data feed (plain apply) is flagged too', () => {
    scoreboard.apply(S, { visible: 1 });
    mockSent.length = 0;
    scoreboard.apply(S, { home_goals: 1 });
    expect(events('scoreboard_state')[0].payload.goal).toBe('home');
  });

  test('scoring while hidden brings the bug on with one push', () => {
    scoreboard.adjust(S, 'home', 1);
    expect(overlays()).toEqual(['push_overlay:gfx_score']);
  });

  test('hide removes gfx_score; hiding again is a no-op', () => {
    scoreboard.apply(S, { visible: 1 });
    mockSent.length = 0;
    scoreboard.apply(S, { visible: 0 });
    scoreboard.apply(S, { visible: 0 });
    expect(overlays()).toEqual(['remove_overlay:gfx_score']);
  });
});

describe('switching renderer mid-show', () => {
  test('react -> rive while on air swaps sl_score for gfx_score', () => {
    scoreboard.apply(S, { visible: 1 });
    mockSent.length = 0;
    scoreboard.setRenderer(S, 'rive');
    expect(overlays().sort()).toEqual(['push_overlay:gfx_score', 'remove_overlay:sl_score']);
  });

  test('rive -> react while on air swaps back', () => {
    scoreboard.setRenderer(S, 'rive');
    scoreboard.apply(S, { visible: 1 });
    mockSent.length = 0;
    scoreboard.setRenderer(S, 'react');
    expect(overlays().sort()).toEqual(['push_overlay:sl_score', 'remove_overlay:gfx_score']);
  });

  test('an unknown renderer is refused, and a junk one via apply falls back to react', () => {
    expect(() => scoreboard.setRenderer(S, 'flash')).toThrow();
    expect(scoreboard.apply(S, { renderer: 'flash' }).renderer).toBe('react');
  });
});

test('the renderer column is added to an existing pre-renderer table, keeping its rows', () => {
  mockDb.exec('DROP TABLE scoreboard');
  mockDb.exec(`CREATE TABLE scoreboard (studio_id TEXT PRIMARY KEY, home_name TEXT NOT NULL DEFAULT 'SCO',
    away_name TEXT NOT NULL DEFAULT 'HAI', home_goals INTEGER NOT NULL DEFAULT 0, away_goals INTEGER NOT NULL DEFAULT 0,
    minute TEXT NOT NULL DEFAULT '', visible INTEGER NOT NULL DEFAULT 0, updated_at TEXT)`);
  mockDb.prepare("INSERT INTO scoreboard (studio_id, home_goals) VALUES ('legacy', 3)").run();
  jest.isolateModules(() => {
    const sb = require('../src/scoreboard'); // module load runs the migration
    expect(sb.get('legacy')).toMatchObject({ home_goals: 3, renderer: 'react' });
    sb.adjust('legacy', 'home', 1);
    expect(sb.get('legacy').home_goals).toBe(4);
  });
});

describe('replay to a (re)registering screen', () => {
  const sock = () => { const got = []; return { got, emit: (event, payload) => got.push({ event, payload }) }; };

  test('nothing when the bug is off', () => {
    const s = sock(); scoreboard.replay(s, S);
    expect(s.got).toEqual([]);
  });

  test('react: re-sends sl_score with the current score to that socket only', () => {
    scoreboard.apply(S, { home_goals: 1, visible: 1 });
    mockSent.length = 0;
    const s = sock(); scoreboard.replay(s, S);
    expect(s.got).toHaveLength(1);
    expect(s.got[0].payload.overlay).toMatchObject({ type: 'sl_score', score: '1-0' });
    expect(mockSent).toEqual([]);
  });

  test('rive: re-sends gfx_score carrying the current state', () => {
    scoreboard.setRenderer(S, 'rive');
    scoreboard.apply(S, { away_goals: 2, visible: 1 });
    const s = sock(); scoreboard.replay(s, S);
    expect(s.got[0].payload.overlay.type).toBe('gfx_score');
    expect(s.got[0].payload.overlay.url).toContain('as=2');
  });
});
