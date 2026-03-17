import React, { useState, useEffect } from 'react';

/**
 * Now Ayrshire Radio — Partners/Sponsors Rotator
 * Displays sponsor logos and names in a rotating carousel
 * Configurable via the layout editor
 */

const DEFAULT_PARTNERS = [
  { name: 'Billy Bowie Tankers', url: 'https://billybowietankers.co.uk/' },
  { name: 'Budget Blinds Ayrshire', url: 'https://budgetblindsayrshire.co.uk/' },
  { name: 'Caledonian Windows', url: 'https://caledonianwindows.co.uk/' },
  { name: 'Thistle Cabs', url: 'https://www.thistle-cabs.co.uk/' },
  { name: 'The Coo Shed', url: 'https://www.thecooshed.co.uk/' },
  { name: 'JD Pierce', url: 'https://www.jdpierce.co.uk/' },
  { name: 'Corri Skips', url: 'https://corrieskips.co.uk/' },
  { name: 'Kilmarnock FC', url: 'https://kilmarnockfc.co.uk/' },
  { name: 'Stagecoach', url: 'https://www.stagecoachbus.com/' },
  { name: 'LM Motor Company', url: 'https://www.lmmotorcompany.co.uk/' },
  { name: 'McKinstry', url: 'https://www.mckinstry.co.uk/' },
  { name: 'MKM Kilmarnock', url: 'https://mkm.com/branches/kilmarnock' },
  { name: 'The Park Hotel', url: 'https://theparkhotelayrshire.co.uk/' },
  { name: 'Regency FM', url: 'https://regencyfm.com/' },
  { name: 'Stewart Temp Solutions', url: 'https://stewart-temp-solutions.com/' },
  { name: 'Thorne Travel', url: 'https://thornetravel.com/' },
  { name: 'Chip n Logs', url: 'https://chipnlogs.com/' },
  { name: 'Ayrshire Climbing Centre', url: 'https://ayrshireclimbingcentre.co.uk/' },
  { name: 'Ayrshire College', url: 'https://www1.ayrshire.ac.uk/' },
  { name: 'ESSJAY Electrical', url: 'https://essjayelectricians.com/' },
  { name: 'Ayrshire Trade Frames', url: 'https://ayrshiretradeframes.co.uk/' },
];

function getFavicon(url) {
  try {
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
  } catch {
    return null;
  }
}

function getInitials(name) {
  return name.split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

// Generate a consistent color from name
function nameColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash) + name.charCodeAt(i);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 40%, 30%)`;
}

export default function NARPartnersModule({ config = {} }) {
  const {
    partners = DEFAULT_PARTNERS,
    background = 'transparent',
    color = '#ffffff',
    accentColor = '#8b5cf6',
    rotateInterval = 5000,
    layout = 'grid', // 'grid', 'single', 'strip'
    title = 'OUR PARTNERS',
    showTitle = true,
    gridCols = 3,
    gridRows = 3,
  } = config;

  const [offset, setOffset] = useState(0);
  const pageSize = layout === 'grid' ? gridCols * gridRows : layout === 'strip' ? 6 : 1;

  useEffect(() => {
    if (partners.length <= pageSize) return;
    const timer = setInterval(() => {
      setOffset(prev => (prev + pageSize) % partners.length);
    }, rotateInterval);
    return () => clearInterval(timer);
  }, [rotateInterval, partners.length, pageSize]);

  const visible = [];
  for (let i = 0; i < Math.min(pageSize, partners.length); i++) {
    visible.push(partners[(offset + i) % partners.length]);
  }

  if (layout === 'single') {
    const partner = visible[0];
    if (!partner) return null;
    const favicon = getFavicon(partner.url);
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3" style={{ background, color }}>
        {showTitle && (
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">{title}</span>
        )}
        <div className="w-20 h-20 rounded-xl flex items-center justify-center overflow-hidden"
          style={{ background: nameColor(partner.name) }}>
          {favicon ? (
            <img src={favicon} alt="" className="w-12 h-12" onError={(e) => { e.target.style.display = 'none'; }} />
          ) : (
            <span className="text-2xl font-bold opacity-60">{getInitials(partner.name)}</span>
          )}
        </div>
        <span className="text-lg font-semibold text-center px-4">{partner.name}</span>
      </div>
    );
  }

  if (layout === 'strip') {
    return (
      <div className="w-full h-full flex items-center overflow-hidden gap-1 px-2" style={{ background, color }}>
        {showTitle && (
          <span className="text-[9px] font-bold uppercase tracking-widest opacity-30 mr-2 flex-shrink-0"
            style={{ color: accentColor }}>
            {title}
          </span>
        )}
        {visible.map((p, i) => {
          const favicon = getFavicon(p.url);
          return (
            <div key={`${p.name}-${i}`} className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 flex-shrink-0">
              {favicon && (
                <img src={favicon} alt="" className="w-4 h-4" onError={(e) => { e.target.style.display = 'none'; }} />
              )}
              <span className="text-xs whitespace-nowrap">{p.name}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // Default: grid layout
  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ background, color }}>
      {showTitle && (
        <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: `2px solid ${accentColor}` }}>
          <span className="text-lg">🤝</span>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: accentColor }}>
            {title}
          </span>
        </div>
      )}
      <div className="flex-1 p-3 grid gap-2"
        style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gridTemplateRows: `repeat(${gridRows}, 1fr)` }}>
        {visible.map((partner, i) => {
          const favicon = getFavicon(partner.url);
          return (
            <div key={`${partner.name}-${i}`}
              className="rounded-lg bg-white/5 flex flex-col items-center justify-center gap-2 p-2 transition-all duration-500">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden"
                style={{ background: nameColor(partner.name) }}>
                {favicon ? (
                  <img src={favicon} alt="" className="w-7 h-7"
                    onError={(e) => { e.target.parentElement.innerHTML = `<span class="text-sm font-bold opacity-60">${getInitials(partner.name)}</span>`; }} />
                ) : (
                  <span className="text-sm font-bold opacity-60">{getInitials(partner.name)}</span>
                )}
              </div>
              <span className="text-[11px] text-center leading-tight opacity-80 line-clamp-2">{partner.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
