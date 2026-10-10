/**
 * lib/access.js decision table (review 2026-10-10).
 */
const { decide } = require('../src/lib/access');

const A = 'studio-a', B = 'studio-b';
const producerA = { id: 'u1', username: 'p', role: 'producer', studio_id: A };
const viewerA = { id: 'u2', username: 'v', role: 'viewer', studio_id: A };
const superAdmin = { id: 'u3', username: 's', role: 'super_admin', studio_id: null };

describe('decide', () => {
  test('no user → 401', () => {
    expect(decide({ user: null, reachable: new Set(), studioIds: [A] })).toMatchObject({ ok: false, status: 401 });
  });
  test('own studio → ok', () => {
    expect(decide({ user: producerA, reachable: new Set([A]), studioIds: [A], write: true }).ok).toBe(true);
  });
  test('other studio → 403', () => {
    expect(decide({ user: producerA, reachable: new Set([A]), studioIds: [B], write: true })).toMatchObject({ ok: false, status: 403 });
  });
  test('workgroup studio → ok', () => {
    expect(decide({ user: producerA, reachable: new Set([A, B]), studioIds: [B], write: true }).ok).toBe(true);
  });
  test('every named studio must be reachable', () => {
    expect(decide({ user: producerA, reachable: new Set([A]), studioIds: [A, B] }).ok).toBe(false);
  });
  test('viewer cannot write, even to own studio', () => {
    expect(decide({ user: viewerA, reachable: new Set([A]), studioIds: [A], write: true })).toMatchObject({ ok: false, status: 403 });
  });
  test('viewer can read own studio', () => {
    expect(decide({ user: viewerA, reachable: new Set([A]), studioIds: [A], write: false }).ok).toBe(true);
  });
  test('super_admin reaches everything', () => {
    expect(decide({ user: superAdmin, reachable: 'all', studioIds: [A, B], write: true }).ok).toBe(true);
  });
  test('nothing named → ok (route answers 404 / uses its default)', () => {
    expect(decide({ user: producerA, reachable: new Set([A]), studioIds: [], write: true }).ok).toBe(true);
  });
});
