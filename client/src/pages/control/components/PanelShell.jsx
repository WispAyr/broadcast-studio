import React, { useState } from 'react';
import { PANEL_COLORS } from '../panels/panelRegistry';

export default function PanelShell({ title, icon, color = 'gray', onClose, collapsible = true, children, className = '' }) {
  const [collapsed, setCollapsed] = useState(false);
  const borderColor = PANEL_COLORS[color] || PANEL_COLORS.gray;

  return (
    <div className={`bg-gray-900/90 border border-gray-800 rounded-lg overflow-hidden flex flex-col ${className}`}>
      {/* Header */}
      <div className={`flex items-center gap-2 px-3 py-1.5 border-l-2 ${borderColor} bg-gray-800/50 shrink-0`}>
        {icon && <span className="text-xs">{icon}</span>}
        <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider flex-1 truncate">{title}</span>
        <div className="flex items-center gap-1">
          {collapsible && (
            <button
              onClick={() => setCollapsed(c => !c)}
              className="w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:text-white hover:bg-gray-700 transition-colors text-[10px]"
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed ? '▼' : '▲'}
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:text-red-400 hover:bg-gray-700 transition-colors text-[10px]"
              title="Hide panel"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      {/* Content */}
      {!collapsed && (
        <div className="flex-1 overflow-auto min-h-0">
          {children}
        </div>
      )}
    </div>
  );
}
