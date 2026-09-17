/**
 * playout/diskguard.js — refuse master transcodes that would breach a free-space floor.
 *
 * Ingest writes house masters onto the same volume as broadcast.db + WAL + nginx
 * roots. A long encode without a floor will fill the rootfs mid-show.
 *
 * Exports:
 *   freeBytes(path?)           → Promise<number>
 *   estimateMasterBytes(durationSec) → number
 *   check({ needBytes, durationSec, kind }) → Promise<{
 *     ok, freeBytes, floorBytes, needBytes, afterBytes, reason
 *   }>
 *
 * kind: "master" (default) uses PLAYOUT_DISK_FLOOR_GB (default 5)
 *       "probe" | "poster" uses hard 1 GiB floor
 *
 * Estimate: duration_s * 1.2e6 bytes/s (~9.6 Mbps, pessimistic for 1080p30 CRF20)
 */
"use strict";

const fs = require("fs");
const path = require("path");

const UPLOADS_DEFAULT = path.join(__dirname, "..", "..", "data", "uploads");

/** Bytes free on the filesystem that holds `dir` (defaults to uploads). */
async function freeBytes(dir = process.env.PLAYOUT_UPLOADS_DIR || UPLOADS_DEFAULT) {
  // Node 18.15+ / 22: fs.promises.statfs
  const s = await fs.promises.statfs(dir);
  // bavail = free blocks for unprivileged; prefer that over bfree
  const avail = typeof s.bavail === "bigint" ? Number(s.bavail) : s.bavail;
  const bsize = typeof s.bsize === "bigint" ? Number(s.bsize) : s.bsize;
  return avail * bsize;
}

/** Pessimistic house-master size estimate (bytes). */
function estimateMasterBytes(durationSec) {
  const d = Math.max(0, Number(durationSec) || 0);
  // 1.2 MB/s ≈ 9.6 Mbps — covers 1080p30 CRF20 + AAC with margin
  return Math.ceil(d * 1.2 * 1024 * 1024);
}

function floorBytesFor(kind) {
  const k = String(kind || "master").toLowerCase();
  if (k === "probe" || k === "poster" || k === "cheap") {
    return 1 * 1024 * 1024 * 1024; // hard 1 GiB
  }
  const gb = Number(process.env.PLAYOUT_DISK_FLOOR_GB);
  const floorGb = Number.isFinite(gb) && gb > 0 ? gb : 5;
  return Math.ceil(floorGb * 1024 * 1024 * 1024);
}

/**
 * @param {object} opts
 * @param {number} [opts.needBytes]     explicit bytes required (overrides duration estimate)
 * @param {number} [opts.durationSec]   used to estimate needBytes for masters
 * @param {string} [opts.kind]          "master" | "probe" | "poster"
 * @param {string} [opts.path]          volume path to stat (default uploads)
 * @returns {Promise<{ok:boolean, freeBytes:number, floorBytes:number, needBytes:number, afterBytes:number, reason:string|null}>}
 */
async function check(opts = {}) {
  const kind = opts.kind || "master";
  const floor = floorBytesFor(kind);
  let need = Number(opts.needBytes);
  if (!Number.isFinite(need) || need < 0) {
    need = kind === "master" || !opts.kind
      ? estimateMasterBytes(opts.durationSec)
      : 0;
  }
  const free = await freeBytes(opts.path);
  const after = free - need;
  const ok = after >= floor;
  let reason = null;
  if (!ok) {
    const freeG = (free / 1e9).toFixed(2);
    const needG = (need / 1e9).toFixed(2);
    const floorG = (floor / 1e9).toFixed(2);
    const afterG = (after / 1e9).toFixed(2);
    reason =
      `disk guard: free ${freeG}G − need ${needG}G = ${afterG}G < floor ${floorG}G` +
      ` (kind=${kind}). Refuse to start; free space or lower PLAYOUT_DISK_FLOOR_GB.`;
  }
  return {
    ok,
    freeBytes: free,
    floorBytes: floor,
    needBytes: need,
    afterBytes: after,
    reason,
  };
}

module.exports = {
  freeBytes,
  estimateMasterBytes,
  check,
  // aliases if preferred
  floorBytesFor,
};
