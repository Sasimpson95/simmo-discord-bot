import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.resolve('data');
const filePath = path.join(dataDir, 'state.json');

const defaultState = {
  aoe4: {
    wins: 0,
    losses: 0,
    currentStreak: 0,
    bestWinStreak: 0,
    lastResult: null,
    updatedAt: null
  },
  aoe4world: {
    initialized: false,
    lastSyncAt: null,
    processedGameIds: []
  },
  youtube: {
    channelId: null,
    uploadsPlaylistId: null,
    lastVideoId: null,
    initialized: false
  },
  twitch: {
    activeStreamId: null,
    initialized: false
  }
};

function ensureStore() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultState, null, 2));
  }
}

function normalizeState(raw = {}) {
  return {
    ...structuredClone(defaultState),
    ...raw,
    aoe4: { ...defaultState.aoe4, ...(raw.aoe4 ?? {}) },
    aoe4world: { ...defaultState.aoe4world, ...(raw.aoe4world ?? {}) },
    youtube: { ...defaultState.youtube, ...(raw.youtube ?? {}) },
    twitch: { ...defaultState.twitch, ...(raw.twitch ?? {}) }
  };
}

export function loadState() {
  ensureStore();
  try {
    return normalizeState(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch {
    return structuredClone(defaultState);
  }
}

export function saveState(state) {
  ensureStore();
  const temp = `${filePath}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(normalizeState(state), null, 2));
  fs.renameSync(temp, filePath);
}

export function updateState(mutator) {
  const state = loadState();
  mutator(state);
  saveState(state);
  return state;
}
