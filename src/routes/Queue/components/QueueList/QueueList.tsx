import React, { useCallback } from 'react'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { ensureState } from 'redux-optimistic-ui'
import QueueItem from '../QueueItem/QueueItem'
import QueueListAnimator from '../QueueListAnimator/QueueListAnimator'
import { formatSeconds } from 'lib/dateTime'
import { moveItem, removeUpcomingItems } from '../../modules/queue'
import getPlayerHistory from '../../selectors/getPlayerHistory'
import getRoundRobinQueue from '../../selectors/getRoundRobinQueue'
import getWaits from '../../selectors/getWaits'

const QueueList = () => {
  const artists = useAppSelector(state => state.artists)
  const { errorMessage, isAtQueueEnd, isErrored, isPlaying, position, queueId } = useAppSelector(state => state.status)

  const playerHistory = useAppSelector(getPlayerHistory)
  const queue = useAppSelector(getRoundRobinQueue)
  const songs = useAppSelector(state => state.songs)
  const starredSongs = useAppSelector(state => ensureState(state.userStars).starredSongs)
  const user = useAppSelector(state => state.user)
  const waits = useAppSelector(getWaits)

  // actions
  const dispatch = useAppDispatch()
  const handleMoveClick = useCallback((qId: number) => {
    // reference user's last-played item as the new prevQueueId
    const userId = queue.entities[qId].userId
    let lastPlayed = queueId // default in case user has no played items

    for (let i = queue.result.indexOf(queueId); i >= 0; i--) {
      if (queue.entities[queue.result[i]].userId === userId) {
        lastPlayed = queue.result[i]
        break
      }
    }

    dispatch(moveItem({ queueId: qId, prevQueueId: lastPlayed }))
  }, [dispatch, queueId, queue.entities, queue.result])

  const handleRemoveUpcoming = useCallback((userId: number) => {
    dispatch(removeUpcomingItems(userId))
  }, [dispatch])

  // build children array
  const items = queue.result.map((qId) => {
    const item = queue.entities[qId]
    const isSpotify = item.mediaType === 'spotify' || ('spotifyTrackId' in item && item.spotifyTrackId)
    const song = !isSpotify && item.songId ? songs.entities[item.songId] : null
    const duration = isSpotify
      ? (('spotifyDurationMs' in item ? item.spotifyDurationMs : 0) || 0) / 1000
      : (song?.duration || 0)
    const isCurrent = (qId === queueId) && !isAtQueueEnd
    const isUpcoming = qId !== queueId && !playerHistory.includes(qId)
    const isOwner = item.userId === user.userId
    const title = isSpotify ? (('spotifyTitle' in item ? item.spotifyTitle : '') || 'Spotify Track') : (song?.title || '')
    const artist = isSpotify ? (('spotifyArtist' in item ? item.spotifyArtist : '') || '') : (song ? artists.entities[song.artistId]?.name || '' : '')

    return (
      <QueueItem
        {...item}
        artist={artist}
        errorMessage={isCurrent && errorMessage ? errorMessage : ''}
        isCurrent={isCurrent}
        key={qId}
        isErrored={isCurrent && isErrored}
        isInfoable={!isSpotify && user.isAdmin}
        isMovable={isUpcoming && (isOwner || user.isAdmin)}
        isOwner={isOwner}
        isPlayed={!isUpcoming && !isCurrent}
        isPlaying={isCurrent && isPlaying}
        isRemovable={isUpcoming && (isOwner || user.isAdmin)}
        isReplayable={(!isUpcoming || isCurrent) && user.isAdmin}
        isSkippable={isCurrent && (isOwner || user.isAdmin)}
        isStarred={!isSpotify && item.songId ? starredSongs.includes(item.songId) : false}
        isUpcoming={isUpcoming}
        pctPlayed={isCurrent && duration > 0 ? position / duration * 100 : 0}
        title={title}
        wait={formatSeconds(waits[qId], true)} // fuzzy
        // actions
        onMoveClick={handleMoveClick}
        onRemoveUpcoming={handleRemoveUpcoming}
      />
    )
  })

  return <QueueListAnimator queueItems={items} />
}

export default QueueList
