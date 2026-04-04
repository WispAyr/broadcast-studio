import React, { useState, useEffect, useRef } from "react";

export default function RemotionModule({ config = {} }) {
  const {
    compositionId = "",
    serverUrl = "",
    src = "",
    width = 1920,
    height = 1080,
    loop = true,
    autoplay = true,
    muted = true,
    background = "#000",
    inputProps = "{}",
  } = config;

  // If a direct video src is provided, render as video
  const videoSrc = src || "";
  
  // If serverUrl + compositionId, build Remotion Player URL
  const remotionUrl = serverUrl && compositionId
    ? `${serverUrl.replace(/\/$/, "")}/api/render?compositionId=${encodeURIComponent(compositionId)}&width=${width}&height=${height}&inputProps=${encodeURIComponent(typeof inputProps === "string" ? inputProps : JSON.stringify(inputProps))}`
    : "";

  // Prefer direct src, then remotion URL
  const mediaSrc = videoSrc || remotionUrl;

  if (!mediaSrc && !compositionId) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background }}>
        <div className="text-center">
          <span className="text-4xl block mb-2">🎬</span>
          <span className="text-gray-500 text-sm">Remotion Composition</span>
          <span className="text-gray-600 text-xs block mt-1">Set compositionId + serverUrl or video src</span>
        </div>
      </div>
    );
  }

  // If we have a remotion server URL but no direct src, embed as iframe
  if (!videoSrc && remotionUrl) {
    return (
      <div className="w-full h-full" style={{ background }}>
        <iframe
          src={remotionUrl}
          className="w-full h-full border-0"
          allow="autoplay"
          title={`Remotion: ${compositionId}`}
        />
      </div>
    );
  }

  // Direct video playback
  return (
    <div className="w-full h-full" style={{ background }}>
      <video
        src={mediaSrc}
        autoPlay={autoplay}
        loop={loop}
        muted={muted}
        playsInline
        className="w-full h-full object-cover"
      />
    </div>
  );
}

// Config panel for the layout editor
export function RemotionModuleConfig({ config = {}, onChange }) {
  const update = (key, value) => onChange({ ...config, [key]: value });

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-400 block mb-1">Server URL</label>
        <input
          type="text"
          value={config.serverUrl || ""}
          onChange={(e) => update("serverUrl", e.target.value)}
          placeholder="http://localhost:3500"
          className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-xs"
        />
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1">Composition ID</label>
        <input
          type="text"
          value={config.compositionId || ""}
          onChange={(e) => update("compositionId", e.target.value)}
          placeholder="MyComposition"
          className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-xs"
        />
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1">Video Source (direct URL)</label>
        <input
          type="text"
          value={config.src || ""}
          onChange={(e) => update("src", e.target.value)}
          placeholder="/uploads/video.mp4"
          className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-xs"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Width</label>
          <input type="number" value={config.width || 1920} onChange={(e) => update("width", parseInt(e.target.value))}
            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-xs" />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Height</label>
          <input type="number" value={config.height || 1080} onChange={(e) => update("height", parseInt(e.target.value))}
            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-xs" />
        </div>
      </div>
      <div className="flex gap-3">
        <label className="flex items-center gap-1.5 text-xs text-gray-300">
          <input type="checkbox" checked={config.loop !== false} onChange={(e) => update("loop", e.target.checked)} className="rounded" /> Loop
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-300">
          <input type="checkbox" checked={config.muted !== false} onChange={(e) => update("muted", e.target.checked)} className="rounded" /> Muted
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-300">
          <input type="checkbox" checked={config.autoplay !== false} onChange={(e) => update("autoplay", e.target.checked)} className="rounded" /> Autoplay
        </label>
      </div>
    </div>
  );
}
