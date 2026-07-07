import React from 'react';

// TouchMenuModule — an interactive on-screen menu for touch displays / kiosks.
//
// Screens are output surfaces: ScreenDisplay wraps every composition layer in
// `pointer-events: none` so nothing on a video wall is accidentally clickable.
// That is exactly why taps normally never reach a module. This module opts back
// IN by setting `pointer-events: auto` on its own container — a descendant with
// `auto` is hit-testable again even though an ancestor is `none` (standard CSS).
// So the click-blocking is defeated locally, without touching the global player.
//
// Each item runs an action on tap:
//   url        → navigate this browser to target (default). newTab opens a tab.
//   screen     → load another screen by id (/screen/<target>)
//   layout     → switch THIS screen to a layout id (needs an operator token in
//                localStorage; on a public kiosk falls back to a no-op + toast)
//   back       → window.history.back()
//   reload     → reload the page
//   fullscreen → toggle browser fullscreen
//
// Items may be given as a JSON array in `items`, or as simple lines in
// `itemsText` — one per line: "Label | /target | icon | action". Only Label is
// required; target defaults to '#', action defaults to 'url'.

function parseItemsText(text) {
  return String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, target, icon, action] = line.split('|').map((p) => (p || '').trim());
      return { label, target, icon, action: action || 'url' };
    });
}

function runAction(item, screenId) {
  const action = item.action || 'url';
  const target = item.target ?? item.url ?? '';
  switch (action) {
    case 'back':
      window.history.back();
      return;
    case 'reload':
      window.location.reload();
      return;
    case 'fullscreen':
      if (document.fullscreenElement) document.exitFullscreen?.();
      else document.documentElement.requestFullscreen?.().catch(() => {});
      return;
    case 'screen':
      if (target) window.location.href = `/screen/${target}`;
      return;
    case 'layout': {
      // Self-service layout switch — only works if this browser holds an
      // operator token (e.g. a staff tablet). Public kiosks won't have one.
      if (!target || !screenId) return;
      const token = localStorage.getItem('broadcast_token');
      if (!token) { window.__bsToast?.('This screen can’t switch layouts (no operator token)', 'error'); return; }
      fetch(`/api/screens/${screenId}/layout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ layout_id: target }),
      }).catch(() => {});
      return;
    }
    case 'url':
    default:
      if (!target) return;
      if (item.newTab) window.open(target, '_blank', 'noopener');
      else window.location.href = target;
  }
}

export default function TouchMenuModule({ config = {}, moduleId }) {
  const items = Array.isArray(config.items) && config.items.length
    ? config.items
    : parseItemsText(config.itemsText);

  const columns = Number(config.columns) || 0; // 0 = auto-fit
  const gap = config.gap || '1.25rem';
  const background = config.background || 'transparent';
  const accent = config.accent || '#3b82f6';
  const textColor = config.textColor || '#ffffff';
  const tileBg = config.tileBackground || 'rgba(255,255,255,0.06)';
  const shape = config.shape || 'card'; // 'card' | 'pill'
  const radius = shape === 'pill' ? '9999px' : (config.radius || '1rem');
  const iconSize = config.iconSize || '2.75rem';
  const labelSize = config.labelSize || '1.5rem';

  const gridTemplate = columns > 0
    ? `repeat(${columns}, minmax(0, 1fr))`
    : `repeat(auto-fit, minmax(min(14rem, 100%), 1fr))`;

  return (
    <div
      // ── The one line that lets taps through the screen player ──
      style={{
        pointerEvents: 'auto',
        cursor: 'auto',
        touchAction: 'manipulation',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: config.title ? '1.5rem' : 0,
        padding: config.padding || '4vmin',
        background,
        color: textColor,
        fontFamily: config.fontFamily || "'Inter', system-ui, sans-serif",
      }}
    >
      {config.title && (
        <div style={{ fontSize: config.titleSize || '2.25rem', fontWeight: 800, letterSpacing: '0.02em', textAlign: config.titleAlign || 'left' }}>
          {config.title}
        </div>
      )}

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          gap,
          alignContent: config.vAlign === 'top' ? 'start' : config.vAlign === 'bottom' ? 'end' : 'center',
        }}
      >
        {items.map((item, i) => (
          <button
            key={item.id || `${item.label}-${i}`}
            type="button"
            onClick={() => runAction(item, window.__bsScreenId)}
            style={{
              pointerEvents: 'auto',
              cursor: 'pointer',
              touchAction: 'manipulation',
              appearance: 'none',
              border: `1px solid ${item.color ? item.color : 'rgba(255,255,255,0.12)'}`,
              borderRadius: radius,
              background: item.background || tileBg,
              color: item.textColor || textColor,
              display: 'flex',
              flexDirection: shape === 'pill' ? 'row' : 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              padding: shape === 'pill' ? '1.1rem 1.75rem' : '1.75rem 1.25rem',
              minHeight: shape === 'pill' ? 'auto' : '9rem',
              textAlign: 'center',
              transition: 'transform 0.08s ease, box-shadow 0.15s ease, background 0.15s ease',
              boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
              outline: 'none',
              WebkitTapHighlightColor: 'transparent',
            }}
            onPointerDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)'; e.currentTarget.style.background = item.activeBackground || accent; }}
            onPointerUp={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.background = item.background || tileBg; }}
            onPointerLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.background = item.background || tileBg; }}
          >
            {item.icon && (
              /^(https?:|\/|data:)/.test(item.icon)
                ? <img src={item.icon} alt="" style={{ width: iconSize, height: iconSize, objectFit: 'contain' }} />
                : <span style={{ fontSize: iconSize, lineHeight: 1 }}>{item.icon}</span>
            )}
            <span style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              <span style={{ fontSize: labelSize, fontWeight: 700, lineHeight: 1.1 }}>{item.label}</span>
              {item.sublabel && (
                <span style={{ fontSize: '0.95rem', opacity: 0.7, fontWeight: 500 }}>{item.sublabel}</span>
              )}
            </span>
          </button>
        ))}
        {items.length === 0 && (
          <div style={{ opacity: 0.5, fontSize: '1.1rem', gridColumn: '1 / -1', textAlign: 'center' }}>
            No menu items — add some in the module config.
          </div>
        )}
      </div>
    </div>
  );
}
