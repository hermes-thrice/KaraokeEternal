import React, { useMemo } from 'react'
import type { LrcLine } from './parseLrc'
import styles from './LrcRenderer.css'

interface LrcRendererProps {
  lyrics: LrcLine[]
  position: number // seconds
  width: number
  height: number
}

const LrcRenderer = ({ lyrics, position, width, height }: LrcRendererProps) => {
  const currentIndex = useMemo(() => {
    let idx = 0
    for (let i = 0; i < lyrics.length; i++) {
      if (lyrics[i].time <= position) idx = i
      else break
    }
    return idx
  }, [lyrics, position])

  if (!lyrics.length) return null

  // show 1 past line, current line, and 2 upcoming lines
  const startIdx = Math.max(0, currentIndex - 1)
  const endIdx = Math.min(lyrics.length, currentIndex + 3)
  const visibleLines = lyrics.slice(startIdx, endIdx)

  const fontSize = Math.max(24, Math.min(48, height * 0.04))

  return (
    <div
      className={styles.container}
      style={{ width, height }}
    >
      <div className={styles.backdrop} />
      <div className={styles.lyrics} style={{ fontSize }}>
        {visibleLines.map((line, i) => {
          const actualIdx = startIdx + i
          const isCurrent = actualIdx === currentIndex
          const isPast = actualIdx < currentIndex

          return (
            <div
              key={`${line.time}-${line.text}`}
              className={isCurrent ? styles.current : isPast ? styles.past : styles.upcoming}
              style={{ fontSize: isCurrent ? fontSize * 1.2 : fontSize }}
            >
              {line.text}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default LrcRenderer
