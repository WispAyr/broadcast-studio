import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../lib/api';
import ModulePicker from '../../components/ModulePicker';
import ModuleRenderer from '../../components/ModuleRenderer';
import MediaPicker from '../../components/MediaPicker';
import { getLayers, layersToStorage, createLayer, BLEND_MODES, CHROMA_PRESETS } from '../../lib/layers';
import { RemotionModuleConfig } from '../../modules/RemotionModule';

// ─── Module type icons ──────────────────────────────────────────────────────
const MODULE_ICONS = {
  clock: '🕐', countdown: '⏱', text: '📝', image: '🖼', video: '🎬',
  ticker: '📜', iframe: '🔗', weather: '🌤', color: '🎨', logo: '🏷',
  autocue: '📺', social: '📱', breaking_news: '🚨', travel: '🚗',
  weather_radar: '🌧', aircraft_tracker: '✈️', camera_feed: '📷',
  alert_ticker: '🔔', time_local: '🕰', rss_feed: '📰', news_ticker: '📡',
  social_embed: '💬', web_source: '🌐', youtube_player: '▶️', news_tv: '📺',
  nar_schedule: '📅', nar_news: '📰', nar_sport: '⚽', nar_partners: '🤝',
  travel_screen: '🗺', travel_times: '⏰',
  slideshow: '🎞', live_text: '💬', qrcode: '📱',
  visualizer: '🎵',
  remotion: '🎬',
  canva: '🎨',
};

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
    { key: 'labelTop', label: 'Label Above', type: 'text', default: '' },
    { key: 'labelBottom', label: 'Label Below', type: 'text', default: '' },
    { key: 'fontSize', label: 'Font Size', type: 'text', default: '' },
    { key: 'expiredText', label: 'Expired Text', type: 'text', default: 'NOW' },
    { key: 'color', label: 'Color', type: 'color', default: '#ffffff' },
    { key: 'background', label: 'Background', type: 'text', default: '' },
  ],
  text: [
    { key: 'text', label: 'Text', type: 'textarea', default: '' },
    { key: 'subtitle', label: 'Subtitle', type: 'text', default: '' },
    { key: 'style', label: 'Style', type: 'select', options: ['default', 'lower-third', 'name-title', 'headline'], default: 'default' },
    { key: 'fontFamily', label: 'Font', type: 'select', options: [
      '1994 Stencil (Black Ops One)',
      'Inter', 'Roboto', 'Montserrat', 'Oswald', 'Poppins',
      'Bebas Neue', 'Raleway', 'Playfair Display', 'Anton', 'Bangers',
      'Russo One', 'Orbitron', 'Rajdhani', 'Teko',
      'Permanent Marker', 'Press Start 2P', 'Audiowide', 'Righteous',
    ], default: 'Inter' },
    { key: 'fontSize', label: 'Font Size', type: 'text', default: '1.5rem' },
    { key: 'fontWeight', label: 'Weight', type: 'select', options: ['100', '200', '300', '400', '500', '600', '700', '800', '900'], default: '700' },
    { key: 'align', label: 'H Align', type: 'select', options: ['left', 'center', 'right'], default: 'center' },
    { key: 'vertAlign', label: 'V Align', type: 'select', options: ['top', 'center', 'bottom'], default: 'center' },
    { key: 'letterSpacing', label: 'Letter Spacing', type: 'text', default: '0' },
    { key: 'lineHeight', label: 'Line Height', type: 'text', default: '1.2' },
    { key: 'wordSpacing', label: 'Word Spacing', type: 'text', default: '0' },
    { key: 'textTransform', label: 'Transform', type: 'select', options: ['none', 'uppercase', 'lowercase', 'capitalize'], default: 'none' },
    { key: 'color', label: 'Color', type: 'color', default: '#ffffff' },
    { key: 'accentColor', label: 'Accent', type: 'color', default: '#3b82f6' },
    { key: 'background', label: 'Background', type: 'color', default: '#000000' },
    { key: 'textShadow', label: 'Text Shadow', type: 'text', default: '' },
    { key: 'stroke', label: 'Stroke Color', type: 'color', default: '' },
    { key: 'strokeWidth', label: 'Stroke Width', type: 'number', default: 0 },
    { key: 'padding', label: 'Padding', type: 'text', default: '1rem' },
    { key: 'motion', label: 'Motion', type: 'select', options: [
      'none', 'pulse', 'breathe', 'fadeIn', 'slideUp', 'slideDown',
      'slideLeft', 'slideRight', 'scaleIn', 'typewriter', 'glitch', 'glow',
    ], default: 'none' },
    { key: 'motionSpeed', label: 'Motion Speed', type: 'select', options: ['slow', 'normal', 'fast'], default: 'normal' },
    { key: 'noSafeZone', label: 'Disable Safe Zone (no padding/wrap)', type: 'checkbox', default: false },
    { key: 'whiteSpace', label: 'White Space', type: 'select', options: ['normal', 'nowrap', 'pre', 'pre-wrap'], default: 'nowrap' },
    { key: 'overflow', label: 'Overflow', type: 'select', options: ['hidden', 'visible'], default: 'visible' },
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
      { value: 'UTC', label: '🌐 UTC' },
      { value: 'America/New_York', label: '🇺🇸 New York (EST/EDT)' },
      { value: 'America/Los_Angeles', label: '🇺🇸 Los Angeles (PST/PDT)' },
      { value: 'Asia/Tokyo', label: '🇯🇵 Tokyo (JST)' },
    ], default: '' },
    { key: 'label', label: 'Display Label', type: 'text', default: '' },
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
  news_tv: [
    { key: 'defaultChannel', label: 'Default Channel', type: 'select', options: [
      { value: 'sky-news', label: '🔵 Sky News' },
      { value: 'bbc-news', label: '🔴 BBC News' },
      { value: 'gb-news', label: '🟠 GB News' },
    ], default: 'sky-news' },
    { key: 'mute', label: 'Muted', type: 'checkbox', default: true },
    { key: 'showChannelBar', label: 'Show Channel Bar', type: 'checkbox', default: true },
    { key: 'autoRotate', label: 'Auto-Rotate Channels', type: 'checkbox', default: false },
    { key: 'title', label: 'Title', type: 'text', default: 'NEWS' },
  ],
  nar_schedule: [
    { key: 'accentColor', label: 'Accent Color', type: 'color', default: '#e11d48' },
    { key: 'title', label: 'Title', type: 'text', default: 'NOW AYRSHIRE RADIO' },
    { key: 'showThumbnails', label: 'Show Thumbnails', type: 'checkbox', default: true },
    { key: 'background', label: 'Background', type: 'color', default: '#000000' },
  ],
  nar_news: [
    { key: 'categories', label: 'Category', type: 'select', options: [
      { value: 'news', label: '📰 News' },
      { value: 'sport', label: '⚽ Sport' },
      { value: 'all', label: '📰⚽ News & Sport' },
    ], default: 'news' },
    { key: 'layout', label: 'Layout', type: 'select', options: [
      { value: 'list', label: '📋 List' },
      { value: 'hero', label: '🖼 Hero' },
      { value: 'ticker', label: '📜 Ticker' },
    ], default: 'list' },
    { key: 'maxItems', label: 'Max Items', type: 'number', default: 8 },
    { key: 'background', label: 'Background', type: 'color', default: '#000000' },
  ],
  nar_partners: [
    { key: 'layout', label: 'Layout', type: 'select', options: [
      { value: 'grid', label: '⊞ Grid' },
      { value: 'single', label: '1️⃣ Single' },
      { value: 'strip', label: '➡️ Strip' },
    ], default: 'grid' },
    { key: 'title', label: 'Title', type: 'text', default: 'OUR PARTNERS' },
    { key: 'background', label: 'Background', type: 'color', default: '#000000' },
  ],
  travel_screen: [
    { key: 'title', label: 'Title', type: 'text', default: 'Ayrshire Travel' },
    { key: 'theme', label: 'Theme', type: 'select', options: ['dark', 'light'], default: 'dark' },
  ],
  slideshow: [
    { key: 'images', label: 'Image URLs (one per line)', type: 'textarea', default: '' },
    { key: 'interval', label: 'Interval (ms)', type: 'number', default: 5000 },
    { key: 'transition', label: 'Transition', type: 'select', options: ['fade', 'slide', 'zoom'], default: 'fade' },
    { key: 'transitionDuration', label: 'Transition Duration (ms)', type: 'number', default: 1000 },
    { key: 'fit', label: 'Fit', type: 'select', options: ['cover', 'contain'], default: 'cover' },
    { key: 'kenBurns', label: 'Ken Burns Effect', type: 'checkbox', default: true },
  ],
  live_text: [
    { key: 'text', label: 'Text', type: 'textarea', default: '' },
    { key: 'subtitle', label: 'Subtitle', type: 'text', default: '' },
    { key: 'style', label: 'Style', type: 'select', options: [
      { value: 'lower-third', label: '📺 Lower Third' },
      { value: 'fullscreen', label: '🖥 Fullscreen' },
      { value: 'banner', label: '📜 Scrolling Banner' },
    ], default: 'lower-third' },
    { key: 'align', label: 'Align', type: 'select', options: ['left', 'center', 'right'], default: 'left' },
    { key: 'color', label: 'Color', type: 'color', default: '#ffffff' },
    { key: 'background', label: 'Background', type: 'color', default: 'rgba(0,0,0,0.7)' },
    { key: 'accentColor', label: 'Accent Color', type: 'color', default: '#3b82f6' },
  ],
  qrcode: [
    { key: 'url', label: 'URL', type: 'text', default: 'https://example.com' },
    { key: 'label', label: 'Label', type: 'text', default: '' },
    { key: 'size', label: 'QR Size (px)', type: 'number', default: 300 },
    { key: 'color', label: 'QR Color', type: 'color', default: '#ffffff' },
    { key: 'background', label: 'Background', type: 'color', default: '#000000' },
    { key: 'showUrl', label: 'Show URL Text', type: 'checkbox', default: true },
  ],
  travel_times: [
    { key: 'layout', label: 'Layout', type: 'select', options: [
      { value: 'list', label: '📋 List' },
      { value: 'grid', label: '⊞ Grid' },
    ], default: 'list' },
    { key: 'title', label: 'Title', type: 'text', default: 'TRAVEL TIMES' },
    { key: 'background', label: 'Background', type: 'color', default: '#000000' },
  ],
  visualizer: [
    { key: 'mode', label: 'Visual Mode', type: 'select', options: [
      { value: 'bars', label: '📊 Bars — classic frequency bars' },
      { value: 'circular', label: '🔵 Circular — radial frequency ring' },
      { value: 'wave', label: '🌊 Wave — flowing oscilloscope' },
      { value: 'particles', label: '✨ Particles — reactive particle field' },
      { value: 'spectrum', label: '🌈 Spectrum — full-width gradient' },
      { value: 'blob', label: '🔮 Morphing Blob — 3D reactive geometry' },
    ], default: 'bars' },
    { key: 'audioSource', label: 'Audio Source', type: 'select', options: [
      { value: 'auto', label: '🔄 Auto — try mic, fallback to network' },
      { value: 'microphone', label: '🎤 Microphone — capture live audio' },
      { value: 'network', label: '🔗 Network — sync from another screen' },
    ], default: 'auto' },
    { key: 'theme', label: 'Color Theme', type: 'select', options: [
      { value: 'neon', label: '💎 Neon — cyan/magenta/purple' },
      { value: 'fire', label: '🔥 Fire — red/orange/yellow' },
      { value: 'ocean', label: '🌊 Ocean — blue/teal/green' },
      { value: 'mono', label: '⬜ Mono — single color' },
      { value: 'rainbow', label: '🌈 Rainbow — HSL cycle' },
    ], default: 'neon' },
    { key: 'monoColor', label: 'Mono Color', type: 'color', default: '#00ffff' },
    { key: 'sensitivity', label: 'Sensitivity', type: 'number', default: 1.5 },
    { key: 'smoothing', label: 'Smoothing (0-1)', type: 'number', default: 0.8 },
    { key: 'barCount', label: 'Bar Count', type: 'number', default: 64 },
    { key: 'mirror', label: 'Mirror Bars', type: 'checkbox', default: false },
    { key: 'showReflection', label: 'Show Reflection', type: 'checkbox', default: true },
    { key: 'glowIntensity', label: 'Glow Intensity', type: 'number', default: 15 },
    { key: 'rotationSpeed', label: 'Rotation Speed', type: 'number', default: 0.5 },
    { key: 'backgroundColor', label: 'Background Color', type: 'color', default: '#000000' },
    { key: 'backgroundOpacity', label: 'Background Opacity (0-1)', type: 'number', default: 0 },
    { key: 'idleAnimation', label: 'Idle Animation', type: 'checkbox', default: true },
  ],
  canva: [
    { key: 'embedUrl', label: 'Canva Design URL', type: 'text', default: '' },
    { key: 'mode', label: 'Mode', type: 'select', options: ['embed', 'image', 'video', 'live-presentation'], default: 'embed' },
    { key: 'fit', label: 'Fit', type: 'select', options: ['contain', 'cover', 'fill'], default: 'cover' },
    { key: 'background', label: 'Background', type: 'color', default: '#000000' },
    { key: 'loopDuration', label: 'Loop Animation (seconds, 0=off)', type: 'number', default: 0 },
    { key: 'refreshInterval', label: 'Refresh Content (seconds, 0=off)', type: 'number', default: 0 },
    { key: 'interactable', label: 'Allow Interaction', type: 'checkbox', default: false },
  ],
};

