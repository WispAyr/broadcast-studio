import { useMemo } from 'react';
import { getModuleConfig } from '../pages/control/panels/moduleConfigRegistry';

// Given the current active layout, extract which modules are configurable
// and return their config definitions for rendering dynamic panels.
export default function useActiveModuleConfigs(screens, layouts, liveLayoutId) {
  return useMemo(() => {
    if (!liveLayoutId) return [];

    const layout = layouts.find(l => l.id === liveLayoutId);
    if (!layout) return [];

    let modules = layout.modules;
    if (typeof modules === 'string') {
      try { modules = JSON.parse(modules); } catch { modules = []; }
    }
    if (!Array.isArray(modules)) return [];

    const configs = [];
    modules.forEach((mod, index) => {
      const type = mod.type || mod.module_type;
      if (!type) return;
      const config = getModuleConfig(type);
      if (!config) return;

      configs.push({
        moduleId: mod.id || `${type}_${index}`,
        moduleType: type,
        moduleIndex: index,
        label: config.label,
        icon: config.icon,
        color: config.color,
        fields: config.fields,
        socketEvent: config.socketEvent,
        buildPayload: config.buildPayload,
        // Pass along any existing config from the module
        currentConfig: mod.config || mod,
      });
    });

    return configs;
  }, [screens, layouts, liveLayoutId]);
}
