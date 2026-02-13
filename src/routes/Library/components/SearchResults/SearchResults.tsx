import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { ensureState } from 'redux-optimistic-ui'
import { RootState } from 'store/store'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { toggleArtistResultExpanded } from '../../modules/library'
import { spotifySearch, spotifySearchClear } from 'store/modules/spotifySearch'
import getSearchResults from '../../selectors/getSearchResults'
import getSongsStatus from '../../selectors/getSongsStatus'
import PaddedList from 'components/PaddedList/PaddedList'
import ArtistItem from '../ArtistItem/ArtistItem'
import SongList from '../SongList/SongList'
import SpotifyResults from '../SpotifyResults/SpotifyResults'
import type { ListImperativeAPI, RowComponentProps } from 'react-window'
import type { SpotifyTrack } from 'shared/types'
import styles from './SearchResults.css'

const ROW_HEIGHT_RESULT_HEADING = 24
const ROW_HEIGHT_ARTIST = 48
const ROW_HEIGHT_SONG = 56 // 52px + 4px margin
const ROW_HEIGHT_SONG_WITH_ARTIST = 68 // 64px + 4px margin
const ROW_HEIGHT_SPOTIFY_HEADING = 36
const ROW_HEIGHT_SPOTIFY_TRACK = 64
const ROW_HEIGHT_SPOTIFY_LOADING = 48

interface SearchResultsProps {
  // starredArtistCounts: Record<number, number> // @todo
  ui: RootState['ui']
}

interface CustomRowProps {
  artists: RootState['artists']
  dispatch: ReturnType<typeof useAppDispatch>
  expandedArtists: number[]
  filterKeywords: string[]
  filterStarred: boolean
  artistsResult: number[]
  songsResult: number[]
  expandedArtistResults: number[]
  spotifyResults: SpotifyTrack[]
  spotifyIsSearching: boolean
  spotifyIsConnected: boolean
}

// this is outside the SearchResults component to keep the reference as stable as possible,
// as react-window will re-render the list (breaking animations) when RowComponent changes
const RowComponent = ({
  index,
  style,
  // below are also used in SearchResults and passed via rowProps to avoid duplicate effort
  dispatch,
  artists,
  filterKeywords,
  filterStarred,
  artistsResult,
  songsResult,
  expandedArtistResults,
  spotifyResults,
  spotifyIsSearching,
  spotifyIsConnected,
}: RowComponentProps<CustomRowProps>) => {
  const { starredSongs } = useAppSelector(state => ensureState(state.userStars))
  const { upcoming } = useAppSelector(getSongsStatus)

  // calculate the start index for Spotify section
  const spotifyStartIndex = artistsResult.length + 3

  // # artist results heading
  if (index === 0) {
    return (
      <div key='artistsHeading' style={style} className={styles.artistsHeading}>
        {artistsResult.length}
        {' '}
        {filterStarred ? 'starred ' : ''}
        {artistsResult.length === 1 ? 'artist' : 'artists'}
      </div>
    )
  }

  // artist results
  if (index > 0 && index < artistsResult.length + 1) {
    const artistId = artistsResult[index - 1]
    const artist = artists.entities[artistId]

    return (
      <ArtistItem
        artistSongIds={artist.songIds}
        // numStars={props.starredArtistCounts[artistId] || 0}
        filterKeywords={filterKeywords}
        isExpanded={expandedArtistResults.includes(artistId)}
        key={artistId}
        name={artist.name}
        numStars={0}
        onArtistClick={() => dispatch(toggleArtistResultExpanded(artistId))}
        upcomingSongs={upcoming}
        starredSongs={starredSongs}
        style={style}
      />
    )
  }

  // # song results heading
  if (index === artistsResult.length + 1) {
    return (
      <div key='songsHeading' style={style} className={styles.songsHeading}>
        {songsResult.length}
        {' '}
        {filterStarred ? 'starred ' : ''}
        {songsResult.length === 1 ? 'song' : 'songs'}
      </div>
    )
  }

  // song results
  if (index === artistsResult.length + 2) {
    return (
      <div style={style} key='songs'>
        <SongList
          songIds={songsResult}
          showArtist
          filterKeywords={filterKeywords}
        />
      </div>
    )
  }

  // Spotify section
  if (spotifyIsConnected && index >= spotifyStartIndex) {
    return (
      <div style={style} key='spotify'>
        <SpotifyResults
          results={spotifyResults}
          isSearching={spotifyIsSearching}
        />
      </div>
    )
  }

  return null
}

