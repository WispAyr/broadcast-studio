import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../lib/api';
import ModulePicker from '../../components/ModulePicker';
import ModuleRenderer from '../../components/ModuleRenderer';

// Config field definitions per module type for friendly editing
const MODULE_CONFIG_FIELDS = {
  clock: [
    { key: 'format', label: 'Format', type: 'select', options: ['24h', '12h'], default: '24h' },
    { key: 'showSeconds', label: 'Show Seconds', type: 'checkbox', default: true },
    { key: 'showDate', label: 'Show Date', type: 'checkbox', default: false },
    { key: 'fontSize', label: 'Font Size', type: 'text', default: '3rem' },
    { key: 'color', label: 'Color', type: 'color', default: '#ffffff' },
    { key: 'background', label: 'Background', type: 'color', default: '#000000' },
  ],
  countdown: [
    { key: 'target', label: 'Target Time (ISO)', type: 'text', default: '' },
    { key: 'duration', label: 'Duration (seconds)', type: 'number', default: 300 },
    { key: 'fontSize', label: 'Font Size', type: 'text', default: '3rem' },
    { key: 'expiredText', label: 'Expired Text', type: 'text', default: 'TIME' },
    { key: 'color', label: 'Color', type: 'color', default: '#ffffff' },
    { key: 'warningColor', label: 'Warning Color', type: 'color', default: '#f59e0b' },
  ],
  text: [
    { key: 'text', label: 'Text', type: 'textarea', default: '' },
    { key: 'align', label: 'Align', type: 'select', options: ['center', 'left', 'right'], default: 'center' },
    { key: 'fontSize', label: 'Font Size', type: 'text', default: '1.5rem' },
    { key: 'fontWeight', label: 'Font Weight', type: 'select', options: ['normal', 'bold', '100', '300', '500', '700', '900'], default: 'bold' },
    { key: 'color', label: 'Color', type: 'color', default: '#ffffff' },
    { key: 'background', label: 'Background', type: 'color', default: '#000000' },
  ],
  image: [
    { key: 'src', label: 'Image URL', type: 'text', default: '' },
    { key: 'fit', label: 'Fit', type: 'select', options: ['contain', 'cover', 'fill'], default: 'contain' },
    { key: 'alt', label: 'Alt Text', type: 'text', default: '' },
    { key: 'background', label: 'Background', type: 'color', default: '#000000' },
  ],
  video: [
    { key: 'src', label: 'Video URL', type: 'text', default: '' },
    { key: 'autoplay', label: 'Autoplay', type: 'checkbox', default: true },
    { key: 'loop', label: 'Loop', type: 'checkbox', default: true },
    { key: 'muted', label: 'Muted', type: 'checkbox', default: true },
  ],
  ticker: [
    { key: 'text', label: 'Ticker Text', type: 'textarea', default: '' },
    { key: 'speed', label: 'Speed (seconds)', type: 'number', default: 30 },
    { key: 'fontSize', label: 'Font Size', type: 'text', default: '1.25rem' },
    { key: 'color', label: 'Color', type: 'color', default: '#ffffff' },
    { key: 'background', label: 'Background', type: 'color', default: '#000000' },
  ],
  iframe: [
    { key: 'src', label: 'URL', type: 'text', default: '' },
    { key: 'title', label: 'Title', type: 'text', default: '' },
  ],
  weather: [
    { key: 'location', label: 'Location Name', type: 'text', default: 'Ayr' },
    { key: 'lat', label: 'Latitude', type: 'number', default: 55.46 },
    { key: 'lon', label: 'Longitude', type: 'number', default: -4.63 },
    { key: 'unit', label: 'Unit', type: 'select', options: ['C', 'F'], default: 'C' },
    { key: 'displayStyle', label: 'Display', type: 'select', options: ['current', 'forecast'], default: 'current' },
    { key: 'refreshInterval', label: 'Refresh (seconds)', type: 'number', default: 600 },
    { key: 'color', label: 'Color', type: 'color', default: '#ffffff' },
    { key: 'background', label: 'Background', type: 'color', default: '#000000' },
  ],
  color: [
    { key: 'color', label: 'Color', type: 'color', default: '#000000' },
  ],
  logo: [
    { key: 'src', label: 'Logo URL', type: 'text', default: '' },
    { key: 'text', label: 'Fallback Text', type: 'text', default: '' },
    { key: 'maxWidth', label: 'Max Width', type: 'text', default: '80%' },
    { key: 'background', label: 'Background', type: 'color', default: '#000000' },
  ],
  autocue: [
    { key: 'text', label: 'Script', type: 'textarea', default: '' },
    { key: 'speed', label: 'Speed (px/s)', type: 'number', default: 40 },
    { key: 'fontSize', label: 'Font Size', type: 'text', default: '2rem' },
    { key: 'mirror', label: 'Mirror', type: 'checkbox', default: false },
    { key: 'color', label: 'Color', type: 'color', default: '#ffffff' },
    { key: 'background', label: 'Background', type: 'color', default: '#000000' },
  ],
  social: [
    { key: 'autoScroll', label: 'Auto Scroll', type: 'checkbox', default: true },
    { key: 'scrollSpeed', label: 'Scroll Speed (ms)', type: 'number', default: 5000 },
    { key: 'background', label: 'Background', type: 'color', default: '#000000' },
  ],
  breaking_news: [
    { key: 'headline', label: 'Headline', type: 'textarea', default: '' },
    { key: 'subtext', label: 'Sub Text / Ticker', type: 'textarea', default: '' },
    { key: 'style', label: 'Style', type: 'select', options: ['full', 'banner', 'ticker'], default: 'full' },
    { key: 'urgent', label: 'Urgent Pulse', type: 'checkbox', default: true },
    { key: 'speed', label: 'Scroll Speed (s)', type: 'number', default: 25 },
    { key: 'background', label: 'Background', type: 'color', default: '#cc0000' },
    { key: 'color', label: 'Text Color', type: 'color', default: '#ffffff' },
  ],
  travel: [
    { key: 'title', label: 'Title', type: 'text', default: 'Travel Update' },
    { key: 'autoScroll', label: 'Auto Scroll', type: 'checkbox', default: true },
    { key: 'scrollSpeed', label: 'Cycle Speed (ms)', type: 'number', default: 6000 },
    { key: 'background', label: 'Background', type: 'color', default: '#000000' },
  ],
  weather_radar: [
    { key: 'lat', label: 'Latitude', type: 'number', default: 55.46 },
    { key: 'lon', label: 'Longitude', type: 'number', default: -4.63 },
    { key: 'zoom', label: 'Zoom', type: 'number', default: 8 },
    { key: 'src', label: 'Custom URL (optional)', type: 'text', default: '' },
  ],
  aircraft_tracker: [
    { key: 'lat', label: 'Latitude', type: 'number', default: 55.46 },
    { key: 'lon', label: 'Longitude', type: 'number', default: -4.63 },
    { key: 'zoom', label: 'Zoom', type: 'number', default: 9 },
    { key: 'src', label: 'Custom URL (optional)', type: 'text', default: '' },
  ],
  camera_feed: [
    { key: 'src', label: 'Stream URL (HLS/MP4)', type: 'text', default: '' },
    { key: 'label', label: 'Camera Label', type: 'text', default: '' },
    { key: 'muted', label: 'Muted', type: 'checkbox', default: true },
    { key: 'autoplay', label: 'Autoplay', type: 'checkbox', default: true },
  ],
  alert_ticker: [
    { key: 'mode', label: 'Mode', type: 'select', options: ['scroll', 'cycle'], default: 'scroll' },
    { key: 'speed', label: 'Scroll Speed (s)', type: 'number', default: 30 },
    { key: 'cycleSpeed', label: 'Cycle Speed (ms)', type: 'number', default: 5000 },
    { key: 'background', label: 'Background', type: 'color', default: '#1e1e1e' },
  ],
  time_local: [
    { key: 'mode', label: 'Clock Mode', type: 'select', options: [
      { value: 'broadcast', label: '🎙 Broadcast Clock — segment wheel with sweep hand' },
      { value: 'studio-led', label: '💚 Studio LED — green dot matrix display' },
      { value: 'analogue', label: '🕰 Analogue Studio — traditional clock face' },
      { value: 'flip', label: '📋 Digital Flip — retro split-flap board' },
      { value: 'minimal', label: '✨ Minimal — ultra-clean massive digits' },
      { value: 'nixie', label: '🔶 Nixie Tube — warm vintage glow' },
      { value: 'shack', label: '📡 Radio Shack — UTC, callsign, grid' },
      { value: 'contest', label: '🏆 Contest Clock — QSO counter, bands' },
      { value: 'propagation', label: '🌍 Propagation — grey line, solar data' },
      { value: 'world', label: '🌐 World Clock — multiple timezones' },
      { value: 'countdown', label: '⏱ Countdown — target date with urgency' },
      { value: 'binary', label: '💡 Binary Clock — BCD LED columns' },
      { value: 'spectrum', label: '🌈 Spectrum — rainbow colour sweep' },
      { value: 'pomodoro', label: '🍅 Pomodoro — work/break timer' },
    ], default: 'broadcast' },
    { key: 'theme', label: 'Color Theme', type: 'select', options: [
      { value: '', label: 'Default (mode-specific)' },
      { value: 'amber', label: '🟠 Amber' },
      { value: 'green', label: '🟢 Green' },
      { value: 'blue', label: '🔵 Blue' },
      { value: 'red', label: '🔴 Red' },
      { value: 'white', label: '⚪ White' },
      { value: 'cyan', label: '🔵 Cyan' },
      { value: 'purple', label: '🟣 Purple' },
      { value: 'pink', label: '💗 Pink' },
      { value: 'matrix', label: '💚 Matrix' },
    ], default: '' },
    { key: 'timezone', label: 'Timezone', type: 'select', options: [
      { value: '', label: 'Local (browser default)' },
      { value: 'Europe/London', label: '🇬🇧 London (GMT/BST)' },
      { value: 'Europe/Dublin', label: '🇮🇪 Dublin (GMT/IST)' },
      { value: 'Europe/Paris', label: '🇫🇷 Paris (CET/CEST)' },
      { value: 'Europe/Berlin', label: '🇩🇪 Berlin (CET/CEST)' },
      { value: 'Europe/Madrid', label: '🇪🇸 Madrid (CET/CEST)' },
      { value: 'Europe/Rome', label: '🇮🇹 Rome (CET/CEST)' },
      { value: 'Europe/Amsterdam', label: '🇳🇱 Amsterdam (CET/CEST)' },
      { value: 'Europe/Moscow', label: '🇷🇺 Moscow (MSK)' },
      { value: 'Europe/Istanbul', label: '🇹🇷 Istanbul (TRT)' },
      { value: 'America/New_York', label: '🇺🇸 New York (EST/EDT)' },
      { value: 'America/Chicago', label: '🇺🇸 Chicago (CST/CDT)' },
      { value: 'America/Denver', label: '🇺🇸 Denver (MST/MDT)' },
      { value: 'America/Los_Angeles', label: '🇺🇸 Los Angeles (PST/PDT)' },
      { value: 'America/Toronto', label: '🇨🇦 Toronto (EST/EDT)' },
      { value: 'America/Sao_Paulo', label: '🇧🇷 São Paulo (BRT)' },
      { value: 'Asia/Tokyo', label: '🇯🇵 Tokyo (JST)' },
      { value: 'Asia/Shanghai', label: '🇨🇳 Shanghai (CST)' },
      { value: 'Asia/Hong_Kong', label: '🇭🇰 Hong Kong (HKT)' },
      { value: 'Asia/Singapore', label: '🇸🇬 Singapore (SGT)' },
      { value: 'Asia/Dubai', label: '🇦🇪 Dubai (GST)' },
      { value: 'Asia/Kolkata', label: '🇮🇳 Mumbai (IST)' },
      { value: 'Asia/Seoul', label: '🇰🇷 Seoul (KST)' },
      { value: 'Australia/Sydney', label: '🇦🇺 Sydney (AEST/AEDT)' },
      { value: 'Australia/Perth', label: '🇦🇺 Perth (AWST)' },
      { value: 'Pacific/Auckland', label: '🇳🇿 Auckland (NZST/NZDT)' },
      { value: 'Africa/Johannesburg', label: '🇿🇦 Johannesburg (SAST)' },
      { value: 'Africa/Cairo', label: '🇪🇬 Cairo (EET)' },
      { value: 'UTC', label: '🌐 UTC' },
    ], default: '' },
    { key: 'label', label: 'Display Label', type: 'text', default: '', placeholder: 'e.g. Studio A, ON AIR, London' },
    { key: 'callsign', label: 'Callsign (ham modes)', type: 'text', default: '', placeholder: 'e.g. GM3ABC' },
    { key: 'grid', label: 'Grid Locator (ham modes)', type: 'text', default: '', placeholder: 'e.g. IO75su' },
    { key: 'target', label: 'Countdown Target', type: 'text', default: '', placeholder: 'ISO date e.g. 2026-12-31T23:59:59' },
    { key: 'workMinutes', label: 'Pomodoro Work (min)', type: 'number', default: 25 },
    { key: 'breakMinutes', label: 'Pomodoro Break (min)', type: 'number', default: 5 },
    { key: 'fullscreen', label: 'Fullscreen Mode', type: 'checkbox', default: true },
    { key: 'background', label: 'Container Background', type: 'color', default: '#000000' },
  ],
  rss_feed: [
    { key: 'feedUrl', label: 'Feed URL', type: 'text', default: '' },
    { key: 'displayStyle', label: 'Display Style', type: 'select', options: ['cards', 'list', 'ticker'], default: 'cards' },
    { key: 'maxItems', label: 'Max Items', type: 'number', default: 10 },
    { key: 'refreshInterval', label: 'Refresh (seconds)', type: 'number', default: 300 },
    { key: 'color', label: 'Color', type: 'color', default: '#ffffff' },
    { key: 'background', label: 'Background', type: 'color', default: '#000000' },
  ],
  news_ticker: [
    { key: 'feedUrls', label: 'Feed URLs (comma-separated)', type: 'textarea', default: 'https://feeds.bbci.co.uk/news/rss.xml' },
    { key: 'speed', label: 'Scroll Speed (px/s)', type: 'number', default: 80 },
    { key: 'separator', label: 'Separator', type: 'text', default: '  ●  ' },
    { key: 'showSource', label: 'Show Source', type: 'checkbox', default: true },
    { key: 'refreshInterval', label: 'Refresh (seconds)', type: 'number', default: 300 },
    { key: 'fontSize', label: 'Font Size', type: 'text', default: '1.1rem' },
    { key: 'color', label: 'Color', type: 'color', default: '#ffffff' },
    { key: 'background', label: 'Background', type: 'color', default: '#cc0000' },
  ],
  social_embed: [
    { key: 'platform', label: 'Platform', type: 'select', options: ['twitter', 'x', 'facebook', 'instagram'], default: 'twitter' },
    { key: 'accountUrl', label: 'Account / Page URL', type: 'text', default: '' },
    { key: 'theme', label: 'Theme', type: 'select', options: ['dark', 'light'], default: 'dark' },
    { key: 'background', label: 'Background', type: 'color', default: '#000000' },
  ],
  web_source: [
    { key: 'url', label: 'URL', type: 'text', default: '' },
    { key: 'refreshInterval', label: 'Auto-Refresh (seconds, 0=off)', type: 'number', default: 0 },
    { key: 'zoom', label: 'Zoom (%)', type: 'number', default: 100 },
    { key: 'useProxy', label: 'Use CORS Proxy', type: 'checkbox', default: false },
    { key: 'scrollX', label: 'Scroll X', type: 'number', default: 0 },
    { key: 'scrollY', label: 'Scroll Y', type: 'number', default: 0 },
    { key: 'background', label: 'Background', type: 'color', default: '#000000' },
  ],
  youtube_player: [
    { key: 'url', label: 'YouTube URL / Video ID', type: 'text', default: '' },
    { key: 'autoplay', label: 'Autoplay', type: 'checkbox', default: true },
    { key: 'mute', label: 'Muted', type: 'checkbox', default: true },
    { key: 'loop', label: 'Loop', type: 'checkbox', default: false },
    { key: 'showControls', label: 'Show Controls', type: 'checkbox', default: false },
    { key: 'background', label: 'Background', type: 'color', default: '#000000' },
  ],
  // ── New modules ──
  news_tv: [
    { key: 'defaultChannel', label: 'Default Channel', type: 'select', options: [
      { value: 'sky-news', label: '🔵 Sky News' },
      { value: 'bbc-news', label: '🔴 BBC News' },
      { value: 'gb-news', label: '🟠 GB News' },
      { value: 'al-jazeera', label: '🟡 Al Jazeera' },
      { value: 'france24', label: '🔵 France 24' },
      { value: 'dw-news', label: '⚪ DW News' },
      { value: 'euronews', label: '🔵 Euronews' },
      { value: 'times-radio', label: '⚫ Times Radio' },
    ], default: 'sky-news' },
    { key: 'mute', label: 'Muted', type: 'checkbox', default: true },
    { key: 'showChannelBar', label: 'Show Channel Bar', type: 'checkbox', default: true },
    { key: 'barPosition', label: 'Bar Position', type: 'select', options: ['bottom', 'top'], default: 'bottom' },
    { key: 'autoRotate', label: 'Auto-Rotate Channels', type: 'checkbox', default: false },
    { key: 'rotateIntervalMs', label: 'Rotate Interval (ms)', type: 'number', default: 300000 },
    { key: 'title', label: 'Title', type: 'text', default: 'NEWS' },
  ],
  nar_schedule: [
    { key: 'accentColor', label: 'Accent Color', type: 'color', default: '#e11d48' },
    { key: 'title', label: 'Title', type: 'text', default: 'NOW AYRSHIRE RADIO' },
    { key: 'showThumbnails', label: 'Show Thumbnails', type: 'checkbox', default: true },
    { key: 'showGenres', label: 'Show Genre Tags', type: 'checkbox', default: true },
    { key: 'maxUpcoming', label: 'Max Upcoming Shows', type: 'number', default: 4 },
    { key: 'compact', label: 'Compact Mode', type: 'checkbox', default: false },
    { key: 'refreshInterval', label: 'Refresh (ms)', type: 'number', default: 60000 },
    { key: 'background', label: 'Background', type: 'color', default: '#000000' },
    { key: 'color', label: 'Text Color', type: 'color', default: '#ffffff' },
  ],
  nar_news: [
    { key: 'categories', label: 'Category', type: 'select', options: [
      { value: 'news', label: '📰 News' },
      { value: 'sport', label: '⚽ Sport' },
      { value: 'all', label: '📰⚽ News & Sport' },
    ], default: 'news' },
    { key: 'layout', label: 'Layout', type: 'select', options: [
      { value: 'list', label: '📋 List — scrollable headlines' },
      { value: 'hero', label: '🖼 Hero — full-bleed rotating stories' },
      { value: 'ticker', label: '📜 Ticker — horizontal scrolling bar' },
    ], default: 'list' },
    { key: 'maxItems', label: 'Max Items', type: 'number', default: 8 },
    { key: 'showImages', label: 'Show Images', type: 'checkbox', default: true },
    { key: 'showExcerpts', label: 'Show Excerpts', type: 'checkbox', default: true },
    { key: 'compact', label: 'Compact Mode', type: 'checkbox', default: false },
    { key: 'autoScroll', label: 'Auto-Scroll (hero mode)', type: 'checkbox', default: true },
    { key: 'scrollInterval', label: 'Scroll Interval (ms)', type: 'number', default: 8000 },
    { key: 'accentColor', label: 'Accent Color', type: 'color', default: '#3b82f6' },
    { key: 'title', label: 'Title Override', type: 'text', default: '', placeholder: 'Leave empty for auto' },
    { key: 'background', label: 'Background', type: 'color', default: '#000000' },
    { key: 'color', label: 'Text Color', type: 'color', default: '#ffffff' },
  ],
  nar_sport: [
    { key: 'layout', label: 'Layout', type: 'select', options: [
      { value: 'list', label: '📋 List' },
      { value: 'hero', label: '🖼 Hero' },
      { value: 'ticker', label: '📜 Ticker' },
    ], default: 'list' },
    { key: 'maxItems', label: 'Max Items', type: 'number', default: 8 },
    { key: 'showImages', label: 'Show Images', type: 'checkbox', default: true },
    { key: 'compact', label: 'Compact Mode', type: 'checkbox', default: false },
    { key: 'accentColor', label: 'Accent Color', type: 'color', default: '#f97316' },
    { key: 'background', label: 'Background', type: 'color', default: '#000000' },
  ],
  nar_partners: [
    { key: 'layout', label: 'Layout', type: 'select', options: [
      { value: 'grid', label: '⊞ Grid — rotating pages' },
      { value: 'single', label: '1️⃣ Single — one at a time' },
      { value: 'strip', label: '➡️ Strip — horizontal bar' },
    ], default: 'grid' },
    { key: 'gridCols', label: 'Grid Columns', type: 'number', default: 3 },
    { key: 'gridRows', label: 'Grid Rows', type: 'number', default: 3 },
    { key: 'rotateInterval', label: 'Rotate Interval (ms)', type: 'number', default: 5000 },
    { key: 'showTitle', label: 'Show Title', type: 'checkbox', default: true },
    { key: 'title', label: 'Title', type: 'text', default: 'OUR PARTNERS' },
    { key: 'accentColor', label: 'Accent Color', type: 'color', default: '#8b5cf6' },
    { key: 'background', label: 'Background', type: 'color', default: '#000000' },
    { key: 'color', label: 'Text Color', type: 'color', default: '#ffffff' },
  ],
  travel_screen: [
    { key: 'title', label: 'Title', type: 'text', default: 'Ayrshire Travel' },
    { key: 'compactMode', label: 'Compact Mode', type: 'checkbox', default: false },
    { key: 'refreshInterval', label: 'Refresh (ms)', type: 'number', default: 120000 },
    { key: 'theme', label: 'Theme', type: 'select', options: ['dark', 'light'], default: 'dark' },
  ],
  travel_times: [
    { key: 'layout', label: 'Layout', type: 'select', options: [
      { value: 'list', label: '📋 List' },
      { value: 'grid', label: '⊞ Grid' },
      { value: 'split', label: '🗺 Split (list + Waze map)' },
    ], default: 'list' },
    { key: 'title', label: 'Title', type: 'text', default: 'TRAVEL TIMES' },
    { key: 'compact', label: 'Compact Mode', type: 'checkbox', default: false },
    { key: 'showNormalTime', label: 'Show Normal Time', type: 'checkbox', default: true },
    { key: 'showDelayBadge', label: 'Show Delay Badge', type: 'checkbox', default: true },
    { key: 'showWazeEmbed', label: 'Show Waze Map', type: 'checkbox', default: false },
    { key: 'refreshInterval', label: 'Refresh (ms)', type: 'number', default: 180000 },
    { key: 'background', label: 'Background', type: 'color', default: '#000000' },
    { key: 'color', label: 'Text Color', type: 'color', default: '#ffffff' },
  ],
};

