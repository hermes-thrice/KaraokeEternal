import path from 'path'
import fs from 'fs'
import sqlite3 from 'sqlite3'
import { open as sqliteOpen, Database as SqliteDatabase } from 'sqlite'
import getLogger from '../lib/Log.js'

const log = getLogger('Lrclib')

interface LrclibMatch {
  lrclibTrackId: number
  hasSyncedLyrics: boolean
}

interface MatchInput {
  artist: string
  title: string
  durationSec: number
}

class Lrclib {
  static db: SqliteDatabase | null = null

  static async open () {
    if (Lrclib.db) return

    // find the LRCLIB database file
    const serverDir = path.join(import.meta.dirname, '..')
    const files = fs.readdirSync(serverDir).filter(f => f.startsWith('lrclib-db-dump-') && f.endsWith('.sqlite3'))

    if (!files.length) {
      log.warn('LRCLIB database not found — lyrics matching disabled')
      return
    }

    // use the most recent file if multiple
    files.sort()
    const dbFile = path.join(serverDir, files[files.length - 1])
    log.info('Opening LRCLIB database: %s', dbFile)

    try {
      Lrclib.db = await sqliteOpen({
        filename: dbFile,
        driver: sqlite3.Database,
      })

      const count = await Lrclib.db.get('SELECT COUNT(*) as count FROM tracks')
      log.info('LRCLIB database opened: %s tracks', count?.count)

      // ensure indexes exist for fast lookups
      try {
        await Lrclib.db.exec('CREATE INDEX IF NOT EXISTS idx_lyrics_track_id ON lyrics(track_id)')
        log.info('LRCLIB lyrics index verified')
      } catch (indexErr) {
        log.warn('Could not create lyrics index: %s', indexErr.message)
      }
    } catch (err) {
      log.error('Failed to open LRCLIB database: %s', err.message)
      Lrclib.db = null
    }
  }

  static async close () {
    if (Lrclib.db) {
      log.info('Closing LRCLIB database')
      await Lrclib.db.close()
      Lrclib.db = null
    }
  }

  static async matchTrack ({ artist, title, durationSec }: MatchInput): Promise<LrclibMatch | null> {
    if (!Lrclib.db) return null

    try {
      // build FTS5 query: escape special chars for MATCH
      const ftsQuery = `${escapeFts(title)} ${escapeFts(artist)}`

      const row = await Lrclib.db.get(`
        SELECT t.id, l.has_synced_lyrics
        FROM tracks_fts
        JOIN tracks t ON t.id = tracks_fts.rowid
        JOIN lyrics l ON l.track_id = t.id
        WHERE tracks_fts MATCH ?
          AND l.has_synced_lyrics = 1
          AND ABS(t.duration - ?) <= 3
        ORDER BY rank
        LIMIT 1
      `, ftsQuery, durationSec)

      if (!row) return null

      return {
        lrclibTrackId: row.id,
        hasSyncedLyrics: !!row.has_synced_lyrics,
      }
    } catch (err) {
      log.verbose('matchTrack error: %s', err.message)
      return null
    }
  }

  static async batchMatch (tracks: MatchInput[]): Promise<Map<string, LrclibMatch>> {
    const results = new Map<string, LrclibMatch>()
    if (!Lrclib.db) return results

    // tracks array corresponds to SpotifySearchTrack array by index;
    // we need the spotifyTrackId from the caller, but we receive MatchInput.
    // So we'll use index to map back. The caller passes tracks in the same order.
    // Actually, we need the caller to tell us the key. Let's make this simpler.
    // The caller in the router knows the track IDs and passes MatchInput in same order.
    // We return results by index.

    for (let i = 0; i < tracks.length; i++) {
      const match = await Lrclib.matchTrack(tracks[i])
      if (match) {
        results.set(String(i), match)
      }
    }

    return results
  }

  /**
   * Fetch synced lyrics from the LRCLIB public API.
   * The local 81GB database is used for matchTrack (search badges) via FTS5,
   * but retrieving full lyrics text from it hangs due to slow I/O on the
   * large synced_lyrics TEXT column. The API is fast and reliable.
   */
  static async getSyncedLyrics (trackId: number): Promise<string | null> {
    try {
      const res = await fetch(`https://lrclib.net/api/get/${trackId}`, {
        headers: { 'User-Agent': 'KaraokeEternal/1.0' },
      })

      if (!res.ok) {
        log.warn('LRCLIB API returned %d for trackId=%d', res.status, trackId)
        return null
      }

      const data = await res.json()
      return data.syncedLyrics || null
    } catch (err) {
      log.error('LRCLIB API error for trackId=%d: %s', trackId, err.message)
      return null
    }
  }
}

function escapeFts (str: string): string {
  // remove special FTS5 characters and wrap individual terms in quotes
  return str
    .replace(/['"*(){}[\]:^~!&|@#$%\\]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(term => `"${term}"`)
    .join(' ')
}

export default Lrclib
