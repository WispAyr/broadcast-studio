import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function FeatureCard({ icon, title, description }) {
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function StatusPill({ label, value, color }) {
  return (
    <div className="flex items-center gap-2 bg-gray-900/60 border border-gray-800 rounded-full px-4 py-2">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-gray-400 text-sm">{label}</span>
      <span className="text-white font-semibold text-sm">{value}</span>
    </div>
  );
}

export default function Landing() {
  const [stats, setStats] = useState({ screens: 0, modules: 0 });
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetch('/api/modules')
      .then(r => r.json())
      .then(data => {
        const mods = data.modules || data || [];
        setStats(s => ({ ...s, modules: mods.length }));
      })
      .catch(() => {});

    fetch('/api/screens')
      .then(r => r.json())
      .then(data => {
        const screens = data.screens || data || [];
        setStats(s => ({ ...s, screens: screens.length }));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Hero */}
      <div className="relative overflow-hidden">
        {/* Animated background grid */}
        <div className="absolute inset-0 opacity-5">
          <div
            className="w-full h-full"
            style={{
              backgroundImage: 'linear-gradient(rgba(59,130,246,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.3) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-16">
          {/* Live clock badge */}
          <div className="flex justify-center mb-8">
            <div className="bg-gray-900/80 border border-gray-800 rounded-full px-5 py-2 flex items-center gap-3">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-gray-300 text-sm font-mono">
                {time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className="text-gray-600 text-sm">|</span>
              <span className="text-gray-400 text-sm">
                {time.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>

          <h1 className="text-6xl md:text-7xl font-bold text-center mb-4 tracking-tight">
            <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-cyan-400 bg-clip-text text-transparent">
              Broadcast
            </span>
            {' '}
            <span className="text-white">Studio</span>
          </h1>

          <p className="text-xl text-gray-400 text-center mb-8 max-w-2xl mx-auto">
            Multi-screen studio control system with real-time layout management, timeline automation, and 22+ broadcast modules
          </p>

          {/* Status pills */}
          <div className="flex justify-center gap-3 mb-12 flex-wrap">
            <StatusPill label="Screens" value={stats.screens} color="bg-green-500" />
            <StatusPill label="Module Types" value={stats.modules} color="bg-blue-500" />
            <StatusPill label="System" value="Online" color="bg-green-500 animate-pulse" />
          </div>

          {/* CTA buttons */}
          <div className="flex gap-4 justify-center">
            <Link
              to="/control"
              className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-blue-600/20 text-lg"
            >
              Control Panel
            </Link>
            <Link
              to="/login"
              className="px-8 py-3.5 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-xl border border-gray-700 transition-all text-lg"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-2">Capabilities</h2>
        <p className="text-gray-500 text-center mb-10">Everything you need to run a professional broadcast studio</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <FeatureCard
            icon="🖥"
            title="Multi-Screen Control"
            description="Push layouts to any screen in real-time. Manage presenter monitors, studio walls, and external displays from one dashboard."
          />
          <FeatureCard
            icon="🕐"
            title="Time Local Connect"
            description="14 clock modes including broadcast, nixie, flip, analogue, and world time. Seamless integration with configurable themes."
          />
          <FeatureCard
            icon="📡"
            title="Live Data Feeds"
            description="RSS feeds, news tickers, live weather from Open-Meteo, social media embeds — all updating in real-time on your screens."
          />
          <FeatureCard
            icon="🎬"
            title="Media & YouTube"
            description="Embed YouTube videos, live streams, and playlists. Play local media. Camera feed integration with HLS support."
          />
          <FeatureCard
            icon="⏱"
            title="Timeline Automation"
            description="Schedule layout changes to run automatically. Set show timelines with per-minute precision — hands-free operation."
          />
          <FeatureCard
            icon="🌐"
            title="Web Source Embedding"
            description="Embed any URL with auto-refresh, zoom control, and CORS proxy support. Weather radar, aircraft tracking, dashboards."
          />
        </div>
      </div>

      {/* Quick Links */}
      <div className="max-w-6xl mx-auto px-6 pb-16">
        <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-8">
          <h3 className="text-lg font-semibold mb-4">Quick Access</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link to="/control/dashboard" className="bg-gray-800 hover:bg-gray-700 rounded-lg p-4 text-center transition-colors">
              <div className="text-2xl mb-1">📊</div>
              <div className="text-sm text-gray-300">Dashboard</div>
            </Link>
            <Link to="/control/layouts" className="bg-gray-800 hover:bg-gray-700 rounded-lg p-4 text-center transition-colors">
              <div className="text-2xl mb-1">🎨</div>
              <div className="text-sm text-gray-300">Layouts</div>
            </Link>
            <Link to="/control/shows" className="bg-gray-800 hover:bg-gray-700 rounded-lg p-4 text-center transition-colors">
              <div className="text-2xl mb-1">📋</div>
              <div className="text-sm text-gray-300">Shows</div>
            </Link>
            <Link to="/control/screens" className="bg-gray-800 hover:bg-gray-700 rounded-lg p-4 text-center transition-colors">
              <div className="text-2xl mb-1">🖥</div>
              <div className="text-sm text-gray-300">Screens</div>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-900 py-6 text-center">
        <p className="text-gray-600 text-sm">Broadcast Studio — Multi-tenant screen control system</p>
      </div>
    </div>
  );
}
