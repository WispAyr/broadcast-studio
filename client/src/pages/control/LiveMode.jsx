import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import RundownPanel from './components/RundownPanel';
import TransitionControls from './components/TransitionControls';
import ClockTally from './components/ClockTally';
import ModuleConfigPanel from './components/ModuleConfigPanel';
import SoundboardPanel from './components/SoundboardPanel';
import SquadsPanel from './components/SquadsPanel';
import GfxPanel from './components/GfxPanel';
import SceneRail from './components/SceneRail';
import IncidentBar from './components/IncidentBar';
import useActiveModuleConfigs from '../../hooks/useActiveModuleConfigs';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';

export default function LiveMode() {
  const workspace = useWorkspaceContext();
  const { panels, togglePanel, setPanelVisible, activeWorkspaceId, workspaces, switchWorkspace, saveWorkspace, deleteWorkspace, resetWorkspace } = workspace;

  const { screens, layouts, loading, studioId, studios, setStudioId, isSuperAdmin, liveLayoutId, onlineCount, fetchData } = useLiveData();
  const { active: audioBroadcast, level: audioLevel, toggle: toggleAudioBroadcast } = useAudioBroadcast(studioId);
  const toast = useToast();

  // Production state
  const [transitionType, setTransitionType] = useState('crossfade');
  const [transitionDuration, setTransitionDuration] = useState(1);
  const [previewLayout, setPreviewLayout] = useState(null);
  const [programLayout, setProgramLayout] = useState(null);
  const [blackoutActive, setBlackoutActive] = useState(false);
  const [blackoutConfirmOpen, setBlackoutConfirmOpen] = useState(false);
  // Per-screen layout snapshot taken immediately before blackout for true restore
  const preBlackoutRef = useRef(null);
  const [activeOverlays, setActiveOverlays] = useState({});
  const [quickTextOpen, setQuickTextOpen] = useState(false);
  const [quickText, setQuickText] = useState('');
  const [quickTextSubtitle, setQuickTextSubtitle] = useState('');
  const [hiddenModuleConfigs, setHiddenModuleConfigs] = useState({});
  const [showShortcuts, setShowShortcuts] = useState(false);
  // When true, hotbar click takes immediately; when false, arms PVW (Shift always direct-takes)
  const [directTake, setDirectTake] = useState(false);

  const moduleConfigs = useActiveModuleConfigs(screens, layouts, liveLayoutId);

  // Keep PGM panel honest when walls change from elsewhere (console, schedule, another op)
  useEffect(() => {
    if (!liveLayoutId) return;
    const layout = layouts.find((l) => l.id === liveLayoutId);
    if (layout) setProgramLayout(layout);
  }, [liveLayoutId, layouts]);

  const handleHotbarPush = useCallback(async (layoutId) => {
    if (!layoutId) return;
    try {
      const res = await api.post('/screens/sync', { layout_id: layoutId });
      const bl = layouts.find((l) => l.id === layoutId);
      setBlackoutActive(bl?.name?.includes('Blackout') || false);
      const layout = layouts.find((l) => l.id === layoutId);
      if (layout) {
        setProgramLayout(layout);
        setPreviewLayout(null);
      }
      const pushed = res?.pushed;
      const locked = res?.locked ?? 0;
      toast?.(
        locked
          ? `Synced ${pushed ?? 'screens'} (${locked} locked out)`
          : `Synced ${pushed ?? 'all'} screens`,
        'success'
      );
      fetchData();
    } catch (err) {
      console.error('Push failed:', err);
      toast?.(`Push failed: ${err.message}`, 'error');
    }
  }, [layouts, fetchData, toast]);

  const handleArmPreview = useCallback((layoutId) => {
    if (!layoutId) return;
    const layout = layouts.find((l) => l.id === layoutId);
    if (layout) setPreviewLayout(layout);
  }, [layouts]);

  const handleHotbarClick = useCallback((layoutId, { shiftKey } = {}) => {
    if (shiftKey || directTake) {
      handleHotbarPush(layoutId);
    } else {
      handleArmPreview(layoutId);
    }
  }, [directTake, handleHotbarPush, handleArmPreview]);

  const handleTake = useCallback(() => {
    if (previewLayout) handleHotbarPush(previewLayout.id);
  }, [previewLayout, handleHotbarPush]);

  const handleCut = useCallback(() => {
    // Cut is an immediate hard take of PVW (same API path until server transitions exist)
    if (previewLayout) handleHotbarPush(previewLayout.id);
  }, [previewLayout, handleHotbarPush]);

  const handleBlackout = useCallback(async () => {
    const blackoutLayout = layouts.find((l) => l.name?.includes('Blackout'));
    if (!blackoutLayout) {
      toast?.('No Blackout layout in this studio', 'error');
      setBlackoutConfirmOpen(false);
      return;
    }
    try {
      if (blackoutActive) {
        // Restore the exact per-screen layouts from the pre-blackout snapshot
        const snap = preBlackoutRef.current;
        if (snap && Object.keys(snap).length) {
          await Promise.all(
            Object.entries(snap).map(([sid, lid]) =>
              lid
                ? api.post(`/screens/${sid}/layout`, { layout_id: lid }).catch(() => null)
                : Promise.resolve()
            )
          );
          toast?.('Screens restored from pre-blackout', 'success');
        } else {
          // Fallback: first non-blackout if no snapshot (e.g. page reload mid-blackout)
          const restore = layouts.find((l) => !l.name?.includes('Blackout'));
          if (restore) await handleHotbarPush(restore.id);
        }
        preBlackoutRef.current = null;
        setBlackoutActive(false);
        fetchData();
      } else {
        const snap = {};
        screens.forEach((s) => {
          snap[s.id] = s.current_layout_id || null;
        });
        preBlackoutRef.current = snap;
        await handleHotbarPush(blackoutLayout.id);
        setBlackoutActive(true);
      }
    } catch (err) {
      toast?.(`Blackout failed: ${err.message}`, 'error');
    }
    setBlackoutConfirmOpen(false);
  }, [layouts, blackoutActive, handleHotbarPush, screens, fetchData, toast]);

  // Confirm-gated blackout for macros (never skip the dialog for FTB)
  const requestBlackout = useCallback(() => {
    setBlackoutConfirmOpen(true);
  }, []);

  const handleQuickText = useCallback(() => {
    if (!quickText.trim()) return;
    const socket = connectSocket();
    socket.emit('update_module_text', { studioId, moduleId: '__live_text__', text: quickText, subtitle: quickTextSubtitle });
    setQuickTextOpen(false);
    setQuickText('');
    setQuickTextSubtitle('');
    toast?.('Quick text sent', 'success');
  }, [quickText, quickTextSubtitle, studioId, toast]);

  // Keyboard: 1-9 arm/take, B blackout, Enter/Space TAKE, Shift+1-9 direct, ? help
  useEffect(() => {
    function handleKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable) return;
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShowShortcuts((s) => !s);
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        if (previewLayout && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          handleTake();
        }
        return;
      }
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        setBlackoutConfirmOpen(true);
        return;
      }
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9) {
        const filtered = layouts.filter((l) => !l.name?.includes('Blackout'));
        const layout = filtered[num - 1];
        if (layout) {
          e.preventDefault();
          handleHotbarClick(layout.id, { shiftKey: e.shiftKey });
        }
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [layouts, previewLayout, handleTake, handleHotbarClick]);

  const isVisible = (id) => panels[id]?.visible;
  const hasLeft = isVisible('cueList') || isVisible('rundown');
  const visibleModuleConfigs = moduleConfigs.filter((mc) => !hiddenModuleConfigs[mc.moduleId]);
  const hasRight = isVisible('overlays') || isVisible('macros') || isVisible('soundboard') || isVisible('squads') || isVisible('gfx') || visibleModuleConfigs.length > 0;
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
      {isSuperAdmin && studios.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-900/20 border-b border-amber-800/40 text-xs">
          <span className="text-amber-300 font-semibold uppercase tracking-wider">Studio</span>
          <select
            value={studioId || ''}
            onChange={(e) => setStudioId(e.target.value)}
            className="px-2 py-1 bg-gray-900 border border-amber-800/50 text-white rounded text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            {studios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <span className="text-amber-400/70 ml-2">Overlays, macros, and WS events target this studio.</span>
        </div>
      )}

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

      {/* Incident banners — same ops channel as Dashboard */}
      <IncidentBar studioId={studioId} />

      {hasTop && (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-900/50 border-b border-gray-800/50 shrink-0">
          {isVisible('clockTally') && (
            <ClockTally screensOnline={onlineCount} blackoutActive={blackoutActive} />
          )}
          {isVisible('transitions') && (
            <div className="flex items-center gap-2">
              <TransitionControls
                transitionType={transitionType}
                setTransitionType={setTransitionType}
                transitionDuration={transitionDuration}
                setTransitionDuration={setTransitionDuration}
              />
              <span className="text-[10px] text-gray-500 hidden xl:inline" title="Server applies hard cut today; controls arm intent for future transition API">
                hard cut
              </span>
            </div>
          )}
          {isVisible('pvwPgm') && (
            <div className="flex-1 min-w-0">
              <PreviewProgram
                compact
                previewLayout={previewLayout}
                programLayout={programLayout}
                onTake={handleTake}
                onCut={handleCut}
                transitionType={transitionType}
                transitionDuration={transitionDuration}
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => setDirectTake((d) => !d)}
            className={`shrink-0 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-colors ${
              directTake
                ? 'bg-amber-900/40 border-amber-600/50 text-amber-300'
                : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:text-gray-200'
            }`}
            title={directTake ? 'Direct take ON — hotbar goes straight to air' : 'Direct take OFF — hotbar arms PVW (Shift+click = direct)'}
          >
            {directTake ? 'Direct' : 'Arm PVW'}
          </button>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
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
            {isVisible('rundown') && (
              <PanelShell title="Rundown" icon="📅" color="yellow" onClose={() => setPanelVisible('rundown', false)}>
                <RundownPanel inShell studioId={studioId} layouts={layouts} screens={screens} onPushLayout={handleHotbarPush} />
              </PanelShell>
            )}
          </div>
        )}

        <div className="flex-1 min-w-0 overflow-hidden">
          {isVisible('screens') && (
            <LiveScreenGrid
              screens={screens}
              layouts={layouts}
              onPushLayout={handleHotbarPush}
              onArmLayout={handleArmPreview}
              fetchData={fetchData}
            />
          )}
        </div>

        {hasRight && (
          <div className="w-[280px] shrink-0 flex flex-col gap-1 p-1 border-l border-gray-800/50 overflow-y-auto">
            {isVisible('overlays') && (
              <PanelShell title="Overlays" icon="🎭" color="purple" onClose={() => setPanelVisible('overlays', false)}>
                <OverlayPanel
                  inShell
                  compact
                  studioId={studioId}
                  activeOverlays={activeOverlays}
                  setActiveOverlays={setActiveOverlays}
                />
              </PanelShell>
            )}
            {isVisible('macros') && (
              <PanelShell title="Macros" icon="⌨️" color="blue" onClose={() => setPanelVisible('macros', false)}>
                <div className="p-2">
                  <MacroGrid compact studioId={studioId} layouts={layouts} onPushLayout={handleHotbarPush} onBlackout={requestBlackout} />
                </div>
              </PanelShell>
            )}
            {isVisible('soundboard') && (
              <PanelShell title="Soundboard" icon="🎚️" color="green" onClose={() => setPanelVisible('soundboard', false)}>
                <SoundboardPanel inShell studioId={studioId} screens={screens} />
              </PanelShell>
            )}
            {isVisible('squads') && (
              <PanelShell title="Squads" icon="👕" color="blue" onClose={() => setPanelVisible('squads', false)}>
                <SquadsPanel inShell studioId={studioId} screens={screens} />
              </PanelShell>
            )}
            {isVisible('gfx') && (
              <PanelShell title="Graphics" icon="📊" color="cyan" onClose={() => setPanelVisible('gfx', false)}>
                <GfxPanel inShell studioId={studioId} screens={screens} />
              </PanelShell>
            )}
            {visibleModuleConfigs.map((mc) => (
              <PanelShell
                key={mc.moduleId}
                title={mc.label}
                icon={mc.icon}
                color={mc.color}
                onClose={() => setHiddenModuleConfigs((prev) => ({ ...prev, [mc.moduleId]: true }))}
              >
                <ModuleConfigPanel moduleConfig={mc} studioId={studioId} />
              </PanelShell>
            ))}
          </div>
        )}
      </div>

      {/* Scenes above hotbar — multi-screen looks */}
      <div className="shrink-0 border-t border-gray-800/50">
        <SceneRail studioId={studioId} onApplied={fetchData} />
      </div>

      {hasBottom && (
        <div className="shrink-0 border-t border-gray-800/50"
          style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.7) 100%)' }}>
          <LayoutHotbar
            layouts={layouts}
            liveLayoutId={liveLayoutId}
            previewLayoutId={previewLayout?.id}
            onPush={(id) => handleHotbarClick(id, { shiftKey: false })}
            onDirectPush={(id) => handleHotbarPush(id)}
            onBlackout={() => setBlackoutConfirmOpen(true)}
            blackoutActive={blackoutActive}
            armMode={!directTake}
          />
        </div>
      )}

      <ConfirmDialog
        open={blackoutConfirmOpen}
        title={blackoutActive ? 'Restore Screens' : 'Blackout All Screens'}
        message={blackoutActive
          ? 'Restore each screen to the layout it had immediately before blackout.'
          : `This will immediately blackout all ${onlineCount} online screen${onlineCount !== 1 ? 's' : ''}. Are you sure?`}
        confirmLabel={blackoutActive ? 'Restore' : 'Blackout'}
        variant={blackoutActive ? 'warning' : 'danger'}
        onConfirm={handleBlackout}
        onCancel={() => setBlackoutConfirmOpen(false)}
      />

      {quickTextOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-label="Quick text">
          <div className="bg-gray-900 rounded-xl border border-purple-800 p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-purple-400 mb-4">Quick Text Update</h2>
            <input value={quickText} onChange={(e) => setQuickText(e.target.value)} placeholder="Main text..."
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white mb-3 focus:outline-none focus:border-purple-500" autoFocus />
            <input value={quickTextSubtitle} onChange={(e) => setQuickTextSubtitle(e.target.value)} placeholder="Subtitle (optional)..."
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white mb-4 focus:outline-none focus:border-purple-500" />
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => { setQuickTextOpen(false); setQuickText(''); setQuickTextSubtitle(''); }}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors">Cancel</button>
              <button type="button" onClick={handleQuickText} disabled={!quickText.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors">Send Live</button>
            </div>
          </div>
        </div>
      )}

      {showShortcuts && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowShortcuts(false)} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
          <div className="bg-gray-900 rounded-xl border border-gray-700 p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white mb-3">Live desk shortcuts</h2>
            <ul className="space-y-2 text-sm text-gray-300">
              <li><kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-xs font-mono">1–9</kbd> Arm layout to PVW</li>
              <li><kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-xs font-mono">Shift+1–9</kbd> Direct take to air</li>
              <li><kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-xs font-mono">Enter / Space</kbd> TAKE PVW → PGM</li>
              <li><kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-xs font-mono">B</kbd> Blackout (confirm)</li>
              <li><kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-xs font-mono">⌘K</kbd> Command palette</li>
              <li><kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-xs font-mono">⌘⇧L</kbd> Exit Live desk</li>
              <li><kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-xs font-mono">?</kbd> This help</li>
            </ul>
            <button type="button" onClick={() => setShowShortcuts(false)} className="mt-4 w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
