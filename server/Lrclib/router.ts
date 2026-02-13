import KoaRouter from '@koa/router'
import getLogger from '../lib/Log.js'
import Lrclib from './Lrclib.js'

const log = getLogger('Lrclib')
const router = new KoaRouter({ prefix: '/api/lrclib' })

// GET /api/lrclib/lyrics/:trackId — returns synced lyrics for an LRCLIB track
router.get('/lyrics/:trackId', async (ctx) => {
  if (!ctx.user.userId) {
    ctx.throw(401)
  }

  const trackId = parseInt(ctx.params.trackId, 10)

  if (isNaN(trackId)) {
    ctx.throw(400, 'Invalid track ID')
  }

  const start = Date.now()
  const syncedLyrics = await Lrclib.getSyncedLyrics(trackId)
  log.info('getSyncedLyrics trackId=%d took %dms, found=%s', trackId, Date.now() - start, !!syncedLyrics)

  if (!syncedLyrics) {
    ctx.throw(404, 'Lyrics not found')
  }

  ctx.body = { syncedLyrics }
})

export default router
