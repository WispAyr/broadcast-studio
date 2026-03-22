import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
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
            className={`pointer-events-auto px-4 py-2.5 rounded-lg shadow-xl text-sm font-medium animate-slide-in-right backdrop-blur-sm border ${
              toast.type === 'success' ? 'bg-green-900/90 border-green-700 text-green-200' :
              toast.type === 'error' ? 'bg-red-900/90 border-red-700 text-red-200' :
              toast.type === 'warning' ? 'bg-amber-900/90 border-amber-700 text-amber-200' :
              'bg-gray-900/90 border-gray-700 text-gray-200'
            }`}
            style={{ animation: 'slideInRight 0.3s ease-out, fadeOut 0.3s ease-in 2.7s forwards' }}
          >
            {toast.type === 'success' && '✓ '}
            {toast.type === 'error' && '✕ '}
            {toast.type === 'warning' && '⚠ '}
            {toast.message}
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