// ─── Config field renderer ──────────────────────────────────────────────────
function ConfigField({ field, value, onChange }) {
  const val = value !== undefined ? value : field.default;
  const [pickerOpen, setPickerOpen] = useState(false);
  const isMediaField = /^(src|image|url|video|logo)$/i.test(field.key) || /src|image|url|video|logo/i.test(field.key);
  const isSlideshowImages = field.key === 'images' && field.type === 'textarea';

  switch (field.type) {
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={!!val}
            onChange={(e) => onChange(e.target.checked)}
            className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{field.label}</span>
        </label>
      );
    case 'select':
      return (
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">{field.label}</label>
          <select
            value={val || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-2 py-1.5 bg-gray-800/80 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
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
          <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">{field.label}</label>
          <textarea
            value={val || ''}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className="w-full px-2 py-1.5 bg-gray-800/80 border border-gray-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
          />
          {isSlideshowImages && (
            <>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="mt-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg transition-colors"
              >📁 Add from Media Library</button>
              <MediaPicker
                open={pickerOpen}
                onClose={() => setPickerOpen(false)}
                multiple={true}
                onSelect={(urls) => {
                  const current = val || '';
                  const newVal = current ? current.trimEnd() + '\n' + urls.join('\n') : urls.join('\n');
                  onChange(newVal);
                }}
              />
            </>
          )}
        </div>
      );
    case 'color':
      return (
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">{field.label}</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={val || '#000000'}
              onChange={(e) => onChange(e.target.value)}
              className="w-8 h-8 rounded-lg cursor-pointer border border-gray-700 bg-gray-800"
            />
            <input
              type="text"
              value={val || ''}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1 px-2 py-1 bg-gray-800/80 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>
        </div>
      );
    case 'number':
      return (
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">{field.label}</label>
          <input
            type="number"
            value={val ?? ''}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full px-2 py-1.5 bg-gray-800/80 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
          />
        </div>
      );
    default:
      return (
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">{field.label}</label>
          <div className="flex gap-1">
            <input
              type="text"
              value={val || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder || ''}
              className="flex-1 px-2 py-1.5 bg-gray-800/80 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all placeholder:text-gray-600"
            />
            {isMediaField && (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg transition-colors shrink-0"
                title="Browse Media"
              >📁</button>
            )}
          </div>
          {isMediaField && (
            <MediaPicker
              open={pickerOpen}
              onClose={() => setPickerOpen(false)}
              onSelect={(url) => onChange(url)}
            />
          )}
        </div>
      );
  }
}

