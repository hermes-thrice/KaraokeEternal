import React from 'react'
import HttpApi from 'lib/HttpApi'
import parseLrc, { type LrcLine } from './parseLrc'
import LrcRenderer from './LrcRenderer'
import SpotifyVisualizer from './SpotifyVisualizer'
import styles from './SpotifyPlayer.css'

const api = new HttpApi('spotify')
const lrclibApi = new HttpApi('lrclib')

interface SpotifyPlayerProps {
  isPlaying: boolean
  mediaKey: number
  mediaReplayKey?: number
  spotifyTrackId: string
  lrclibTrackId?: number | null
  volume: number
  width: number
  height: number
  onEnd(): void
  onError(error: string): void
  onLoad(): void
  onPlay(): void
  onStatus(status: { position: number }): void
}

interface SpotifyPlayerState {
  lyrics: LrcLine[]
  position: number
  isReady: boolean
  deviceId: string | null
}

class SpotifyPlayer extends React.Component<SpotifyPlayerProps, SpotifyPlayerState> {
  player: Spotify.Player | null = null
  positionInterval: ReturnType<typeof setInterval> | null = null
  isUnmounted = false
  wasPlaying = false

  state: SpotifyPlayerState = {
    lyrics: [],
    position: 0,
    isReady: false,
    deviceId: null,
  }

  componentDidMount () {
    this.isUnmounted = false
    this.loadSDK()
    this.fetchLyrics()
  }

  componentDidUpdate (prevProps: SpotifyPlayerProps) {
    if (prevProps.mediaKey !== this.props.mediaKey) {
      this.wasPlaying = false
      this.startTrack()
      this.fetchLyrics()
      return
    }

    if (prevProps.mediaReplayKey !== this.props.mediaReplayKey) {
      this.wasPlaying = false
      this.player?.seek(0)
      return
    }

    if (prevProps.isPlaying !== this.props.isPlaying) {
      if (this.props.isPlaying) {
        this.player?.resume()
      } else {
        this.player?.pause()
      }
    }

    if (prevProps.volume !== this.props.volume) {
      this.player?.setVolume(this.props.volume)
    }
  }

  componentWillUnmount () {
    this.isUnmounted = true
    this.stopPositionPolling()

    if (this.player) {
      this.player.disconnect()
      this.player = null
    }
  }

  loadSDK = () => {
    // per Spotify docs: check if SDK is already loaded
    if (window.Spotify) {
      console.log('[SpotifyPlayer] SDK already loaded, initializing player')
      this.initPlayer()
      return
    }

    // set callback for when SDK loads (per docs: window.onSpotifyWebPlaybackSDKReady)
    window.onSpotifyWebPlaybackSDKReady = () => {
      console.log('[SpotifyPlayer] SDK ready callback fired')
      if (!this.isUnmounted) this.initPlayer()
    }

    // load SDK script
    if (!document.getElementById('spotify-sdk')) {
      console.log('[SpotifyPlayer] Loading SDK script')
      const script = document.createElement('script')
      script.id = 'spotify-sdk'
      script.src = 'https://sdk.scdn.co/spotify-player.js'
      script.async = true
      script.onerror = (e) => {
        console.error('[SpotifyPlayer] SDK script failed to load', e)
        this.props.onError('Failed to load Spotify SDK. Ensure the page is served over HTTPS or localhost.')
      }
      document.body.appendChild(script)
    } else {
      console.log('[SpotifyPlayer] SDK script element exists, waiting for ready callback')
    }
  }

  initPlayer = () => {
    try {
      console.log('[SpotifyPlayer] Creating Spotify.Player instance')
      console.log('[SpotifyPlayer] window.Spotify:', typeof window.Spotify, window.Spotify)

      // per docs: create player with getOAuthToken callback
      this.player = new window.Spotify.Player({
        name: 'Karaoke Eternal',
        getOAuthToken: (cb: (token: string) => void) => {
          console.log('[SpotifyPlayer] getOAuthToken called, fetching token...')
          api.get<{ accessToken: string }>('/token')
            .then(res => {
              console.log('[SpotifyPlayer] Token received, passing to SDK')
              cb(res.accessToken)
            })
            .catch(err => {
              console.error('[SpotifyPlayer] Token fetch failed:', err)
              this.props.onError('Failed to get Spotify access token')
            })
        },
        volume: this.props.volume,
      })

      console.log('[SpotifyPlayer] Player instance created, adding listeners')

      this.player.addListener('ready', ({ device_id }) => {
        console.log('[SpotifyPlayer] Ready with Device ID', device_id)
        if (this.isUnmounted) return
        // use setState callback to ensure deviceId is set before startTrack
        this.setState({ isReady: true, deviceId: device_id }, () => {
          this.startTrack()
        })
      })

      this.player.addListener('not_ready', ({ device_id }) => {
        console.log('[SpotifyPlayer] Device ID has gone offline', device_id)
        this.setState({ isReady: false, deviceId: null })
      })

      this.player.addListener('player_state_changed', (state) => {
        if (!state || this.isUnmounted) return

        const positionSec = state.position / 1000
        this.setState({ position: positionSec })
        this.props.onStatus({ position: positionSec })

        // detect song end: transition from playing to paused at position 0
        if (this.wasPlaying && state.paused && state.position === 0) {
          console.log('[SpotifyPlayer] Track ended')
          this.wasPlaying = false
          this.props.onEnd()
          this.stopPositionPolling()
        }

        this.wasPlaying = !state.paused
      })

      this.player.addListener('initialization_error', ({ message }) => {
        console.error('[SpotifyPlayer] Initialization error:', message)
        this.props.onError(`Spotify SDK init error: ${message}`)
      })

      this.player.addListener('authentication_error', ({ message }) => {
        console.error('[SpotifyPlayer] Authentication error:', message)
        this.props.onError(`Spotify auth error: ${message}. Is the account Premium?`)
      })

      this.player.addListener('playback_error', ({ message }) => {
        console.error('[SpotifyPlayer] Playback error:', message)
        this.props.onError(`Spotify playback error: ${message}`)
      })

      console.log('[SpotifyPlayer] Calling player.connect()')
      this.player.connect().then(success => {
        if (success) {
          console.log('[SpotifyPlayer] Connected successfully')
        } else {
          console.error('[SpotifyPlayer] Failed to connect')
          this.props.onError('Spotify player failed to connect')
        }
      })
    } catch (err) {
      console.error('[SpotifyPlayer] initPlayer error:', err)
      this.props.onError(`Spotify player init failed: ${err.message}`)
    }
  }

