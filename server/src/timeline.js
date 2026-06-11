const { getIO } = require('./ws');
const { db, getLayoutById } = require('./db');

// Map of studioId -> { intervalId, show, currentLayoutId }
const activeTimelines = new Map();

function startTimeline(studioId, show) {
  // Stop any existing timeline for this studio
  stopTimeline(studioId);

  const timeline = typeof show.timeline === 'string' ? JSON.parse(show.timeline) : show.timeline;
  if (!timeline || timeline.length === 0) {
    console.log(`No timeline entries for show ${show.id}`);
    return;
  }

  console.log(`Starting timeline for studio ${studioId}, show "${show.name}" with ${timeline.length} entries`);

  let currentLayoutId = null;

  // Entry times are UK wall-clock. The broadcast day is anchored at the first
  // entry, so a rundown can cross midnight (e.g. 22:00 → 04:00). Entries must
  // be listed in running order.
  const toMins = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
  const anchor = toMins(timeline[0].time);
  const rel = (t) => (toMins(t) - anchor + 1440) % 1440;
  const lastRel = rel(timeline[timeline.length - 1].time);

  const intervalId = setInterval(() => {
    const now = new Date();
    const currentTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(now); // HH:MM, UK wall-clock

    // Latest entry at or before now in broadcast-day terms. Outside the show
    // window (past the last entry, or before the first) nothing matches.
    const nowRel = rel(currentTime);
    let matchedEntry = null;
    if (nowRel <= lastRel) {
      for (const entry of timeline) {
        if (rel(entry.time) <= nowRel) {
          matchedEntry = entry;
        }
      }
    }

    if (matchedEntry && matchedEntry.layout_id !== currentLayoutId) {
      currentLayoutId = matchedEntry.layout_id;
      const layout = getLayoutById(matchedEntry.layout_id);

      if (layout) {
        // Update all studio screens
        db.prepare("UPDATE screens SET current_layout_id = ?, updated_at = datetime('now') WHERE studio_id = ?")
          .run(matchedEntry.layout_id, studioId);

        // Emit to all studio screens
        getIO().to(`studio:${studioId}`).emit('set_layout', {
          layoutId: matchedEntry.layout_id,
          layout: { ...layout, modules: JSON.parse(layout.modules) },
          source: 'timeline',
          label: matchedEntry.label
        });

        console.log(`Timeline: switched studio ${studioId} to layout "${layout.name}" (${matchedEntry.label})`);
      }

      // Update active timeline state
      activeTimelines.set(studioId, { intervalId, show, currentLayoutId });
    }
  }, 1000);

  activeTimelines.set(studioId, { intervalId, show, currentLayoutId });
}

function stopTimeline(studioId) {
  const entry = activeTimelines.get(studioId);
  if (entry) {
    clearInterval(entry.intervalId);
    activeTimelines.delete(studioId);
    console.log(`Stopped timeline for studio ${studioId}`);
  }
}

function getCurrentState(studioId) {
  const entry = activeTimelines.get(studioId);
  if (!entry) {
    return { active: false };
  }

  const timeline = typeof entry.show.timeline === 'string' ? JSON.parse(entry.show.timeline) : entry.show.timeline;
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);

  let currentEntry = null;
  for (const te of timeline) {
    if (te.time <= currentTime) {
      currentEntry = te;
    }
  }

  return {
    active: true,
    show_id: entry.show.id,
    show_name: entry.show.name,
    current_layout_id: entry.currentLayoutId,
    current_entry: currentEntry,
    current_time: currentTime,
    timeline
  };
}

module.exports = { startTimeline, stopTimeline, getCurrentState };
