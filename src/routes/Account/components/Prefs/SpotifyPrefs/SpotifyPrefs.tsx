import React, { useCallback, useState } from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { fetchPrefs } from 'store/modules/prefs'
import Accordion from 'components/Accordion/Accordion'
import HttpApi from 'lib/HttpApi'
import styles from './SpotifyPrefs.css'

const api = new HttpApi('spotify')

const SpotifyPrefs = () => {
  const { isSpotifyConfigured: isConfigured, isSpotifyConnected: isConnected } = useAppSelector(state => state.prefs)
  const dispatch = useAppDispatch()
  const [isLoading, setIsLoading] = useState(false)

  const handleConnect = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await api.get<{ url: string }>('/auth')
      window.location.href = res.url
    } catch (err) {
      alert(err.message)
      setIsLoading(false)
    }
  }, [])

  const handleDisconnect = useCallback(async () => {
    if (!confirm('Disconnect Spotify?')) return

    setIsLoading(true)
    try {
      await api.delete('/auth')
      dispatch(fetchPrefs())
    } catch (err) {
      alert(err.message)
    }
    setIsLoading(false)
  }, [dispatch])

  // check for query params (redirect from OAuth)
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('spotifyConnected') || params.has('spotifyError')) {
      dispatch(fetchPrefs())
      // clean up URL
      const url = new URL(window.location.href)
      url.searchParams.delete('spotifyConnected')
      url.searchParams.delete('spotifyError')
      window.history.replaceState({}, '', url.toString())

      if (params.has('spotifyError')) {
        alert('Spotify connection failed: ' + params.get('spotifyError'))
      }
    }
  }, [dispatch])

  if (!isConfigured && !isConnected) return null

  return (
    <Accordion
      className={styles.container}
      headingComponent={(
        <div className={styles.heading}>
          <svg viewBox='0 0 24 24' width='28' height='28' fill='currentColor' className={styles.icon}>
            <path d='M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z' />
          </svg>
          <div className={styles.title}>Spotify</div>
          {isConnected && <span className={styles.badge}>Connected</span>}
        </div>
      )}
    >
      <div className={styles.content}>
        {isConnected
          ? (
              <>
                <p className={styles.status}>Spotify is connected. Users can search and queue Spotify tracks.</p>
                <button
                  className={styles.disconnectBtn}
                  onClick={handleDisconnect}
                  disabled={isLoading}
                >
                  {isLoading ? 'Disconnecting...' : 'Disconnect Spotify'}
                </button>
              </>
            )
          : (
              <>
                <p className={styles.status}>Connect a Spotify Premium account to enable streaming.</p>
                <button
                  className={styles.connectBtn}
                  onClick={handleConnect}
                  disabled={isLoading}
                >
                  {isLoading ? 'Connecting...' : 'Connect Spotify'}
                </button>
              </>
            )}
      </div>
    </Accordion>
  )
}

export default SpotifyPrefs
