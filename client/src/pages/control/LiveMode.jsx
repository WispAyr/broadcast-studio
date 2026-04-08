import React, { useState, useCallback } from 'react';
import { useWorkspaceContext } from '../../hooks/WorkspaceContext';
import { useAudioBroadcast } from '../../lib/useAudioBroadcast';
import { connectSocket } from '../../lib/socket';
import useLiveData from '../../hooks/useLiveData';
import api from '../../lib/api';

import PanelShell from './components/PanelShell';
import LiveToolbar from './components/LiveToolbar';
import LiveScreenGrid from './components/LiveScreenGrid';
import LayoutHotbar from './components/LayoutHotbar';
import PreviewProgram from './components/PreviewProgram';
import OverlayPanel from './components/OverlayPanel';
import MacroGrid from './components/MacroGrid';
import CueList from './components/CueList';
import TransitionControls from './components/TransitionControls';
import ClockTally from './components/ClockTally';
import ModuleConfigPanel from './components/ModuleConfigPanel';
import useActiveModuleConfigs from '../../hooks/useActiveModuleConfigs';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';

export default function LiveMode() {
  const workspace = useWorkspaceContext();
  const { panels, togglePanel, setPanelVisible, activeWorkspaceId, workspaces, switchWorkspace, saveWorkspace, deleteWorkspace, resetWorkspace } = workspace;

  const { screens, layouts, loading, studioId, liveLayoutId, onlineCount, fetchData } = useLiveData();
  const { active: audioBroadcast, level: audioLevel, toggle: toggleAudioBroadcast } = useAudioBroadcast(studioId);
  const toast = useToast();

  // Production state
  const [transitionType, setTransitionType] = useState('crossfade');
  const [transitionDuration, setTransitionDuration] = useState(1);
  const [previewLayout, setPreviewLayout] = useState(null);
  const [programLayout, setProgramLayout] = useState(null);
  const [blackoutActive, setBlackoutActive] = useState(false);
  const [blackoutConfirmOpen, setBlackoutConfirmOpen] = useState(false);
  const [activeOverlays, setActiveOverlays] = useState({});
  const [quickTextOpen, setQuickTextOpen] = useState(false);
  const [quickText, setQuickText] = useState('');
  const [quickTextSubtitle, setQuickTextSubtitle] = useState('');
  const [hiddenModuleConfigs, setHiddenModuleConfigs] = useState({});

  // Dynamic module config panels
  const moduleConfigs = useActiveModuleConfigs(screens, layouts, liveLayoutId);

  // Actions
  const handleHotbarPush = useCallback(async (layoutId) => {
    if (!layoutId) return;
    try {
      await api.post('/screens/sync', { layout_id: layoutId });
      const bl = layouts.find(l => l.id === layoutId);
      setBlackoutActive(bl?.name?.includes('Blackout') || false);
      const layout = layouts.find(l => l.id === layoutId);
      if (layout) setProgramLayout(layout);
      toast?.('All screens synced', 'success');
      fetchData();
    } catch (err) { console.error('Push failed:', err); }
  }, [layouts, fetchData, toast]);

  const handleBlackout = useCallback(async () => {
    const blackoutLayout = layouts.find(l => l.name?.includes('Blackout'));
    if (!blackoutLayout) return;
    if (blackoutActive) {
      const restore = layouts.find(l => !l.name?.includes('Blackout'));
      if (restore) await handleHotbarPush(restore.id);
      setBlackoutActive(false);
    } else {
      await handleHotbarPush(blackoutLayout.id);
      setBlackoutActive(true);
    }
    setBlackoutConfirmOpen(false);
  }, [layouts, blackoutActive, handleHotbarPush]);

  const handleQuickText = useCallback(() => {
    if (!quickText.trim()) return;
    const socket = connectSocket();
    socket.emit('update_module_text', { studioId, moduleId: '__live_text__', text: quickText, subtitle: quickTextSubtitle });
    setQuickTextOpen(false);
    setQuickText('');
    setQuickTextSubtitle('');
  }, [quickText, quickTextSubtitle, studioId]);

  // Panel visibility helpers
  const isVisible = (id) => panels[id]?.visible;
  const hasLeft = isVisible('cueList');
  const visibleModuleConfigs = moduleConfigs.filter(mc => !hiddenModuleConfigs[mc.moduleId]);
  const hasRight = isVisible('overlays') || isVisible('macros') || visibleModuleConfigs.length > 0;
  const hasTop = isVisible('pvwPgm') || isVisible('transitions') || isVisible('clockTally');
  const hasBottom = isVisible('hotbar');

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-950">
        <p className="text-gray-500 animate-pulse text-sm">Loading live data...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-950 overflow-hidden">
      {/* Toolbar */}
      <LiveToolbar
        panels={panels}
        togglePanel={togglePanel}
        activeWorkspaceId={activeWorkspaceId}
        workspaces={workspaces}
        switchWorkspace={switchWorkspace}
        saveWorkspace={saveWorkspace}
        deleteWorkspace={deleteWorkspace}
        resetWorkspace={resetWorkspace}
        screenCount={screens.length}
        onlineCount={onlineCount}
        blackoutActive={blackoutActive}
        onBlackout={() => setBlackoutConfirmOpen(true)}
        onQuickText={() => setQuickTextOpen(true)}
        audioBroadcast={audioBroadcast}
        onToggleAudio={toggleAudioBroadcast}
        audioLevel={audioLevel}
      />

      {/* Top zone */}
      {hasTop && (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-900/50 border-b border-gray-800/50 shrink-0">
          {isVisible('clockTally') && (
            <ClockTally screensOnline={onlineCount} blackoutActive={blackoutActive} />
          )}
          {isVisible('transitions') && (
            <TransitionControls
              transitionType={transitionType}
              setTransitionType={setTransitionType}
              transitionDuration={transitionDuration}
              setTransitionDuration={setTransitionDuration}
            />
          )}
          {isVisible('pvwPgm') && (
            <div className="flex-1">
              <PreviewProgram
                compact
                previewLayout={previewLayout}
                programLayout={programLayout}
                onTake={() => previewLayout && handleHotbarPush(previewLayout.id)}
                onCut={() => previewLayout && handleHotbarPush(previewLayout.id)}
                transitionType={transitionType}
                transitionDuration={transitionDuration}
              />
            </div>
          )}
        </div>
      )}

      {/* Middle row: left | center | right */}
      <div className="flex-1 flex min-h-0">
        {/* Left zone */}
        {hasLeft && (
          <div className="w-[280px] shrink-0 flex flex-col gap-1 p-1 border-r border-gray-800/50 overflow-y-auto">
            {isVisible('cueList') && (
              <PanelShell title="Cue List" icon="📋" color="yellow" onClose={() => setPanelVisible('cueList', false)}>
                <CueList
                  inShell
                  compact
                  layouts={layouts}
                  onPushLayout={handleHotbarPush}
                  transitionType={transitionType}
                  transitionDuration={transitionDuration}
                />
              </PanelShell>
            )}
          </div>
        )}

        {/* Center zone */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {isVisible('screens') && (
            <LiveScreenGrid screens={screens} layouts={layouts} onPushLayout={handleHotbarPush} fetchData={fetchData} />
          )}
        </div>

        {/* Right zone */}
        {hasRight && (
          <div className="w-[280px] shrink-0 flex flex-col gap-1 p-1 border-l border-gray-800/50 overflow-y-auto">
            {isVisible('overlays') && (
              <PanelShell title="Overlays" icon="🎭" color="purple" onClose={() => setPanelVisible('overlays', false)}>
                <OverlayPanel
                  inShell
                  compact
                  activeOverlays={activeOverlays}
                  setActiveOverlays={setActiveOverlays}
                />
              </PanelShell>
            )}
            {isVisible('macros') && (
              <PanelShell title="Macros" icon="⌨️" color="blue" onClose={() => setPanelVisible('macros', false)}>
                <div className="p-2">
                  <MacroGrid compact layouts={layouts} onPushLayout={handleHotbarPush} onBlackout={handleBlackout} />
                </div>
              </PanelShell>
            )}
            {/* Dynamic module config panels */}
            {visibleModuleConfigs.map(mc => (
              <PanelShell
                key={mc.moduleId}
                title={mc.label}
                icon={mc.icon}
                color={mc.color}
                onClose={() => setHiddenModuleConfigs(prev => ({ ...prev, [mc.moduleId]: true }))}
              >
                <ModuleConfigPanel moduleConfig={mc} studioId={studioId} />
              </PanelShell>
            ))}
          </div>
        )}
      </div>

      {/* Bottom zone */}
      {hasBottom && (
        <div className="shrink-0 border-t border-gray-800/50"
          style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.7) 100%)' }}>
          <LayoutHotbar
            layouts={layouts}
            liveLayoutId={liveLayoutId}
            onPush={handleHotbarPush}
            onBlackout={() => setBlackoutConfirmOpen(true)}
            blackoutActive={blackoutActive}
          />
        </div>
      )}

      {/* Blackout confirm */}
      <ConfirmDialog
        open={blackoutConfirmOpen}
        title={blackoutActive ? 'Restore Screens' : 'Blackout All Screens'}
        message={blackoutActive
          ? 'This will restore all screens to their previous layout.'
          : `This will immediately blackout all ${onlineCount} online screen${onlineCount !== 1 ? 's' : ''}. Are you sure?`}
        confirmLabel={blackoutActive ? 'Restore' : 'Blackout'}
        variant={blackoutActive ? 'warning' : 'danger'}
        onConfirm={handleBlackout}
        onCancel={() => setBlackoutConfirmOpen(false)}
      />

      {/* Quick Text Modal */}
      {quickTextOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl border border-purple-800 p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-purple-400 mb-4">Quick Text Update</h2>
            <input value={quickText} onChange={e => setQuickText(e.target.value)} placeholder="Main text..."
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white mb-3 focus:outline-none focus:border-purple-500" autoFocus />
            <input value={quickTextSubtitle} onChange={e => setQuickTextSubtitle(e.target.value)} placeholder="Subtitle (optional)..."
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white mb-4 focus:outline-none focus:border-purple-500" />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setQuickTextOpen(false); setQuickText(''); setQuickTextSubtitle(''); }}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors">Cancel</button>
              <button onClick={handleQuickText} disabled={!quickText.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors">Send Live</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
