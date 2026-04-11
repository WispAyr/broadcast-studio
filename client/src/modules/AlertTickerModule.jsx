import React, { useState, useEffect, useRef } from 'react';
import { getSocket } from '../lib/socket';

const DEFAULT_ALERTS = [
  { id: 1, text: 'WEATHER WARNING: Yellow warning for rain across Ayrshire until 18:00', severity: 'warning' },
  { id: 2, text: 'TRAFFIC: A78 closed between Troon and Irvine due to accident. Seek alternative routes.', severity: 'critical' },
  { id: 3, text: 'EVENT: Ayr Racecourse gates open at 12:00 - expect heavy traffic on A79', severity: 'info' },
  { id: 4, text: 'SCHOOL: Ayr Academy closed today due to heating fault', severity: 'warning' },
  { id: 5, text: 'FERRY: CalMac services running normally from Ardrossan', severity: 'info' },
];

const SEVERITY_STYLES = {
  emergency: { bg: '#7c0000', color: '#fff', icon: '🚨' },
  critical:  { bg: '#dc2626', color: '#fff', icon: '⚠' },
  warning:   { bg: '#d97706', color: '#fff', icon: '⚠' },
  info:      { bg: '#2563eb', color: '#fff', icon: 'ℹ' },
};

function normaliseSeverity(raw = 'info') {
  const s = raw.toLowerCase();
  if (s === 'emergency') return 'emergency';
  if (s === 'critical' || s === 'error') return 'critical';
  if (s === 'warning' || s === 'warn') return 'warning';
  return 'info';
}

export default function AlertTickerModule({ config = {} }) {
  const [alerts, setAlerts] = useState(() => {
    const initial = config.alerts || config.items || DEFAULT_ALERTS;
    return initial;
  });

  const speed      = config.speed      || 30;
  const bg         = config.background || '#1e1e1e';
  const mode       = config.mode       || 'scroll'; // 'scroll' | 'cycle'
  const cycleSpeed = config.cycleSpeed || 5000;

  const [currentIndex, setCurrentIndex] = useState(0);
  // Track the config-provided items separately so live Nuro alerts are additive
  const configAlertsRef = useRef(config.alerts || config.items || DEFAULT_ALERTS);

  // ── Sync config changes ────────────────────────────────────────────────────
  useEffect(() => {
    const newBase = config.alerts || config.items || DEFAULT_ALERTS;
    configAlertsRef.current = newBase;
  }, [config.alerts, config.items]);

  // ── Live Nuro alert listener ───────────────────────────────────────────────
  useEffect(() => {
    let socket;
    try { socket = getSocket(); } catch { return; }
    if (!socket) return;

    function onModuleConfig({ moduleId, config: cfg }) {
      // Only handle updates targeting __nuro_ticker__ or our own moduleId
      if ((moduleId !== '__nuro_ticker__' && moduleId !== config.moduleId) || !cfg?.nuroUpdate) return;
      if (cfg.alerts && Array.isArray(cfg.alerts)) {
        setAlerts(prev => {
          // Prepend new Nuro alerts; keep max 20 total, de-dup by id
          const incoming = cfg.alerts.map(a => ({
            ...a,
            severity: normaliseSeverity(a.severity),
            _nuro: true,
          }));
          const existing = prev.filter(a => !incoming.find(n => n.id === a.id));
          return [...incoming, ...existing].slice(0, 20);
        });
      }
    }

    function onNuroAlert({ type, title, body }) {
      const text = body ? `${title}: ${body}` : title;
      setAlerts(prev => {
        const newAlert = {
          id:       `nuro-${Date.now()}`,
          text,
          severity: normaliseSeverity(type),
          _nuro:    true,
        };
        return [newAlert, ...prev.filter(a => a.id !== newAlert.id)].slice(0, 20);
      });
    }

    socket.on('update_module_config', onModuleConfig);
    socket.on('nuro_alert', onNuroAlert);

    return () => {
      socket.off('update_module_config', onModuleConfig);
      socket.off('nuro_alert', onNuroAlert);
    };
  }, [config.moduleId]);

  // ── Cycle mode timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'cycle' || alerts.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % alerts.length);
    }, cycleSpeed);
    return () => clearInterval(timer);
  }, [mode, cycleSpeed, alerts.length]);

  // ── Cycle mode render ─────────────────────────────────────────────────────
  if (mode === 'cycle') {
    const alert = alerts[currentIndex] || alerts[0];
    if (!alert) return null;
    const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info;

    return (
      <div
        className="w-full h-full flex items-center overflow-hidden"
        style={{ background: style.bg }}
      >
        <div className="flex items-center gap-3 px-4 w-full transition-all duration-500">
          <span className="text-lg shrink-0">{style.icon}</span>
          <p className="text-sm font-semibold" style={{ color: style.color }}>
            {alert.text}
          </p>
          {alert._nuro && (
            <span className="ml-auto text-[9px] font-bold uppercase tracking-wider opacity-60 shrink-0">
              NURO
            </span>
          )}
        </div>
      </div>
    );
  }

  // ── Scroll mode render ────────────────────────────────────────────────────
  const fullText = alerts.map(a => {
    const style = SEVERITY_STYLES[normaliseSeverity(a.severity)] || SEVERITY_STYLES.info;
    return `${style.icon} ${a.text}`;
  }).join('     •     ');

  return (
    <div
      className="w-full h-full flex items-center overflow-hidden"
      style={{ background: bg }}
    >
      <div
        className="whitespace-nowrap"
        style={{
          animation: `alert-scroll ${speed}s linear infinite`,
          color: '#ffffff',
          fontSize: config.fontSize || '1rem',
          fontWeight: 600,
        }}
      >
        <span>{fullText}</span>
        <span className="mx-12">{'•'}</span>
        <span>{fullText}</span>
      </div>
      <style>{`
        @keyframes alert-scroll {
          0%   { transform: translateX(50%); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
