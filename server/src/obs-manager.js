const OBSWebSocket = require('obs-websocket-js').default;

class OBSManager {
  constructor() {
    this.obs = new OBSWebSocket();
    this.connected = false;
    this.config = {
      host: '10.2.60.237',
      port: 4455,
      password: 'TnvLJfiSLhgm9f17',
    };
    this._reconnectTimer = null;
    this._listeners = new Set();

    this.obs.on('ConnectionClosed', () => {
      this.connected = false;
      this._notify('disconnected');
    });

    this.obs.on('CurrentProgramSceneChanged', (data) => {
      this._notify('scene-changed', { scene: data.sceneName });
    });

    this.obs.on('StreamStateChanged', (data) => {
      this._notify('stream-state', { active: data.outputActive, state: data.outputState });
    });
  }

  _notify(event, data = {}) {
    for (const fn of this._listeners) {
      try { fn(event, data); } catch {}
    }
  }

  onEvent(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  async connect(config) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    try {
      const url = `ws://${this.config.host}:${this.config.port}`;
      await this.obs.connect(url, this.config.password);
      this.connected = true;
      this._notify('connected');
      return { ok: true };
    } catch (err) {
      this.connected = false;
      return { ok: false, error: err.message };
    }
  }

  async disconnect() {
    try {
      await this.obs.disconnect();
    } catch {}
    this.connected = false;
    this._notify('disconnected');
  }

  async getScenes() {
    if (!this.connected) throw new Error('Not connected to OBS');
    const { scenes, currentProgramSceneName } = await this.obs.call('GetSceneList');
    return {
      scenes: scenes.map(s => ({
        name: s.sceneName,
        index: s.sceneIndex,
      })).reverse(),
      current: currentProgramSceneName,
    };
  }

  async setScene(sceneName) {
    if (!this.connected) throw new Error('Not connected to OBS');
    await this.obs.call('SetCurrentProgramScene', { sceneName });
    return { ok: true, scene: sceneName };
  }

  async getStreamStatus() {
    if (!this.connected) throw new Error('Not connected to OBS');
    const status = await this.obs.call('GetStreamStatus');
    return {
      active: status.outputActive,
      reconnecting: status.outputReconnecting,
      timecode: status.outputTimecode,
      duration: status.outputDuration,
      bytes: status.outputBytes,
      skippedFrames: status.outputSkippedFrames,
      totalFrames: status.outputTotalFrames,
    };
  }

  async getStats() {
    if (!this.connected) throw new Error('Not connected to OBS');
    const stats = await this.obs.call('GetStats');
    return {
      cpuUsage: stats.cpuUsage,
      memoryUsage: stats.memoryUsage,
      renderSkipped: stats.renderSkippedFrames,
      renderTotal: stats.renderTotalFrames,
      outputSkipped: stats.outputSkippedFrames,
      outputTotal: stats.outputTotalFrames,
      fps: stats.activeFps,
    };
  }

  async setSceneSource(sceneName, sourceUrl) {
    if (!this.connected) throw new Error('Not connected to OBS');
    // Get items in the scene
    const { sceneItems } = await this.obs.call('GetSceneItemList', { sceneName });
    // Find browser source
    const browser = sceneItems.find(item => item.inputKind === 'browser_source');
    if (!browser) throw new Error('No browser source found in scene');
    // Update URL
    await this.obs.call('SetInputSettings', {
      inputName: browser.sourceName,
      inputSettings: { url: sourceUrl },
    });
    return { ok: true, source: browser.sourceName };
  }

  getStatus() {
    return {
      connected: this.connected,
      host: this.config.host,
      port: this.config.port,
    };
  }
}

// Singleton
const manager = new OBSManager();
module.exports = { obsManager: manager };
