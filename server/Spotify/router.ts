import KoaRouter from '@koa/router'
import getLogger from '../lib/Log.js'
import Spotify from './Spotify.js'
import Lrclib from '../Lrclib/Lrclib.js'

const log = getLogger('Spotify')
const router = new KoaRouter({ prefix: '/api/spotify' })

// GET /api/spotify/status — anyone authenticated
router.get('/status', async (ctx) => {
  const prefs = await (await import('../Prefs/Prefs.js')).default.get()

  ctx.body = {
    isConfigured: Spotify.isConfigured,
    isConnected: !!prefs.isSpotifyConnected,
  }
})

// GET /api/spotify/auth — admin only, returns OAuth URL
router.get('/auth', async (ctx) => {
  if (!ctx.user.isAdmin) {
    ctx.throw(401)
  }

  if (!Spotify.isConfigured) {
    ctx.throw(400, 'Spotify client ID and secret are not configured')
  }

  const baseUrl = `${ctx.protocol}://${ctx.host}`
  const urlPath = ctx.request.path.replace(/\/api\/spotify\/auth$/, '')
  const redirectUri = `${baseUrl}${urlPath}/api/spotify/callback`

  ctx.body = { url: Spotify.getAuthUrl(redirectUri) }
})

// GET /api/spotify/callback — OAuth redirect from Spotify
router.get('/callback', async (ctx) => {
  const { code, error } = ctx.query

  if (error) {
    log.error('OAuth callback error: %s', error)
    ctx.redirect('../../account/?spotifyError=' + encodeURIComponent(String(error)))
    return
  }

  if (!code) {
    ctx.throw(400, 'Missing authorization code')
  }

  const baseUrl = `${ctx.protocol}://${ctx.host}`
  const urlPath = ctx.request.path.replace(/\/api\/spotify\/callback$/, '')
  const redirectUri = `${baseUrl}${urlPath}/api/spotify/callback`

  try {
    await Spotify.exchangeCode(String(code), redirectUri)
    ctx.redirect('../../account/?spotifyConnected=true')
  } catch (err) {
    log.error('OAuth exchange error: %s', err.message)
    ctx.redirect('../../account/?spotifyError=' + encodeURIComponent(err.message))
  }
})

// GET /api/spotify/token — authenticated, returns access token for SDK
router.get('/token', async (ctx) => {
  if (!ctx.user.userId) {
    ctx.throw(401)
  }

  const token = await Spotify.getAccessToken()

  if (!token) {
    ctx.throw(401, 'Spotify not connected')
  }

  ctx.body = { accessToken: token }
})

// DELETE /api/spotify/auth — admin only, clears tokens
router.delete('/auth', async (ctx) => {
  if (!ctx.user.isAdmin) {
    ctx.throw(401)
  }

  await Spotify.revokeTokens()
  ctx.status = 200
  ctx.body = { success: true }
})

// GET /api/spotify/search?q=... — any authenticated user
router.get('/search', async (ctx) => {
  if (!ctx.user.userId) {
    ctx.throw(401)
  }

  const q = ctx.query.q as string
  if (!q || q.length < 2) {
    ctx.throw(400, 'Query too short')
  }

  try {
    const tracks = await Spotify.search(q)

    // batch match against LRCLIB for lyrics badges
    const lrclibMatches = await Lrclib.batchMatch(tracks.map(t => ({
      artist: t.artist,
      title: t.title,
      durationSec: t.durationMs / 1000,
    })))

    ctx.body = {
      tracks: tracks.map((t, i) => ({
        ...t,
        hasLyrics: lrclibMatches.has(String(i)) ? lrclibMatches.get(String(i)).hasSyncedLyrics : false,
        lrclibTrackId: lrclibMatches.get(String(i))?.lrclibTrackId || null,
      })),
    }
  } catch (err) {
    log.error('Search error: %s', err.message)
    ctx.throw(500, err.message)
  }
})


export default router
