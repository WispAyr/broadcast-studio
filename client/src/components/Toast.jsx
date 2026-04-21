import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

function ToastIcon({ type }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', className: 'w-4 h-4 shrink-0' };
  if (type === 'success') return (<svg {...common}><path d="m5 12 5 5 9-11" /></svg>);
  if (type === 'error')   return (<svg {...common}><circle cx="12" cy="12" r="9" /><path d="M15 9 9 15M9 9l6 6" /></svg>);
  if (type === 'warning') return (<svg {...common}><path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>);
  return (<svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 16h.01" /></svg>);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto px-3.5 py-2.5 rounded-lg shadow-xl text-sm font-medium animate-slide-in-right backdrop-blur-sm border flex items-center gap-2.5 min-w-[220px] max-w-md ${
              toast.type === 'success' ? 'bg-green-900/90 border-green-700 text-green-100' :
              toast.type === 'error' ? 'bg-red-900/90 border-red-700 text-red-100' :
              toast.type === 'warning' ? 'bg-amber-900/90 border-amber-700 text-amber-100' :
              'bg-gray-900/90 border-gray-700 text-gray-100'
            }`}
            style={{ animation: 'slideInRight 0.3s ease-out, fadeOut 0.3s ease-in 2.7s forwards' }}
          >
            <ToastIcon type={toast.type} />
            <span className="flex-1 leading-snug">{toast.message}</span>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
      `}</style>
    </ToastContext.Provider>
  );
}
