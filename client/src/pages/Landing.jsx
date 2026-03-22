import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

// ─── Animated grid background ───
function GridBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(rgba(59,130,246,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.5) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-cyan-500/8 rounded-full blur-3xl" />
      <div className="absolute top-3/4 left-1/3 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl" />
    </div>
  );
}

// ─── Mockup animation of control panel ───
function ControlPanelMockup() {
  const [activeScreen, setActiveScreen] = useState(0);
  const screens = ['Presenter', 'Guest', 'Wall'];
  const layouts = [
    { name: 'Default', modules: [{ t: '🕐', w: 1 }, { t: '🌤', w: 1 }, { t: '📝', w: 2 }] },
    { name: 'Breaking', modules: [{ t: '🔴', w: 3 }, { t: '⚡', w: 3 }] },
    { name: 'Music', modules: [{ t: '🎵', w: 2 }, { t: '🕐', w: 1 }] },
  ];

  useEffect(() => {
    const iv = setInterval(() => setActiveScreen(s => (s + 1) % 3), 3000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="bg-gray-900/80 border border-gray-700/50 rounded-2xl overflow-hidden shadow-2xl shadow-blue-500/5 backdrop-blur-sm">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800/50">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <span className="text-gray-500 text-xs ml-2 font-mono">broadcast.studio — Dashboard</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-green-400 text-xs">LIVE</span>
          </div>
        </div>

        {/* Screen monitors */}
        <div className="p-4">
          <div className="grid grid-cols-3 gap-3">
            {screens.map((name, i) => (
              <div key={name} className={`rounded-xl border transition-all duration-500 ${i === activeScreen ? 'border-blue-500/50 shadow-lg shadow-blue-500/10' : 'border-gray-800'}`}>
                <div className="aspect-video bg-gray-950 rounded-t-xl overflow-hidden relative">
                  <div className="absolute inset-0 grid grid-cols-3 gap-px p-1">
                    {layouts[i].modules.map((m, j) => (
                      <div key={j} className={`rounded-sm flex items-center justify-center transition-all duration-500 ${i === activeScreen ? 'bg-blue-900/30' : 'bg-gray-800/50'}`}
                        style={{ gridColumn: `span ${m.w}` }}>
                        <span style={{ fontSize: 12 }}>{m.t}</span>
                      </div>
                    ))}
                  </div>
                  {i === activeScreen && (
                    <div className="absolute top-1 right-1">
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-green-500/20 text-green-400 border border-green-500/30">LIVE</span>
                    </div>
                  )}
                </div>
                <div className="px-2 py-1.5">
                  <div className="text-[10px] text-gray-400 font-medium">{name}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Hotbar */}
          <div className="mt-3 flex gap-2">
            {['Default', 'Breaking', 'Music', '⬛'].map((name, i) => (
              <div key={name} className={`flex-1 py-1.5 rounded-lg text-center text-[10px] font-medium border transition-all ${i === activeScreen ? 'bg-green-900/30 border-green-500/40 text-green-400' : name === '⬛' ? 'bg-gray-900 border-red-900/40 text-red-500' : 'bg-gray-800/50 border-gray-700/50 text-gray-500'}`}>
                {name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Feature card ───
function FeatureCard({ icon, title, description }) {
  return (
    <div className="group bg-gray-900/40 border border-gray-800/50 rounded-xl p-6 hover:border-gray-700/80 hover:bg-gray-900/60 transition-all duration-300">
      <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-300">{icon}</div>
      <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

// ─── Use case card ───
function UseCaseCard({ icon, title, description }) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl hover:bg-gray-900/40 transition-colors">
      <span className="text-2xl mt-0.5">{icon}</span>
      <div>
        <h4 className="text-white font-semibold mb-1">{title}</h4>
        <p className="text-gray-500 text-sm">{description}</p>
      </div>
    </div>
  );
}

// ─── Pricing card ───
function PricingCard({ name, price, period, features, cta, highlight }) {
  return (
    <div className={`rounded-2xl p-8 border ${highlight ? 'bg-blue-950/30 border-blue-500/40 shadow-xl shadow-blue-500/5' : 'bg-gray-900/40 border-gray-800/50'}`}>
      {highlight && (
        <div className="text-blue-400 text-xs font-bold uppercase tracking-wider mb-3">Most Popular</div>
      )}
      <h3 className="text-2xl font-bold text-white mb-1">{name}</h3>
      <div className="mb-6">
        <span className="text-4xl font-bold text-white">{price}</span>
        {period && <span className="text-gray-500 ml-1">{period}</span>}
      </div>
      <ul className="space-y-3 mb-8">
        {features.map((f, i) => (
          <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
            <span className="text-green-400">✓</span>
            {f}
          </li>
        ))}
      </ul>
      <Link to={highlight ? '/login' : '/login'}
        className={`block w-full text-center py-3 rounded-xl font-semibold transition-all ${highlight ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20' : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'}`}>
        {cta}
      </Link>
    </div>
  );
}

// ─── Stat counter ───
function StatCounter({ value, label }) {
  return (
    <div className="text-center">
      <div className="text-3xl md:text-4xl font-bold text-white">{value}</div>
      <div className="text-gray-500 text-sm mt-1">{label}</div>
    </div>
  );
}

export default function Landing() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
      {/* ═══ Navigation ═══ */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">B</span>
            </div>
            <span className="text-white font-bold text-lg">Broadcast Studio</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-gray-400 hover:text-white text-sm transition-colors">Features</a>
            <a href="#use-cases" className="text-gray-400 hover:text-white text-sm transition-colors">Use Cases</a>
            <a href="#pricing" className="text-gray-400 hover:text-white text-sm transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-gray-400 hover:text-white text-sm font-medium transition-colors">Sign In</Link>
            <Link to="/login" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-blue-600/10">
              Start Free
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══ Hero ═══ */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28">
        <GridBackground />
        <div className="relative max-w-7xl mx-auto px-6">
          {/* Live badge */}
          <div className="flex justify-center mb-8">
            <div className="bg-gray-900/60 border border-gray-800 rounded-full px-5 py-2 flex items-center gap-3 backdrop-blur-sm">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-gray-300 text-sm font-mono">
                {time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className="text-gray-600 text-sm">|</span>
              <span className="text-gray-400 text-sm">Live System</span>
            </div>
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-center mb-6 tracking-tight leading-[0.95]">
            Control Every Screen.
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
              From Anywhere.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gray-400 text-center mb-10 max-w-3xl mx-auto leading-relaxed">
            Professional broadcast-grade screen management for events, studios, venues, and digital signage. 
            Real-time control with sub-second latency.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link to="/login"
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all hover:shadow-xl hover:shadow-blue-600/20 text-lg text-center">
              Start Free →
            </Link>
            <a href="#features"
              className="px-8 py-4 bg-gray-800/60 hover:bg-gray-800 text-white font-semibold rounded-xl border border-gray-700/50 transition-all text-lg text-center backdrop-blur-sm">
              See Features
            </a>
          </div>

          {/* Animated mockup */}
          <ControlPanelMockup />
        </div>
      </section>

      {/* ═══ Stats bar ═══ */}
      <section className="border-y border-gray-800/50 bg-gray-900/20 py-12">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          <StatCounter value="∞" label="Screens supported" />
          <StatCounter value="<50ms" label="Push latency" />
          <StatCounter value="30+" label="Module types" />
          <StatCounter value="24/7" label="Uptime" />
        </div>
      </section>

      {/* ═══ Features ═══ */}
      <section id="features" className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to run professional screens</h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">From a single screen to a multi-venue deployment. Built for reliability, designed for speed.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <FeatureCard icon="🖥️" title="Multi-Screen Control"
              description="Manage unlimited screens from one dashboard. Push layouts, sync content, and monitor status in real-time." />
            <FeatureCard icon="📡" title="Real-Time Updates"
              description="Instant push via WebSocket. Changes appear on screens in milliseconds, not seconds. Sub-50ms latency." />
            <FeatureCard icon="🎬" title="Show Mode"
              description="Pre-program sequences, run live shows with one click. Timeline automation with per-minute precision." />
            <FeatureCard icon="📐" title="Flexible Layouts"
              description="Split screens, overlays, picture-in-picture. Grid-based layout builder with drag-and-drop modules." />
            <FeatureCard icon="🎨" title="30+ Module Types"
              description="Clocks, tickers, media, web pages, Remotion video, weather, RSS, social feeds, camera feeds, and custom HTML." />
            <FeatureCard icon="🏢" title="Multi-Tenant Studios"
              description="Isolated studios for different teams or events. Each with their own screens, shows, layouts, and users." />
            <FeatureCard icon="📱" title="Control from Anywhere"
              description="Phone, tablet, laptop — any browser. Responsive producer panel works on any device." />
            <FeatureCard icon="🔒" title="Role-Based Access"
              description="Super admin, admin, producer, viewer. Fine-grained permissions for your team." />
            <FeatureCard icon="🖼️" title="LED Wall Support"
              description="Custom resolutions, aspect ratios, and graceful disconnect handling. LED walls go dark, not error." />
            <FeatureCard icon="🎥" title="Remotion Integration"
              description="Render dynamic video compositions in real-time. 50+ pre-built templates for lower thirds, stingers, and more." />
            <FeatureCard icon="⚡" title="Low Latency"
              description="Socket.IO powered with aggressive reconnection. Changes appear in milliseconds, never miss a beat." />
            <FeatureCard icon="🌐" title="Cloud or On-Premise"
              description="Deploy anywhere. Self-hosted with full control, or use our managed cloud. Your data, your rules." />
          </div>
        </div>
      </section>

      {/* ═══ Use Cases ═══ */}
      <section id="use-cases" className="py-20 bg-gray-900/20 border-y border-gray-800/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Built for every venue</h2>
            <p className="text-gray-500 text-lg">From intimate studios to stadium-scale deployments</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <UseCaseCard icon="🎤" title="Live Events & Conferences"
              description="Run multi-screen shows with pre-programmed timelines. Switch layouts on the fly during presentations." />
            <UseCaseCard icon="⛪" title="Church & Worship Services"
              description="Lyrics, announcements, live video feeds. Run an entire service from a tablet." />
            <UseCaseCard icon="🏟" title="Sports Venues & Stadiums"
              description="Scoreboards, replays, sponsor rotations, emergency messaging across hundreds of screens." />
            <UseCaseCard icon="🏢" title="Corporate Digital Signage"
              description="Lobby displays, meeting room boards, cafeteria menus. Update remotely from anywhere." />
            <UseCaseCard icon="🎙" title="Broadcast Studios"
              description="Presenter monitors, guest displays, autocue, clocks, and live tally. Full studio control." />
            <UseCaseCard icon="🖥️" title="Control Rooms"
              description="Multi-feed monitoring walls, alert tickers, dashboards. Purpose-built for operations." />
            <UseCaseCard icon="🛍" title="Retail Displays"
              description="Product showcases, promotions, wayfinding. Schedule content by time of day." />
          </div>
        </div>
      </section>

      {/* ═══ Social Proof ═══ */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-gray-500 text-sm uppercase tracking-wider mb-4">Trusted by</p>
          <p className="text-xl text-gray-300 italic mb-3">"Used at live events across Scotland"</p>
          <p className="text-gray-500 text-sm">Now Ayrshire Radio · Local Connect Systems · Live venues</p>
        </div>
      </section>

      {/* ═══ Pricing ═══ */}
      <section id="pricing" className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple pricing</h2>
            <p className="text-gray-500 text-lg">Start free. Scale when you need to.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <PricingCard
              name="Free"
              price="£0"
              period="/month"
              features={['1 studio', '3 screens', 'All module types', 'Real-time control', 'Community support']}
              cta="Get Started"
            />
            <PricingCard
              name="Pro"
              price="£29"
              period="/month"
              features={['Unlimited studios', 'Unlimited screens', 'Show automation', 'LED wall support', 'Priority support', 'Custom branding']}
              cta="Start Free Trial"
              highlight
            />
            <PricingCard
              name="Enterprise"
              price="Custom"
              period=""
              features={['Everything in Pro', 'On-premise deployment', 'SLA guarantee', 'Custom integrations', 'Dedicated account manager', 'Training & onboarding']}
              cta="Contact Us"
            />
          </div>
        </div>
      </section>

      {/* ═══ Final CTA ═══ */}
      <section className="py-20 border-t border-gray-800/30">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to take control?</h2>
          <p className="text-gray-400 text-lg mb-8">Set up your first screen in under 2 minutes. No credit card required.</p>
          <Link to="/login"
            className="inline-block px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all hover:shadow-xl hover:shadow-blue-600/20 text-lg">
            Start Free →
          </Link>
        </div>
      </section>

      {/* ═══ Footer ═══ */}
      <footer className="border-t border-gray-800/50 py-12 bg-gray-900/10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-xs font-bold">B</span>
                </div>
                <span className="text-white font-bold">Broadcast Studio</span>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed">
                Professional screen control for events, studios, and digital signage.
              </p>
            </div>
            <div>
              <h4 className="text-gray-300 font-semibold text-sm mb-4">Product</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">Features</a></li>
                <li><a href="#pricing" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">Pricing</a></li>
                <li><a href="#use-cases" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">Use Cases</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-gray-300 font-semibold text-sm mb-4">Resources</h4>
              <ul className="space-y-2">
                <li><Link to="/control" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">Control Panel</Link></li>
                <li><Link to="/login" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">Sign In</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-gray-300 font-semibold text-sm mb-4">Company</h4>
              <ul className="space-y-2">
                <li><a href="https://local-connect.uk" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">Local Connect</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800/50 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-600 text-sm">© {new Date().getFullYear()} Broadcast Studio. Built by Local Connect.</p>
            <div className="flex items-center gap-4">
              <span className="text-gray-700 text-xs">v1.0</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
