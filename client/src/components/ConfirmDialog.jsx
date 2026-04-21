import React, { useEffect, useRef } from 'react';

/**
 * A reusable confirmation dialog with destructive-action styling.
 *
 * Props:
 *  - open: boolean
 *  - title: string
 *  - message: string
 *  - confirmLabel: string (default "Confirm")
 *  - cancelLabel: string (default "Cancel")
 *  - variant: 'danger' | 'warning' | 'default'
 *  - onConfirm: () => void
 *  - onCancel: () => void
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  // Escape to cancel
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  const ICONS = {
    danger: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4" /><path d="M12 17h.01" />
      </svg>
    ),
    warning: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
      </svg>
    ),
    default: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 16h.01" />
      </svg>
    ),
  };
  const colors = {
    danger:  { border: 'border-red-800/50',   bg: 'bg-red-600 hover:bg-red-500',     iconTint: 'text-red-400',   glow: 'shadow-red-600/20'   },
    warning: { border: 'border-amber-800/50', bg: 'bg-amber-600 hover:bg-amber-500', iconTint: 'text-amber-400', glow: 'shadow-amber-600/20' },
    default: { border: 'border-blue-800/50',  bg: 'bg-blue-600 hover:bg-blue-500',   iconTint: 'text-blue-400',  glow: 'shadow-blue-600/20'  },
  }[variant];
  const Icon = ICONS[variant];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onCancel}>
      <div
        className={`bg-gray-900 rounded-2xl border ${colors.border} p-6 w-full max-w-sm shadow-2xl ${colors.glow} animate-in`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <span className={`${colors.iconTint} mt-0.5`}>{Icon}</span>
          <div>
            <h3 className="text-white font-semibold text-lg">{title}</h3>
            <p className="text-gray-400 text-sm mt-1 leading-relaxed whitespace-pre-line">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`px-4 py-2 ${colors.bg} text-white text-sm font-semibold rounded-lg transition-all shadow-lg ${colors.glow}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes animate-in {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-in { animation: animate-in 0.2s ease-out; }
      `}</style>
    </div>
  );
}