const SearchResults = ({ ui }: SearchResultsProps) => {
  const dispatch = useAppDispatch()
  const artists = useAppSelector(state => state.artists)
  const expandedArtistResults = useAppSelector(state => state.library.expandedArtistResults)
  const { filterStr, filterStarred } = useAppSelector(state => state.library)
  const { artistsResult, songsResult } = useAppSelector(getSearchResults)
  const { results: spotifyResults, isSearching: spotifyIsSearching } = useAppSelector(state => state.spotifySearch)
  const spotifyIsConnected = useAppSelector(state => state.prefs.isSpotifyConnected)

  const listRef = useRef<ListImperativeAPI | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const filterKeywords = useMemo(() => filterStr.trim() ? filterStr.trim().toLowerCase().split(' ') : [], [filterStr])

  // debounced Spotify search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const query = filterStr.trim()

    if (!spotifyIsConnected || query.length < 3) {
      dispatch(spotifySearchClear())
      return
    }

    debounceRef.current = setTimeout(() => {
      dispatch(spotifySearch(query))
    }, 500)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [filterStr, spotifyIsConnected, dispatch])

  const hasSpotifySection = spotifyIsConnected && (spotifyResults.length > 0 || spotifyIsSearching)
  const spotifyRowHeight = spotifyIsSearching && spotifyResults.length === 0
    ? ROW_HEIGHT_SPOTIFY_LOADING
    : ROW_HEIGHT_SPOTIFY_HEADING + spotifyResults.length * ROW_HEIGHT_SPOTIFY_TRACK

  const rowHeight = useCallback((index: number) => {
    // artists heading
    if (index === 0) return ROW_HEIGHT_RESULT_HEADING

    // artist results
    if (index > 0 && index < artistsResult.length + 1) {
      const artistId = artistsResult[index - 1]
      let height = ROW_HEIGHT_ARTIST

      if (expandedArtistResults.includes(artistId)) {
        height += artists.entities[artistId].songIds.length * ROW_HEIGHT_SONG
      }

      return height
    }

    // songs heading
    if (index === artistsResult.length + 1) return ROW_HEIGHT_RESULT_HEADING

    // song results
    if (index === artistsResult.length + 2) return songsResult.length * ROW_HEIGHT_SONG_WITH_ARTIST

    // Spotify section
    if (index === artistsResult.length + 3) return spotifyRowHeight

    return 0
  }, [artistsResult, expandedArtistResults, artists.entities, songsResult.length, spotifyRowHeight])

  const handleRef = useCallback((ref: ListImperativeAPI) => {
    if (ref) {
      listRef.current = ref
      // listRef.current.scrollToRow({ index: props.scrollRow, align: 'start' })
    }
  }, [])

  return (
    <PaddedList
      rowComponent={RowComponent}
      rowProps={{
        dispatch,
        artists,
        filterStarred,
        filterKeywords,
        artistsResult,
        songsResult,
        expandedArtistResults,
        spotifyResults,
        spotifyIsSearching,
        spotifyIsConnected,
      }}
      rowHeight={rowHeight}
      numRows={artistsResult.length + 3 + (hasSpotifySection ? 1 : 0)}
      paddingTop={ui.headerHeight}
      paddingRight={4}
      paddingBottom={ui.footerHeight}
      height={ui.innerHeight}
      onRef={handleRef}
    />
  )
}

export default SearchResults