  startTrack = async () => {
    if (!this.state.deviceId || !this.props.spotifyTrackId) {
      console.log('[SpotifyPlayer] startTrack skipped: deviceId=%s, trackId=%s', this.state.deviceId, this.props.spotifyTrackId)
      return
    }

    console.log('[SpotifyPlayer] Starting track:', this.props.spotifyTrackId)
    this.props.onLoad()

    try {
      const token = await api.get<{ accessToken: string }>('/token')

      const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${this.state.deviceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token.accessToken}`,
        },
        body: JSON.stringify({
          uris: [`spotify:track:${this.props.spotifyTrackId}`],
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        console.error('[SpotifyPlayer] Playback start failed:', res.status, text)
        this.props.onError(`Failed to start playback: ${text}`)
        return
      }

      console.log('[SpotifyPlayer] Playback started successfully')
      this.props.onPlay()
      this.startPositionPolling()
    } catch (err) {
      console.error('[SpotifyPlayer] startTrack error:', err)
      this.props.onError(`Spotify playback start failed: ${err.message}`)
    }
  }

  fetchLyrics = async () => {
    console.log('[SpotifyPlayer] fetchLyrics: lrclibTrackId=%s', this.props.lrclibTrackId)

    if (!this.props.lrclibTrackId) {
      console.log('[SpotifyPlayer] No lrclibTrackId, skipping lyrics')
      this.setState({ lyrics: [] })
      return
    }

    try {
      console.log('[SpotifyPlayer] Fetching lyrics from API...')
      const res = await lrclibApi.get<{ syncedLyrics: string }>(`/lyrics/${this.props.lrclibTrackId}`)
      console.log('[SpotifyPlayer] Lyrics API response received, isUnmounted=%s, hasData=%s',
        this.isUnmounted, !!res?.syncedLyrics)

      if (this.isUnmounted) {
        console.log('[SpotifyPlayer] Component unmounted, discarding lyrics')
        return
      }

      const lyrics = parseLrc(res.syncedLyrics)
      console.log('[SpotifyPlayer] Lyrics parsed: %d lines', lyrics.length)
      this.setState({ lyrics })
    } catch (err) {
      console.error('[SpotifyPlayer] fetchLyrics error:', err)
      this.setState({ lyrics: [] })
    }
  }

  startPositionPolling = () => {
    this.stopPositionPolling()

    this.positionInterval = setInterval(async () => {
      if (!this.player || this.isUnmounted) return

      const state = await this.player.getCurrentState()
      if (!state) return

      const positionSec = state.position / 1000
      this.setState({ position: positionSec })
      this.props.onStatus({ position: positionSec })
    }, 100)
  }

  stopPositionPolling = () => {
    if (this.positionInterval) {
      clearInterval(this.positionInterval)
      this.positionInterval = null
    }
  }

  render () {
    return (
      <div className={styles.container}>
        <SpotifyVisualizer
          analysisData={null}
          position={this.state.position}
          isPlaying={this.props.isPlaying}
          width={this.props.width}
          height={this.props.height}
        />
        {this.state.lyrics.length > 0 && (
          <LrcRenderer
            lyrics={this.state.lyrics}
            position={this.state.position}
            width={this.props.width}
            height={this.props.height}
          />
        )}
      </div>
    )
  }
}

// Spotify SDK type augmentation
declare global {
  interface Window {
    Spotify: typeof Spotify
    onSpotifyWebPlaybackSDKReady: () => void
  }
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Spotify {
    class Player {
      constructor (options: {
        name: string
        getOAuthToken: (cb: (token: string) => void) => void
        volume?: number
      })
      connect (): Promise<boolean>
      disconnect (): void
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      addListener (event: string, callback: (data: any) => void): void
      resume (): Promise<void>
      pause (): Promise<void>
      seek (positionMs: number): Promise<void>
      setVolume (volume: number): Promise<void>
      getCurrentState (): Promise<{
        position: number
        paused: boolean
        track_window: {
          current_track: unknown
        }
      } | null>
    }
  }
}

export default SpotifyPlayer
