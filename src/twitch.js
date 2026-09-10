let cachedToken = null;
let tokenExpiresAt = 0;

async function getAppAccessToken(clientId, clientSecret) {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60000) return cachedToken;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials'
  });

  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Twitch token request failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + Number(data.expires_in || 0) * 1000;
  return cachedToken;
}

export async function getCurrentTwitchStream(login, clientId, clientSecret) {
  const token = await getAppAccessToken(clientId, clientSecret);
  const url = new URL('https://api.twitch.tv/helix/streams');
  url.searchParams.set('user_login', login);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Client-Id': clientId
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Twitch stream check failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  const stream = data.data?.[0];
  if (!stream) return null;

  return {
    streamId: stream.id,
    title: stream.title,
    gameName: stream.game_name || 'Live on Twitch',
    viewerCount: stream.viewer_count,
    startedAt: stream.started_at,
    url: `https://www.twitch.tv/${encodeURIComponent(login)}`,
    thumbnail: stream.thumbnail_url
      ?.replace('{width}', '1280')
      .replace('{height}', '720') + `?t=${Date.now()}`
  };
}
