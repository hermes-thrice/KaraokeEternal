import React, { useCallback } from 'react'
import { useAppDispatch } from 'store/hooks'
import { queueSpotifySong } from 'routes/Queue/modules/queue'
import Spinner from 'components/Spinner/Spinner'
import type { SpotifyTrack } from 'shared/types'
import styles from './SpotifyResults.css'

interface SpotifyResultsProps {
  results: SpotifyTrack[]
  isSearching: boolean
}

const SpotifyResults = ({ results, isSearching }: SpotifyResultsProps) => {
  const dispatch = useAppDispatch()

  const handleClick = useCallback((track: SpotifyTrack) => {
    dispatch(queueSpotifySong(track))
  }, [dispatch])

  if (isSearching && results.length === 0) {
    return (
      <div className={styles.loading}>
        <Spinner />
      </div>
    )
  }

  if (results.length === 0) return null

  return (
    <div className={styles.container}>
      <div className={styles.heading}>
        <span className={styles.spotifyIcon}>
          <svg viewBox='0 0 24 24' width='16' height='16' fill='currentColor'>
            <path d='M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z' />
          </svg>
        </span>
        More on Spotify
        {isSearching && <span className={styles.searchingDot} />}
      </div>
      {results.map(track => (
        <SpotifyTrackItem
          key={track.spotifyTrackId}
          track={track}
          onClick={handleClick}
        />
      ))}
    </div>
  )
}

interface SpotifyTrackItemProps {
  track: SpotifyTrack
  onClick: (track: SpotifyTrack) => void
}

const SpotifyTrackItem = React.memo(({ track, onClick }: SpotifyTrackItemProps) => {
  const handleClick = useCallback(() => onClick(track), [onClick, track])
  const minutes = Math.floor(track.durationMs / 60000)
  const seconds = Math.floor((track.durationMs % 60000) / 1000)

  return (
    <div className={styles.track} onClick={handleClick}>
      {track.albumArt && (
        <img
          className={styles.albumArt}
          src={track.albumArt}
          alt=''
          width={48}
          height={48}
          loading='lazy'
        />
      )}
      <div className={styles.trackInfo}>
        <div className={styles.trackTitle} translate='no'>{track.title}</div>
        <div className={styles.trackArtist} translate='no'>{track.artist}</div>
      </div>
      <div className={styles.trackMeta}>
        <span className={styles.duration}>
          {minutes}
          :
          {String(seconds).padStart(2, '0')}
        </span>
        {track.hasLyrics && <span className={styles.lyricsTag}>LRC</span>}
      </div>
    </div>
  )
})

SpotifyTrackItem.displayName = 'SpotifyTrackItem'

export default SpotifyResults