function ConfigField({ field, value, onChange }) {
  const val = value !== undefined ? value : field.default;

  switch (field.type) {
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!val}
            onChange={(e) => onChange(e.target.checked)}
            className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-300">{field.label}</span>
        </label>
      );
    case 'select':
      return (
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">{field.label}</label>
          <select
            value={val || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
          >
            {field.options.map((opt) => {
              const optValue = typeof opt === 'object' ? opt.value : opt;
              const optLabel = typeof opt === 'object' ? opt.label : opt;
              return <option key={optValue} value={optValue}>{optLabel}</option>;
            })}
          </select>
        </div>
      );
    case 'textarea':
      return (
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">{field.label}</label>
          <textarea
            value={val || ''}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm font-mono focus:outline-none focus:border-blue-500"
          />
        </div>
      );
    case 'color':
      return (
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">{field.label}</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={val || '#000000'}
              onChange={(e) => onChange(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-gray-700"
            />
            <input
              type="text"
              value={val || ''}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      );
    case 'number':
      return (
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">{field.label}</label>
          <input
            type="number"
            value={val ?? ''}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
      );
    default:
      return (
        <div>
          <label className="text-xs text-gray-500 uppercase block mb-1">{field.label}</label>
          <input
            type="text"
            value={val || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || ''}
            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500 placeholder:text-gray-600"
          />
        </div>
      );
  }
}

export default function Layouts() {
  const [layouts, setLayouts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedLayout, setSelectedLayout] = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModulePicker, setShowModulePicker] = useState(false);
  const [placingCell, setPlacingCell] = useState(null); // {row, col} when placing via cell click
  const [selectedModule, setSelectedModule] = useState(null);
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [moduleConfigJson, setModuleConfigJson] = useState('{}');
  const saveTimer = useRef(null);

  async function fetchLayouts() {
    try {
      const data = await api.get('/layouts');
      setLayouts(data.layouts || data || []);
    } catch (err) {
      console.error('Failed to fetch layouts:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLayouts();
  }, []);

  useEffect(() => {
    if (selectedId) {
      api
        .get(`/layouts/${selectedId}`)
        .then((data) => {
          const layout = data.layout || data;
          const parsedModules = typeof layout.modules === 'string' ? JSON.parse(layout.modules) : (layout.modules || []);
          setSelectedLayout({ ...layout, grid_columns: layout.grid_cols || layout.grid_columns || 3 });
          setModules(parsedModules);
          setSelectedModule(null);
        })
        .catch((err) => console.error('Failed to fetch layout:', err));
    }
  }, [selectedId]);

  const autoSave = useCallback(
    (layoutData) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        if (!selectedId) return;
        try {
          // Map grid_columns back to grid_cols for the API
          const payload = { ...layoutData };
          if (payload.grid_columns !== undefined) {
            payload.grid_cols = payload.grid_columns;
            delete payload.grid_columns;
          }
          await api.put(`/layouts/${selectedId}`, payload);
        } catch (err) {
          console.error('Auto-save failed:', err);
        }
      }, 800);
    },
    [selectedId]
  );

  function updateLayout(updates) {
    const updated = { ...selectedLayout, ...updates };
    setSelectedLayout(updated);
    // Map for API
    const apiUpdates = { ...updates };
    if (apiUpdates.grid_columns !== undefined) {
      apiUpdates.grid_cols = apiUpdates.grid_columns;
      delete apiUpdates.grid_columns;
    }
    autoSave(apiUpdates);
  }

  function updateModules(newModules) {
    setModules(newModules);
    autoSave({ modules: newModules });
  }

  async function handleNewLayout() {
    try {
      const data = await api.post('/layouts', {
        name: 'New Layout',
        grid_rows: 3,
        grid_cols: 4,
        background: '#000000'
      });
      fetchLayouts();
      setSelectedId(data.layout?.id || data.id);
    } catch (err) {
      alert('Failed to create layout: ' + err.message);
    }
  }

  async function handleDeleteLayout() {
    if (!selectedId || !confirm('Delete this layout?')) return;
    try {
      await api.delete(`/layouts/${selectedId}`);
      setSelectedId(null);
      setSelectedLayout(null);
      setModules([]);
      fetchLayouts();
    } catch (err) {
      alert('Failed to delete layout: ' + err.message);
    }
  }

  function handleModuleSelect(moduleType) {
    const newModule = {
      id: 'mod_' + Date.now(),
      module: moduleType.name || moduleType.id,
      module_type: moduleType.name || moduleType.id,
      type: moduleType.name || moduleType.id,
      x: placingCell ? placingCell.col : 0,
      y: placingCell ? placingCell.row : 0,
      w: 1,
      h: 1,
      config: {}
    };
    const newModules = [...modules, newModule];
    updateModules(newModules);
    setShowModulePicker(false);
    setPlacingCell(null);
    setSelectedModule(newModules.length - 1);
  }

  function removeModule(index) {
    const newModules = modules.filter((_, i) => i !== index);
    updateModules(newModules);
    if (selectedModule === index) setSelectedModule(null);
    else if (selectedModule > index) setSelectedModule(selectedModule - 1);
  }

  function updateModulePlacement(index, field, value) {
    const newModules = [...modules];
    newModules[index] = { ...newModules[index], [field]: parseInt(value) || 0 };
    updateModules(newModules);
  }

  function updateModuleConfigField(index, key, value) {
    const newModules = [...modules];
    const newConfig = { ...newModules[index].config, [key]: value };
    newModules[index] = { ...newModules[index], config: newConfig };
    updateModules(newModules);
  }

  function handleCellClick(row, col) {
    setPlacingCell({ row, col });
    setShowModulePicker(true);
  }

  const gridRows = selectedLayout?.grid_rows || 3;
  const gridCols = selectedLayout?.grid_columns || selectedLayout?.grid_cols || 4;

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <p className="text-gray-400">Loading layouts...</p>
      </div>
    );
  }

  const selectedMod = selectedModule !== null ? modules[selectedModule] : null;
  const modType = selectedMod ? (selectedMod.type || selectedMod.module_type || selectedMod.module) : null;
  const configFields = modType ? (MODULE_CONFIG_FIELDS[modType] || []) : [];

  return (
    <div className="flex h-full">
      {/* Layout list sidebar */}
      <div className="w-56 border-r border-gray-800 bg-gray-900/50 p-4 overflow-y-auto hide-scrollbar shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Layouts</h2>
          <button
            onClick={handleNewLayout}
            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
          >
            + New
          </button>
        </div>
        <div className="space-y-1">
          {layouts.map((layout) => (
            <button
              key={layout.id}
              onClick={() => setSelectedId(layout.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedId === layout.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {layout.name}
            </button>
          ))}
          {layouts.length === 0 && (
            <p className="text-gray-600 text-sm px-3">No layouts yet</p>
          )}
        </div>
      </div>

      {/* Main editor area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {selectedLayout ? (
          <>
            {/* Top bar: layout name + controls */}
            <div className="px-6 py-4 border-b border-gray-800 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <input
                  type="text"
                  value={selectedLayout.name || ''}
                  onChange={(e) => updateLayout({ name: e.target.value })}
                  className="text-xl font-bold bg-transparent text-white border-none outline-none flex-1 mr-4"
                  placeholder="Layout name"
                />
                <button
                  onClick={handleDeleteLayout}
                  className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm rounded-lg transition-colors shrink-0"
                >
                  Delete
                </button>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Rows</label>
                  <input
                    type="number" min="1" max="12"
                    value={gridRows}
                    onChange={(e) => updateLayout({ grid_rows: parseInt(e.target.value) || 3 })}
                    className="w-14 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Cols</label>
                  <input
                    type="number" min="1" max="12"
                    value={gridCols}
                    onChange={(e) => updateLayout({ grid_columns: parseInt(e.target.value) || 4 })}
                    className="w-14 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">BG</label>
                  <input
                    type="color"
                    value={selectedLayout.background || '#000000'}
                    onChange={(e) => updateLayout({ background: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer border border-gray-700"
                  />
                </div>
                <button
                  onClick={() => { setPlacingCell(null); setShowModulePicker(true); }}
                  className="ml-auto px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  + Add Module
                </button>
              </div>
            </div>

            {/* Grid + Config panel */}
            <div className="flex-1 flex overflow-hidden">
              {/* Grid preview area */}
              <div className="flex-1 p-6 overflow-auto hide-scrollbar">
                <div className="mb-3 text-xs text-gray-500">
                  Click an empty cell to place a module. Click a module to select it.
                </div>
                <div
                  className="border border-gray-700 rounded-lg overflow-hidden"
                  style={{
                    display: 'grid',
                    gridTemplateRows: `repeat(${gridRows}, minmax(80px, 1fr))`,
                    gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                    background: selectedLayout.background || '#000000',
                    gap: '2px',
                    aspectRatio: `${gridCols} / ${gridRows}`,
                    maxHeight: '60vh',
                  }}
                >
                  {/* Placed modules */}
                  {modules.map((mod, i) => (
                    <div
                      key={mod.id || i}
                      onClick={() => {
                        setSelectedModule(i);
                        setModuleConfigJson(JSON.stringify(mod.config || {}, null, 2));
                      }}
                      className={`relative cursor-pointer transition-all overflow-hidden ${
                        selectedModule === i
                          ? 'ring-2 ring-blue-500 ring-inset z-10'
                          : 'hover:ring-1 hover:ring-gray-500 hover:ring-inset'
                      }`}
                      style={{
                        gridRow: `${(mod.y || 0) + 1} / span ${mod.h || 1}`,
                        gridColumn: `${(mod.x || 0) + 1} / span ${mod.w || 1}`
                      }}
                    >
                      <ModuleRenderer type={mod.type || mod.module_type || mod.module} config={mod.config || {}} />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-0.5">
                        <span className="text-xs text-gray-300 font-medium">
                          {mod.type || mod.module_type || mod.module}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Empty cells for click-to-place */}
                  {Array.from({ length: gridRows * gridCols }).map((_, i) => {
                    const cellRow = Math.floor(i / gridCols);
                    const cellCol = i % gridCols;
                    const isOccupied = modules.some(
                      (m) =>
                        cellCol >= (m.x || 0) &&
                        cellCol < (m.x || 0) + (m.w || 1) &&
                        cellRow >= (m.y || 0) &&
                        cellRow < (m.y || 0) + (m.h || 1)
                    );
                    if (isOccupied) return null;
                    return (
                      <div
                        key={`empty-${i}`}
                        onClick={() => handleCellClick(cellRow, cellCol)}
                        className="bg-gray-900/30 border border-dashed border-gray-800 hover:bg-blue-900/20 hover:border-blue-700 cursor-pointer transition-colors flex items-center justify-center"
                        style={{
                          gridRow: `${cellRow + 1}`,
                          gridColumn: `${cellCol + 1}`
                        }}
                      >
                        <span className="text-gray-700 text-xs">+</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Module config panel */}
              {selectedMod && (
                <div className="w-72 border-l border-gray-800 bg-gray-900/50 overflow-y-auto hide-scrollbar shrink-0">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-white capitalize">
                        {modType}
                      </h3>
                      <button
                        onClick={() => removeModule(selectedModule)}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        Remove
                      </button>
                    </div>

                    {/* Placement controls */}
                    <div className="mb-4">
                      <h4 className="text-xs text-gray-500 uppercase mb-2">Position & Size</h4>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { field: 'x', label: 'Col' },
                          { field: 'y', label: 'Row' },
                          { field: 'w', label: 'W' },
                          { field: 'h', label: 'H' },
                        ].map(({ field, label }) => (
                          <div key={field}>
                            <label className="text-xs text-gray-600">{label}</label>
                            <input
                              type="number" min={field === 'w' || field === 'h' ? 1 : 0}
                              value={selectedMod[field] || (field === 'w' || field === 'h' ? 1 : 0)}
                              onChange={(e) => updateModulePlacement(selectedModule, field, e.target.value)}
                              className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Module-specific config fields */}
                    {configFields.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-xs text-gray-500 uppercase mb-2">Configuration</h4>
                        <div className="space-y-3">
                          {configFields.map((field) => (
                            <ConfigField
                              key={field.key}
                              field={field}
                              value={selectedMod.config?.[field.key]}
                              onChange={(val) => updateModuleConfigField(selectedModule, field.key, val)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* JSON editor toggle */}
                    <div className="border-t border-gray-800 pt-3">
                      <button
                        onClick={() => {
                          setShowJsonEditor(!showJsonEditor);
                          setModuleConfigJson(JSON.stringify(selectedMod.config || {}, null, 2));
                        }}
                        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        {showJsonEditor ? 'Hide' : 'Show'} JSON Editor
                      </button>
                      {showJsonEditor && (
                        <div className="mt-2">
                          <textarea
                            value={moduleConfigJson}
                            onChange={(e) => setModuleConfigJson(e.target.value)}
                            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                            rows={6}
                          />
                          <button
                            onClick={() => {
                              try {
                                const config = JSON.parse(moduleConfigJson);
                                const newModules = [...modules];
                                newModules[selectedModule] = { ...newModules[selectedModule], config };
                                updateModules(newModules);
                              } catch {
                                alert('Invalid JSON');
                              }
                            }}
                            className="mt-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                          >
                            Apply JSON
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Select a layout or create a new one</p>
          </div>
        )}
      </div>

      {/* Module Picker Modal */}
      {showModulePicker && (
        <ModulePicker
          onSelect={handleModuleSelect}
          onClose={() => { setShowModulePicker(false); setPlacingCell(null); }}
        />
      )}
    </div>
  );
}
