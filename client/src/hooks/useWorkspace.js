import { useState, useCallback, useEffect } from 'react';
import { PANELS, WORKSPACE_PRESETS, DEFAULT_WORKSPACE_ID } from '../pages/control/panels/panelRegistry';

const STORAGE_KEY = 'broadcast_workspaces';

function getDefaultPanelState() {
  const panels = {};
  PANELS.forEach(p => {
    panels[p.id] = { visible: p.defaultVisible !== false, zone: p.defaultZone };
  });
  return panels;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

function buildInitialState() {
  const saved = loadState();
  if (saved && saved.workspaces) return saved;

  // Build initial state from presets
  const workspaces = {};
  Object.entries(WORKSPACE_PRESETS).forEach(([id, preset]) => {
    workspaces[id] = {
      name: preset.name,
      panels: { ...getDefaultPanelState(), ...preset.panels },
    };
  });

  return {
    activeMode: 'studio',
    activeWorkspaceId: DEFAULT_WORKSPACE_ID,
    workspaces,
  };
}

export default function useWorkspace() {
  const [state, setState] = useState(buildInitialState);

  // Persist on change
  useEffect(() => {
    saveState(state);
  }, [state]);

  const mode = state.activeMode;
  const activeWorkspaceId = state.activeWorkspaceId;
  const activeWorkspace = state.workspaces[activeWorkspaceId] || state.workspaces[DEFAULT_WORKSPACE_ID];
  const panels = activeWorkspace?.panels || getDefaultPanelState();

  const setMode = useCallback((newMode) => {
    setState(prev => ({ ...prev, activeMode: newMode }));
  }, []);

  const toggleMode = useCallback(() => {
    setState(prev => ({
      ...prev,
      activeMode: prev.activeMode === 'studio' ? 'live' : 'studio',
    }));
  }, []);

  const togglePanel = useCallback((panelId) => {
    setState(prev => {
      const ws = prev.workspaces[prev.activeWorkspaceId];
      if (!ws) return prev;
      const panel = ws.panels[panelId];
      if (!panel) return prev;
      return {
        ...prev,
        workspaces: {
          ...prev.workspaces,
          [prev.activeWorkspaceId]: {
            ...ws,
            panels: {
              ...ws.panels,
              [panelId]: { ...panel, visible: !panel.visible },
            },
          },
        },
      };
    });
  }, []);

  const setPanelVisible = useCallback((panelId, visible) => {
    setState(prev => {
      const ws = prev.workspaces[prev.activeWorkspaceId];
      if (!ws || !ws.panels[panelId]) return prev;
      return {
        ...prev,
        workspaces: {
          ...prev.workspaces,
          [prev.activeWorkspaceId]: {
            ...ws,
            panels: {
              ...ws.panels,
              [panelId]: { ...ws.panels[panelId], visible },
            },
          },
        },
      };
    });
  }, []);

  const switchWorkspace = useCallback((workspaceId) => {
    setState(prev => {
      if (!prev.workspaces[workspaceId]) return prev;
      return { ...prev, activeWorkspaceId: workspaceId };
    });
  }, []);

  const saveWorkspace = useCallback((name) => {
    const id = `custom_${Date.now()}`;
    setState(prev => {
      const currentPanels = prev.workspaces[prev.activeWorkspaceId]?.panels || getDefaultPanelState();
      return {
        ...prev,
        activeWorkspaceId: id,
        workspaces: {
          ...prev.workspaces,
          [id]: { name, panels: { ...currentPanels } },
        },
      };
    });
    return id;
  }, []);

  const deleteWorkspace = useCallback((workspaceId) => {
    // Don't delete presets
    if (WORKSPACE_PRESETS[workspaceId]) return;
    setState(prev => {
      const next = { ...prev, workspaces: { ...prev.workspaces } };
      delete next.workspaces[workspaceId];
      if (prev.activeWorkspaceId === workspaceId) {
        next.activeWorkspaceId = DEFAULT_WORKSPACE_ID;
      }
      return next;
    });
  }, []);

  const resetWorkspace = useCallback(() => {
    setState(prev => {
      const preset = WORKSPACE_PRESETS[prev.activeWorkspaceId];
      if (!preset) return prev;
      return {
        ...prev,
        workspaces: {
          ...prev.workspaces,
          [prev.activeWorkspaceId]: {
            ...prev.workspaces[prev.activeWorkspaceId],
            panels: { ...getDefaultPanelState(), ...preset.panels },
          },
        },
      };
    });
  }, []);

  return {
    mode,
    setMode,
    toggleMode,
    panels,
    togglePanel,
    setPanelVisible,
    activeWorkspaceId,
    activeWorkspace,
    workspaces: state.workspaces,
    switchWorkspace,
    saveWorkspace,
    deleteWorkspace,
    resetWorkspace,
  };
}