// ─── Collapsible section ────────────────────────────────────────────────────
function CollapsibleSection({ title, icon, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-800/60 hover:bg-gray-800 transition-colors text-left"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {icon && <span>{icon}</span>}
          {title}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="p-3 space-y-3 bg-gray-900/40">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Context menu ───────────────────────────────────────────────────────────
function ContextMenu({ x, y, onRename, onDuplicate, onDelete, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[160px] bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-xl shadow-2xl py-1 overflow-hidden"
      style={{ top: y, left: x }}
    >
      <button
        onClick={onRename}
        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-300 hover:bg-blue-600/20 hover:text-white transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Rename
      </button>
      <button
        onClick={onDuplicate}
        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-300 hover:bg-blue-600/20 hover:text-white transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        Duplicate
      </button>
      <div className="border-t border-gray-800 my-1" />
      <button
        onClick={onDelete}
        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-400 hover:bg-red-600/20 hover:text-red-300 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Delete
      </button>
    </div>
  );
}

// ─── Layout thumbnail mini-preview ─────────────────────────────────────────
function LayoutThumbnail({ gridCols, gridRows }) {
  const cols = Math.min(gridCols || 3, 6);
  const rows = Math.min(gridRows || 2, 4);
  return (
    <div
      className="w-10 h-7 rounded border border-gray-700 overflow-hidden bg-gray-950 shrink-0"
      style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, gap: '1px' }}
    >
      {Array.from({ length: cols * rows }).map((_, i) => (
        <div key={i} className="bg-gray-800/70 rounded-sm" />
      ))}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────
export default function Layouts() {
  const [layouts, setLayouts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedLayout, setSelectedLayout] = useState(null);
  const [modules, setModules] = useState([]);
  const [layers, setLayers] = useState([]);
  const [activeLayerId, setActiveLayerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModulePicker, setShowModulePicker] = useState(false);
  const [placingCell, setPlacingCell] = useState(null);
  const [selectedModule, setSelectedModule] = useState(null);
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [moduleConfigJson, setModuleConfigJson] = useState('{}');
  const [renamingLayerId, setRenamingLayerId] = useState(null);
  const [layerRenameValue, setLayerRenameValue] = useState('');
  const layerRenameRef = useRef(null);

  // Screen orientation & preview scaling
  const [screenOrientation, setScreenOrientation] = useState('landscape'); // 'landscape' | 'portrait'
  const previewW = screenOrientation === 'portrait' ? 1080 : 1920;
  const previewH = screenOrientation === 'portrait' ? 1920 : 1080;
  const previewContainerRef = useRef(null);
  const [previewScale, setPreviewScale] = useState(0.4);
  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const s = Math.min(width / previewW, height / previewH, 1);
        setPreviewScale(s * 0.95);
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [selectedId, screenOrientation, previewW, previewH]);

  // Inline rename state
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState(null); // { x, y, layoutId }

  const saveTimer = useRef(null);

  async function fetchLayouts() {
    try {
      const data = await api.get('/layouts');
      const arr = Array.isArray(data) ? data : Array.isArray(data?.layouts) ? data.layouts : [];
      setLayouts(arr);
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
          const parsedLayers = getLayers(parsedModules);
          setLayers(parsedLayers);
          // Set active layer to first one
          setActiveLayerId(parsedLayers[0]?.id || null);
          // Keep flat modules for backward compat reference
          setModules(parsedLayers.flatMap(l => l.modules || []));
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
    const apiUpdates = { ...updates };
    if (apiUpdates.grid_columns !== undefined) {
      apiUpdates.grid_cols = apiUpdates.grid_columns;
      delete apiUpdates.grid_columns;
    }
    autoSave(apiUpdates);
  }

  function updateModules(newModules) {
    // Update the active layer's modules and save all layers
    const newLayers = layers.map(l =>
      l.id === activeLayerId ? { ...l, modules: newModules } : l
    );
    setLayers(newLayers);
    setModules(newModules);
    autoSave({ modules: layersToStorage(newLayers) });
  }

  function updateLayers(newLayers) {
    setLayers(newLayers);
    const activeLayer = newLayers.find(l => l.id === activeLayerId);
    if (activeLayer) setModules(activeLayer.modules || []);
    autoSave({ modules: layersToStorage(newLayers) });
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

  async function handleDeleteLayout(id) {
    const targetId = id || selectedId;
    if (!targetId || !confirm('Delete this layout?')) return;
    try {
      await api.delete(`/layouts/${targetId}`);
      if (targetId === selectedId) {
        setSelectedId(null);
        setSelectedLayout(null);
        setModules([]);
      }
      fetchLayouts();
    } catch (err) {
      alert('Failed to delete layout: ' + err.message);
    }
  }

  async function handleDuplicateLayout(id) {
    const layout = layouts.find(l => l.id === id);
    if (!layout) return;
    try {
      const full = await api.get(`/layouts/${id}`);
      const src = full.layout || full;
      const data = await api.post('/layouts', {
        name: `${src.name || 'Layout'} (copy)`,
        grid_rows: src.grid_rows || 3,
        grid_cols: src.grid_cols || 4,
        background: src.background || '#000000',
        modules: src.modules || [],
      });
      fetchLayouts();
      setSelectedId(data.layout?.id || data.id);
    } catch (err) {
      alert('Failed to duplicate layout: ' + err.message);
    }
  }

  // Inline rename
  function startRename(id, currentName) {
    setRenamingId(id);
    setRenameValue(currentName || '');
    setTimeout(() => renameInputRef.current?.focus(), 50);
  }

  async function commitRename() {
    if (!renamingId) return;
    const name = renameValue.trim() || 'Untitled Layout';
    try {
      await api.put(`/layouts/${renamingId}`, { name });
      setLayouts(prev => prev.map(l => l.id === renamingId ? { ...l, name } : l));
      if (renamingId === selectedId) {
        setSelectedLayout(prev => prev ? { ...prev, name } : prev);
      }
    } catch (err) {
      console.error('Rename failed:', err);
    }
    setRenamingId(null);
  }

  function handleRenameKeyDown(e) {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') setRenamingId(null);
  }

  function handleContextMenu(e, layoutId) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, layoutId });
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
    // Don't allow placing on locked layers
    if (showModulePicker) return; // Prevent re-triggering while picker is open
    const activeLayer = layers.find(l => l.id === activeLayerId);
    if (activeLayer?.locked) return;
    setPlacingCell({ row, col });
    setShowModulePicker(true);
  }

  function selectLayer(layerId) {
    setActiveLayerId(layerId);
    const layer = layers.find(l => l.id === layerId);
    setModules(layer?.modules || []);
    setSelectedModule(null);
  }

  const gridRows = selectedLayout?.grid_rows || 3;
  const gridCols = selectedLayout?.grid_columns || selectedLayout?.grid_cols || 4;

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Loading layouts…</p>
        </div>
      </div>
    );
  }

  const selectedMod = selectedModule !== null ? modules[selectedModule] : null;
  const modType = selectedMod ? (selectedMod.type || selectedMod.module_type || selectedMod.module) : null;
  const configFields = modType ? (MODULE_CONFIG_FIELDS[modType] || []) : [];

  return (
    <div className="flex h-full" onClick={() => setContextMenu(null)}>

      {/* ── Layout list sidebar ─────────────────────────────────────── */}
      <div className="w-60 border-r border-gray-800 flex flex-col shrink-0"
        style={{ background: 'linear-gradient(180deg, #0f1219 0%, #0d1117 100%)' }}>

        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-800/60">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-blue-400/70 uppercase tracking-widest font-semibold mb-0.5">Broadcast Studio</p>
              <h2 className="text-sm font-bold text-white">Layouts</h2>
            </div>
            <button
              onClick={handleNewLayout}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-all shadow-lg shadow-blue-900/30 hover:shadow-blue-800/40"
              title="New layout"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              New
            </button>
          </div>
        </div>

        {/* Layout list */}
        <div className="flex-1 overflow-y-auto hide-scrollbar px-2 py-2 space-y-1">
          {layouts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center px-3">
              <div className="w-10 h-10 rounded-xl bg-gray-800/60 flex items-center justify-center mb-3 text-xl">⬛</div>
              <p className="text-gray-500 text-xs">No layouts yet</p>
              <p className="text-gray-600 text-xs mt-1">Click <strong className="text-gray-500">New</strong> to get started</p>
            </div>
          )}

          {layouts.map((layout) => {
            const isActive = selectedId === layout.id;
            const isRenaming = renamingId === layout.id;
            const icon = '⬛';

            return (
              <div
                key={layout.id}
                onContextMenu={(e) => handleContextMenu(e, layout.id)}
                className={`group relative rounded-xl transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-blue-600/20 ring-1 ring-blue-500/40'
                    : 'hover:bg-gray-800/60'
                }`}
              >
                <div
                  className="flex items-center gap-2.5 px-3 py-2.5"
                  onClick={() => !isRenaming && setSelectedId(layout.id)}
                  onDoubleClick={() => startRename(layout.id, layout.name)}
                >
                  <LayoutThumbnail gridCols={layout.grid_cols} gridRows={layout.grid_rows} />

                  <div className="flex-1 min-w-0">
                    {isRenaming ? (
                      <input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={handleRenameKeyDown}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-gray-800 border border-blue-500 rounded px-1.5 py-0.5 text-white text-sm focus:outline-none"
                      />
                    ) : (
                      <p className={`text-sm font-medium truncate leading-tight transition-colors ${
                        isActive ? 'text-white' : 'text-gray-300 group-hover:text-white'
                      }`}>
                        {layout.name || 'Untitled'}
                      </p>
                    )}
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      {layout.grid_cols || '?'}×{layout.grid_rows || '?'} grid
                    </p>
                  </div>

                  {/* Context menu trigger */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleContextMenu(e, layout.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-all"
                    title="More options"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
                    </svg>
                  </button>
                </div>

                {/* Active indicator */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-500 rounded-r" />
                )}
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-3 border-t border-gray-800/60">
          <p className="text-[10px] text-gray-700">Double-click to rename · Right-click for options</p>
        </div>
      </div>

      {/* ── Main editor area ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gray-950">
        {selectedLayout ? (
          <>
            {/* Top bar */}
            <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/40 shrink-0">
              <div className="flex items-center justify-between mb-3">
                {/* Editable layout name with pencil hint */}
                <div className="group flex items-center gap-2 flex-1 mr-4">
                  <input
                    type="text"
                    value={selectedLayout.name || ''}
                    onChange={(e) => updateLayout({ name: e.target.value })}
                    className="text-xl font-bold bg-transparent text-white border-none outline-none flex-1 border-b border-transparent group-hover:border-gray-600 focus:border-blue-500 transition-all pb-0.5"
                    placeholder="Layout name"
                  />
                  <svg className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
                <button
                  onClick={() => handleDeleteLayout()}
                  className="px-3 py-1.5 bg-red-600/10 hover:bg-red-600/25 text-red-400 hover:text-red-300 text-sm rounded-lg transition-all border border-red-900/30 shrink-0"
                >
                  Delete
                </button>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-3 py-1.5 border border-gray-700/50">
                  <label className="text-xs text-gray-500">Rows</label>
                  <input
                    type="number" min="1" max="12"
                    value={gridRows}
                    onChange={(e) => updateLayout({ grid_rows: parseInt(e.target.value) || 3 })}
                    className="w-12 bg-transparent text-white text-sm focus:outline-none text-center"
                  />
                </div>
                <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-3 py-1.5 border border-gray-700/50">
                  <label className="text-xs text-gray-500">Cols</label>
                  <input
                    type="number" min="1" max="12"
                    value={gridCols}
                    onChange={(e) => updateLayout({ grid_columns: parseInt(e.target.value) || 4 })}
                    className="w-12 bg-transparent text-white text-sm focus:outline-none text-center"
                  />
                </div>
                <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-3 py-1.5 border border-gray-700/50">
                  <label className="text-xs text-gray-500">BG</label>
                  <input
                    type="color"
                    value={selectedLayout.background || '#000000'}
                    onChange={(e) => updateLayout({ background: e.target.value })}
                    className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                  />
                  <span className="text-xs text-gray-500 font-mono">{selectedLayout.background || '#000000'}</span>
                </div>
                <div className="flex items-center gap-1 bg-gray-800/50 rounded-lg px-1 py-0.5 border border-gray-700/50">
                  <button
                    onClick={() => setScreenOrientation('landscape')}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${screenOrientation === 'landscape' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    title="Landscape (16:9)"
                  >⬜ 16:9</button>
                  <button
                    onClick={() => setScreenOrientation('portrait')}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${screenOrientation === 'portrait' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    title="Portrait (9:16)"
                  >▯ 9:16</button>
                </div>
                <button
                  onClick={() => { setPlacingCell(null); setShowModulePicker(true); }}
                  className="ml-auto flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-blue-900/30"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Module
                </button>
              </div>
            </div>

            {/* Grid + Config panel */}
            <div className="flex-1 flex overflow-hidden">

              {/* ── Layer panel ──────────────────────────────────────── */}
              <div className="w-56 border-r border-gray-800 bg-gray-900/60 flex flex-col shrink-0 overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-800/60 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Layers</span>
                  <button
                    onClick={() => {
                      const newLayer = createLayer('Layer ' + (layers.length + 1), layers.length);
                      const newLayers = [...layers, newLayer];
                      updateLayers(newLayers);
                      setActiveLayerId(newLayer.id);
                      setModules([]);
                      setSelectedModule(null);
                    }}
                    className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-semibold rounded transition-colors"
                  >+ Layer</button>
                </div>
                <div className="flex-1 overflow-y-auto hide-scrollbar px-1 py-1 space-y-0.5">
                  {[...layers].sort((a, b) => b.order - a.order).map((layer) => {
                    const isActive = layer.id === activeLayerId;
                    const modCount = (layer.modules || []).length;
                    return (
                      <div
                        key={layer.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', layer.id);
                          e.dataTransfer.effectAllowed = 'move';
                          e.currentTarget.style.opacity = '0.4';
                        }}
                        onDragEnd={(e) => { e.currentTarget.style.opacity = '1'; }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          e.currentTarget.style.borderTop = '2px solid #3b82f6';
                        }}
                        onDragLeave={(e) => { e.currentTarget.style.borderTop = ''; }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.style.borderTop = '';
                          const draggedId = e.dataTransfer.getData('text/plain');
                          if (draggedId === layer.id) return;
                          const sorted = [...layers].sort((a, b) => b.order - a.order);
                          const draggedIdx = sorted.findIndex(l => l.id === draggedId);
                          const targetIdx = sorted.findIndex(l => l.id === layer.id);
                          if (draggedIdx === -1 || targetIdx === -1) return;
                          const reordered = [...sorted];
                          const [moved] = reordered.splice(draggedIdx, 1);
                          reordered.splice(targetIdx, 0, moved);
                          // Reassign order values (reversed since sorted high→low)
                          const newLayers = reordered.map((l, i) => ({ ...l, order: reordered.length - 1 - i }));
                          updateLayers(newLayers);
                        }}
                        onClick={() => selectLayer(layer.id)}
                        className={`group rounded-lg px-2 py-1.5 cursor-grab active:cursor-grabbing transition-all ${
                          isActive ? 'bg-blue-600/20 ring-1 ring-blue-500/40' : 'hover:bg-gray-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          {/* Visibility toggle */}
                          <button
                            onClick={(e) => { e.stopPropagation(); updateLayers(layers.map(l => l.id === layer.id ? { ...l, visible: !l.visible } : l)); }}
                            className={`p-0.5 rounded transition-colors ${layer.visible ? 'text-blue-400 hover:text-blue-300' : 'text-gray-600 hover:text-gray-400'}`}
                            title={layer.visible ? 'Hide layer' : 'Show layer'}
                          >
                            {layer.visible ? '👁' : '🚫'}
                          </button>
                          {/* Lock toggle */}
                          <button
                            onClick={(e) => { e.stopPropagation(); updateLayers(layers.map(l => l.id === layer.id ? { ...l, locked: !l.locked } : l)); }}
                            className={`p-0.5 rounded text-[10px] transition-colors ${layer.locked ? 'text-yellow-500' : 'text-gray-600 hover:text-gray-400'}`}
                            title={layer.locked ? 'Unlock layer' : 'Lock layer'}
                          >
                            {layer.locked ? '🔒' : '🔓'}
                          </button>
                          {/* Layer name */}
                          <div className="flex-1 min-w-0">
                            {renamingLayerId === layer.id ? (
                              <input
                                ref={layerRenameRef}
                                value={layerRenameValue}
                                onChange={(e) => setLayerRenameValue(e.target.value)}
                                onBlur={() => { updateLayers(layers.map(l => l.id === layer.id ? { ...l, name: layerRenameValue.trim() || 'Layer' } : l)); setRenamingLayerId(null); }}
                                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setRenamingLayerId(null); }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full bg-gray-800 border border-blue-500 rounded px-1 py-0 text-white text-xs focus:outline-none"
                                autoFocus
                              />
                            ) : (
                              <span
                                onDoubleClick={(e) => { e.stopPropagation(); setRenamingLayerId(layer.id); setLayerRenameValue(layer.name); }}
                                className={`text-xs font-medium truncate block ${isActive ? 'text-white' : 'text-gray-300'}`}
                              >{layer.name}</span>
                            )}
                          </div>
                          {/* Module count badge */}
                          <span className="text-[9px] text-gray-600 shrink-0">{modCount}</span>
                          {/* Delete layer */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (layers.length <= 1) return;
                              if (modCount > 0 && !confirm(`Delete "${layer.name}" with ${modCount} module(s)?`)) return;
                              const newLayers = layers.filter(l => l.id !== layer.id);
                              if (isActive) {
                                setActiveLayerId(newLayers[0]?.id || null);
                                setModules(newLayers[0]?.modules || []);
                              }
                              updateLayers(newLayers);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-red-400/60 hover:text-red-400 transition-all text-[10px]"
                            title="Delete layer"
                          >✕</button>
                        </div>
                        {/* Opacity & Blend mode (shown for active layer) */}
                        {isActive && (
                          <div className="mt-1.5 space-y-1 pl-1">
                            <div className="flex items-center gap-1.5">
                              <label className="text-[9px] text-gray-600 w-10 shrink-0">Opacity</label>
                              <input
                                type="range" min="0" max="100" step="1"
                                value={Math.round((layer.opacity ?? 1) * 100)}
                                onChange={(e) => updateLayers(layers.map(l => l.id === layer.id ? { ...l, opacity: parseInt(e.target.value) / 100 } : l))}
                                className="flex-1 h-1 accent-blue-500"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="text-[9px] text-gray-500 w-7 text-right">{Math.round((layer.opacity ?? 1) * 100)}%</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <label className="text-[9px] text-gray-600 w-10 shrink-0">Blend</label>
                              <select
                                value={layer.blendMode || 'normal'}
                                onChange={(e) => { e.stopPropagation(); updateLayers(layers.map(l => l.id === layer.id ? { ...l, blendMode: e.target.value } : l)); }}
                                onClick={(e) => e.stopPropagation()}
                                className="flex-1 bg-gray-800 border border-gray-700 rounded text-[10px] text-white px-1 py-0.5 focus:outline-none focus:border-blue-500"
                              >
                                {BLEND_MODES.map(bm => <option key={bm.value} value={bm.value}>{bm.label}</option>)}
                              </select>
                            </div>
                            {/* Chroma Key */}
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-gray-500 w-10">Key</span>
                              <select
                                value={layer.chromaKey || 'none'}
                                onChange={(e) => { e.stopPropagation(); updateLayers(layers.map(l => l.id === layer.id ? { ...l, chromaKey: e.target.value } : l)); }}
                                onClick={(e) => e.stopPropagation()}
                                className="flex-1 bg-gray-800 border border-gray-700 rounded text-[10px] text-white px-1 py-0.5 focus:outline-none focus:border-blue-500"
                              >
                                {CHROMA_PRESETS.map(cp => <option key={cp.value} value={cp.value}>{cp.label}</option>)}
                              </select>
                            </div>
                            {/* Chroma tolerance + custom color */}
                            {layer.chromaKey && layer.chromaKey !== 'none' && layer.chromaKey !== 'black' && (
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] text-gray-500 w-10">Tol</span>
                                <input
                                  type="range"
                                  min="0.05" max="0.8" step="0.05"
                                  value={layer.chromaTolerance ?? 0.35}
                                  onChange={(e) => { e.stopPropagation(); updateLayers(layers.map(l => l.id === layer.id ? { ...l, chromaTolerance: parseFloat(e.target.value) } : l)); }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex-1 h-1 accent-green-500"
                                />
                                <span className="text-[9px] text-gray-500 w-6 text-right">{Math.round((layer.chromaTolerance ?? 0.35) * 100)}%</span>
                              </div>
                            )}
                            {layer.chromaKey === 'custom' && (
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] text-gray-500 w-10">Color</span>
                                <input
                                  type="color"
                                  value={layer.chromaColor || '#00ff00'}
                                  onChange={(e) => { e.stopPropagation(); updateLayers(layers.map(l => l.id === layer.id ? { ...l, chromaColor: e.target.value } : l)); }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-6 h-5 rounded border border-gray-700 cursor-pointer"
                                />
                              </div>
                            )}
                            {/* Duplicate layer */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const dup = { ...layer, id: createLayer().id, name: layer.name + ' (copy)', modules: JSON.parse(JSON.stringify(layer.modules || [])), order: layers.length };
                                const newLayers = [...layers, dup];
                                updateLayers(newLayers);
                              }}
                              className="text-[9px] text-gray-500 hover:text-gray-300 transition-colors"
                            >⧉ Duplicate</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Grid preview area */}
              <div className="flex-1 p-4 overflow-hidden flex flex-col">
                <p className="text-xs text-gray-600 mb-2 shrink-0">
                  Click an empty cell to place a module · Click a module to configure it
                </p>
                <div className="flex-1 min-h-0 flex items-center justify-center" ref={previewContainerRef}>
                <div style={{
                  width: previewW * previewScale,
                  height: previewH * previewScale,
                  position: 'relative',
                }}>
                <div
                  className="border border-gray-800 rounded-xl overflow-hidden shadow-2xl relative"
                  style={{
                    background: selectedLayout.background || '#000000',
                    width: previewW,
                    height: previewH,
                    transform: `scale(${previewScale})`,
                    transformOrigin: 'top left',
                  }}
                >
                  {/* Render all layers composited */}
                  {[...layers].sort((a, b) => a.order - b.order).map((layer) => {
                    const isActive = layer.id === activeLayerId;
                    const layerMods = layer.modules || [];
                    if (!layer.visible && !isActive) return null;
                    return (
                      <div
                        key={layer.id}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          opacity: !layer.visible ? 0.15 : isActive ? (layer.opacity ?? 1) : (layer.opacity ?? 1) * 0.4,
                          mixBlendMode: layer.blendMode || 'normal',
                          zIndex: layer.order,
                          pointerEvents: isActive ? 'auto' : 'none',
                          display: 'grid',
                          gridTemplateRows: `repeat(${gridRows}, 1fr)`,
                          gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                          gap: '1px',
                        }}
                      >
                        {layerMods.map((mod, i) => {
                          const modTypeName = mod.type || mod.module_type || mod.module;
                          const icon = MODULE_ICONS[modTypeName] || '📦';
                          const isSelected = isActive && selectedModule === i;
                          return (
                            <div
                              key={mod.id || i}
                              onClick={() => {
                                if (!isActive) return;
                                setSelectedModule(i);
                                setModuleConfigJson(JSON.stringify(mod.config || {}, null, 2));
                              }}
                              className={`relative cursor-pointer transition-all overflow-hidden ${
                                isSelected
                                  ? 'ring-2 ring-blue-500 ring-inset z-10'
                                  : isActive ? 'hover:ring-1 hover:ring-blue-400/40 hover:ring-inset' : ''
                              }`}
                              style={{
                                gridRow: `${(mod.y || 0) + 1} / span ${mod.h || 1}`,
                                gridColumn: `${(mod.x || 0) + 1} / span ${mod.w || 1}`
                              }}
                            >
                              <ModuleRenderer type={modTypeName} config={mod.config || {}} />
                              {isActive && (
                                <div className="absolute bottom-0 left-0 right-0 flex items-center gap-1.5 px-2 py-1"
                                  style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.75))' }}>
                                  <span className="text-xs leading-none">{icon}</span>
                                  <span className="text-xs text-gray-200 font-medium truncate leading-none capitalize">
                                    {modTypeName?.replace(/_/g, ' ')}
                                  </span>
                                  {isSelected && (
                                    <span className="ml-auto text-[9px] text-blue-400 font-semibold uppercase tracking-wide leading-none shrink-0">Selected</span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}

                  {/* Empty cells for active layer */}
                  <div style={{
                    position: 'absolute', inset: 0, zIndex: 100,
                    display: 'grid',
                    gridTemplateRows: `repeat(${gridRows}, 1fr)`,
                    gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                    gap: '1px',
                    pointerEvents: 'none',
                  }}>
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
                          className="bg-gray-900/20 border border-dashed border-gray-800/50 hover:bg-blue-900/15 hover:border-blue-700/50 cursor-pointer transition-all flex items-center justify-center group"
                          style={{ gridRow: `${cellRow + 1}`, gridColumn: `${cellCol + 1}`, pointerEvents: 'auto' }}
                        >
                          <span className="text-gray-700 group-hover:text-blue-500/70 text-lg transition-colors">+</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                </div>
                </div>
              </div>

              {/* ── Module config panel ──────────────────────────────── */}
              {selectedMod && (
                <div className="w-72 border-l border-gray-800 bg-gray-900/60 overflow-y-auto hide-scrollbar shrink-0 backdrop-blur-sm">
                  <div className="p-4">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-800">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{MODULE_ICONS[modType] || '📦'}</span>
                        <div>
                          <h3 className="text-sm font-bold text-white capitalize leading-tight">
                            {modType?.replace(/_/g, ' ')}
                          </h3>
                          <p className="text-[10px] text-gray-600">Module #{selectedModule + 1}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeModule(selectedModule)}
                        className="p-1.5 text-red-400/70 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-all"
                        title="Remove module"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    {/* Position & size */}
                    <CollapsibleSection title="Position & Size" icon="⊞">
                      {/* Layer controls */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <label className="text-[10px] text-gray-600 block mb-1">Layer (z-order)</label>
                          <input
                            type="number" min={0}
                            value={selectedMod.layer || 0}
                            onChange={(e) => updateModulePlacement(selectedModule, 'layer', e.target.value)}
                            className="w-full px-1.5 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 text-center"
                          />
                        </div>
                        <div className="flex items-end pb-1">
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={!!selectedMod.fullscreen}
                              onChange={(e) => {
                                const newModules = [...modules];
                                newModules[selectedModule] = { ...newModules[selectedModule], fullscreen: e.target.checked };
                                updateModules(newModules);
                              }}
                              className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Fullscreen</span>
                          </label>
                        </div>
                      </div>
                      {/* Grid position (hidden when fullscreen) */}
                      {!selectedMod.fullscreen && (
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { field: 'x', label: 'Col' },
                            { field: 'y', label: 'Row' },
                            { field: 'w', label: 'W' },
                            { field: 'h', label: 'H' },
                          ].map(({ field, label }) => (
                            <div key={field}>
                              <label className="text-[10px] text-gray-600 block mb-1 text-center">{label}</label>
                              <input
                                type="number" min={field === 'w' || field === 'h' ? 1 : 0}
                                value={selectedMod[field] || (field === 'w' || field === 'h' ? 1 : 0)}
                                onChange={(e) => updateModulePlacement(selectedModule, field, e.target.value)}
                                className="w-full px-1.5 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 text-center"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                      {selectedMod.fullscreen && (
                        <p className="text-[10px] text-gray-600 italic">Grid position disabled — module fills entire screen</p>
                      )}
                    </CollapsibleSection>

                    {/* Module config */}
                    {configFields.length > 0 && (
                      <CollapsibleSection title="Configuration" icon="⚙️">
                        {configFields.map((field) => (
                          <ConfigField
                            key={field.key}
                            field={field}
                            value={selectedMod.config?.[field.key]}
                            onChange={(val) => updateModuleConfigField(selectedModule, field.key, val)}
                          />
                        ))}
                      </CollapsibleSection>
                    )}

                    {/* Remotion composition picker */}
                    {modType === 'remotion' && (
                      <CollapsibleSection title="Composition" icon="🎬" defaultOpen={true}>
                        <RemotionModuleConfig
                          config={selectedMod.config || {}}
                          onChange={(newConfig) => {
                            const newModules = [...modules];
                            newModules[selectedModule] = { ...newModules[selectedModule], config: newConfig };
                            updateModules(newModules);
                          }}
                        />
                      </CollapsibleSection>
                    )}

                    {/* JSON editor */}
                    <CollapsibleSection title="JSON Config" icon="{ }" defaultOpen={false}>
                      <textarea
                        value={showJsonEditor ? moduleConfigJson : JSON.stringify(selectedMod.config || {}, null, 2)}
                        onChange={(e) => { setShowJsonEditor(true); setModuleConfigJson(e.target.value); }}
                        onFocus={() => { setShowJsonEditor(true); setModuleConfigJson(JSON.stringify(selectedMod.config || {}, null, 2)); }}
                        className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:border-blue-500 transition-all"
                        rows={5}
                      />
                      <button
                        onClick={() => {
                          try {
                            const config = JSON.parse(showJsonEditor ? moduleConfigJson : JSON.stringify(selectedMod.config || {}));
                            const newModules = [...modules];
                            newModules[selectedModule] = { ...newModules[selectedModule], config };
                            updateModules(newModules);
                            setShowJsonEditor(false);
                          } catch {
                            alert('Invalid JSON');
                          }
                        }}
                        className="w-full mt-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        Apply JSON
                      </button>
                    </CollapsibleSection>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* ── Empty state ─────────────────────────────────────────── */
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-sm">
              <div className="w-20 h-20 rounded-2xl bg-gray-800/60 border border-gray-700/50 flex items-center justify-center mx-auto mb-4 text-4xl">
                ⬛
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No layout selected</h3>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                Choose a layout from the sidebar to start editing, or create a new one to get started.
              </p>
              <button
                onClick={handleNewLayout}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-900/30"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Create New Layout
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onRename={() => {
            const layout = layouts.find(l => l.id === contextMenu.layoutId);
            startRename(contextMenu.layoutId, layout?.name);
            setContextMenu(null);
          }}
          onDuplicate={() => {
            handleDuplicateLayout(contextMenu.layoutId);
            setContextMenu(null);
          }}
          onDelete={() => {
            handleDeleteLayout(contextMenu.layoutId);
            setContextMenu(null);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

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
