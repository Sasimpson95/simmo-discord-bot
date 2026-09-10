const API_BASE = 'https://aoe4world.com/api/v0';

function requestHeaders() {
  return {
    Accept: 'application/json',
    // AoE4World asks automated clients to identify themselves rather than spoof a browser UA.
    'User-Agent': 'Simmo-AOE4-Discord-Bot/1.3 (Discord bot; AoE4World profile watcher)'
  };
}

async function apiGet(url) {
  const response = await fetch(url, { headers: requestHeaders() });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`AoE4World API ${response.status}: ${body.slice(0, 180)}`);
  }
  return response.json();
}

function unwrapGames(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.games)) return payload.games;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function playerFromSlot(slot) {
  if (!slot || typeof slot !== 'object') return null;
  return slot.player && typeof slot.player === 'object' ? slot.player : slot;
}

function allPlayers(game) {
  const teams = Array.isArray(game?.teams) ? game.teams : [];
  return teams.flatMap(team => {
    const members = Array.isArray(team) ? team : Array.isArray(team?.players) ? team.players : [team];
    return members.map(playerFromSlot).filter(Boolean);
  });
}

export function getTrackedPlayer(game, profileId) {
  const wanted = String(profileId);
  return allPlayers(game).find(player => String(player?.profile_id ?? player?.profileId ?? '') === wanted) ?? null;
}

export function getGameResult(game, profileId) {
  const player = getTrackedPlayer(game, profileId);
  if (!player) return null;

  const raw = player.result ?? player.outcome ?? player.status;
  if (typeof raw === 'string') {
    const normalized = raw.toLowerCase();
    if (['win', 'won', 'victory'].includes(normalized)) return 'win';
    if (['loss', 'lost', 'defeat'].includes(normalized)) return 'loss';
  }
  if (player.won === true || player.winner === true) return 'win';
  if (player.won === false || player.winner === false) return 'loss';
  return null;
}

export function summarizeGame(game, profileId) {
  const player = getTrackedPlayer(game, profileId);
  const players = allPlayers(game);
  const opponents = players.filter(p => String(p?.profile_id ?? p?.profileId ?? '') !== String(profileId));
  const opponentNames = opponents.map(p => p?.name).filter(Boolean).join(', ') || 'Unknown opponent';

  return {
    gameId: String(game?.game_id ?? game?.gameId ?? game?.id ?? ''),
    result: getGameResult(game, profileId),
    map: game?.map ?? game?.map_name ?? game?.mapName ?? 'Unknown map',
    kind: game?.kind ?? game?.leaderboard ?? game?.game_type ?? 'Age of Empires IV',
    startedAt: game?.started_at ?? game?.startedAt ?? null,
    updatedAt: game?.updated_at ?? game?.updatedAt ?? null,
    duration: game?.duration ?? null,
    civilization: player?.civilization ?? player?.civ ?? null,
    opponentNames,
    url: game?.game_id || game?.gameId || game?.id
      ? `https://aoe4world.com/players/${profileId}/games/${game?.game_id ?? game?.gameId ?? game?.id}`
      : `https://aoe4world.com/players/${profileId}`
  };
}

export async function getRecentPlayerGames(profileId, { leaderboard = 'rm_solo', since = null, limit = 20 } = {}) {
  const url = new URL(`${API_BASE}/players/${encodeURIComponent(profileId)}/games`);
  url.searchParams.set('limit', String(limit));
  if (leaderboard) url.searchParams.set('leaderboard', leaderboard);
  if (since) url.searchParams.set('since', since);
  return unwrapGames(await apiGet(url));
}

export async function getLastPlayerGame(profileId) {
  const payload = await apiGet(`${API_BASE}/players/${encodeURIComponent(profileId)}/games/last`);
  if (!payload || Array.isArray(payload)) return null;
  return payload;
}

export function gameSortTime(game) {
  const raw = game?.started_at ?? game?.startedAt ?? game?.updated_at ?? game?.updatedAt;
  const time = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(time) ? time : 0;
}
