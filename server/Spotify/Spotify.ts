import getLogger from '../lib/Log.js'
import Prefs from '../Prefs/Prefs.js'
import env from '../lib/cli.js'

const log = getLogger('Spotify')

interface SpotifyTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

interface SpotifySearchTrack {
  spotifyTrackId: string
  title: string
  artist: string
  album: string
  albumArt: string
  durationMs: number
}

class Spotify {
  static get isConfigured () {
    return !!(env.KES_SPOTIFY_CLIENT_ID && env.KES_SPOTIFY_CLIENT_SECRET)
  }

  static getAuthUrl (redirectUri: string) {
    const scopes = 'streaming user-read-email user-read-private user-modify-playback-state'
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: env.KES_SPOTIFY_CLIENT_ID,
      scope: scopes,
      redirect_uri: redirectUri,
    })

    return `https://accounts.spotify.com/authorize?${params}`
  }

  static async exchangeCode (code: string, redirectUri: string) {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(
          `${env.KES_SPOTIFY_CLIENT_ID}:${env.KES_SPOTIFY_CLIENT_SECRET}`,
        ).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      log.error('Token exchange failed: %s', text)
      throw new Error('Spotify token exchange failed')
    }

    const data = await res.json()

    const tokens: SpotifyTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
    }

    await Prefs.set('spotifyTokens', tokens)
    log.info('Spotify tokens stored successfully')
    return tokens
  }

  static async getAccessToken (): Promise<string | null> {
    const tokens = await Prefs.getKey('spotifyTokens') as SpotifyTokens | null

    if (!tokens) return null

    // refresh if within 5 minutes of expiry
    if (Date.now() > tokens.expiresAt - 5 * 60 * 1000) {
      log.info('Access token expired, refreshing...')
      return Spotify.refreshAccessToken(tokens.refreshToken)
    }

    return tokens.accessToken
  }

  static async refreshAccessToken (refreshToken: string): Promise<string | null> {
    try {
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(
            `${env.KES_SPOTIFY_CLIENT_ID}:${env.KES_SPOTIFY_CLIENT_SECRET}`,
          ).toString('base64'),
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        log.error('Token refresh failed: %s %s', res.status, text)
        return null
      }

      const data = await res.json()

      const tokens: SpotifyTokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresAt: Date.now() + (data.expires_in * 1000),
      }

      await Prefs.set('spotifyTokens', tokens)
      return tokens.accessToken
    } catch (err) {
      log.error('Token refresh error: %s', err.message)
      return null
    }
  }

  static async search (query: string): Promise<SpotifySearchTrack[]> {
    const token = await Spotify.getAccessToken()
    if (!token) throw new Error('Spotify not connected')

    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      const text = await res.text()
      log.error('Search failed: %s %s', res.status, text)
      throw new Error('Spotify search failed')
    }

    const data = await res.json()

    return data.tracks.items.map(track => ({
      spotifyTrackId: track.id,
      title: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      album: track.album.name,
      albumArt: track.album.images?.[0]?.url || '',
      durationMs: track.duration_ms,
    }))
  }

  static async revokeTokens () {
    await Prefs.set('spotifyTokens', null)
    log.info('Spotify tokens cleared')
  }
}

export default Spotify
export type { SpotifySearchTrack }
