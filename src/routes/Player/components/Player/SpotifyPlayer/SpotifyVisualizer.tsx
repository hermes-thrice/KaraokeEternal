import React, { useCallback, useEffect, useRef } from 'react'
import styles from './SpotifyVisualizer.css'

interface Beat {
  start: number
  duration: number
  confidence: number
}

interface Section {
  start: number
  duration: number
  loudness: number
  tempo: number
  key: number
  mode: number
}

interface Segment {
  start: number
  duration: number
  loudness_start: number
  loudness_max: number
  loudness_max_time: number
}

export interface AnalysisData {
  beats: Beat[]
  sections: Section[]
  segments: Segment[]
}

interface SpotifyVisualizerProps {
  analysisData: AnalysisData | null
  position: number // seconds
  isPlaying: boolean
  width: number
  height: number
}

// color palette keyed by musical key (0-11)
const KEY_COLORS = [
  [255, 100, 100], // C - red
  [255, 150, 80], // C# - orange-red
  [255, 200, 60], // D - yellow
  [200, 255, 60], // D# - yellow-green
  [60, 255, 100], // E - green
  [60, 255, 200], // F - cyan-green
  [60, 200, 255], // F# - cyan
  [80, 120, 255], // G - blue
  [120, 80, 255], // G# - indigo
  [180, 60, 255], // A - violet
  [255, 60, 200], // A# - magenta
  [255, 60, 120], // B - pink
]

const SpotifyVisualizer = ({ analysisData, position, isPlaying, width, height }: SpotifyVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number>(0)
  const pulseRef = useRef(0)
  const colorRef = useRef([80, 120, 255])
  const targetColorRef = useRef([80, 120, 255])

  const findCurrent = useCallback(<T extends { start: number }>(items: T[], pos: number): T | null => {
    if (!items?.length) return null
    let result: T | null = null
    for (const item of items) {
      if (item.start <= pos) result = item
      else break
    }
    return result
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const render = () => {
      frameRef.current = requestAnimationFrame(render)

      ctx.clearRect(0, 0, width, height)

      // find current section for color
      const section = findCurrent(analysisData?.sections || [], position)
      if (section) {
        const key = Math.max(0, Math.min(11, section.key))
        targetColorRef.current = KEY_COLORS[key] || KEY_COLORS[0]
      }

      // lerp color
      for (let i = 0; i < 3; i++) {
        colorRef.current[i] += (targetColorRef.current[i] - colorRef.current[i]) * 0.02
      }

      // find current beat for pulse
      const beat = findCurrent(analysisData?.beats || [], position)
      if (beat) {
        const beatProgress = (position - beat.start) / beat.duration
        if (beatProgress >= 0 && beatProgress < 1) {
          pulseRef.current = Math.max(pulseRef.current, (1 - beatProgress) * beat.confidence)
        }
      }

      // find current segment for loudness
      const segment = findCurrent(analysisData?.segments || [], position)
      const loudness = segment
        ? Math.max(0, Math.min(1, (segment.loudness_max + 30) / 30))
        : 0.3

      // decay pulse
      pulseRef.current *= 0.92

      const [r, g, b] = colorRef.current
      const intensity = 0.15 + pulseRef.current * 0.4 + loudness * 0.2
      const alpha = isPlaying ? intensity : intensity * 0.3

      // radial gradient background
      const gradient = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, Math.max(width, height) * 0.7,
      )
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`)
      gradient.addColorStop(0.5, `rgba(${r * 0.5}, ${g * 0.5}, ${b * 0.5}, ${alpha * 0.6})`)
      gradient.addColorStop(1, `rgba(0, 0, 0, ${alpha * 0.3})`)

      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)

      // beat pulse ring
      if (pulseRef.current > 0.05) {
        const ringRadius = Math.min(width, height) * 0.3 * (1 + pulseRef.current * 0.5)
        ctx.beginPath()
        ctx.arc(width / 2, height / 2, ringRadius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${pulseRef.current * 0.3})`
        ctx.lineWidth = 2 + pulseRef.current * 8
        ctx.stroke()
      }
    }

    if (isPlaying || !analysisData) {
      frameRef.current = requestAnimationFrame(render)
    }

    return () => {
      cancelAnimationFrame(frameRef.current)
    }
  }, [analysisData, position, isPlaying, width, height, findCurrent])

  // fallback: slow color cycling when no analysis data
  useEffect(() => {
    if (analysisData) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let hue = 0
    const fallbackRender = () => {
      frameRef.current = requestAnimationFrame(fallbackRender)
      hue = (hue + 0.2) % 360
      const alpha = isPlaying ? 0.15 : 0.05

      const gradient = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, Math.max(width, height) * 0.7,
      )
      gradient.addColorStop(0, `hsla(${hue}, 60%, 40%, ${alpha})`)
      gradient.addColorStop(1, `hsla(${hue + 60}, 40%, 10%, ${alpha * 0.5})`)

      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)
    }

    frameRef.current = requestAnimationFrame(fallbackRender)
    return () => cancelAnimationFrame(frameRef.current)
  }, [analysisData, isPlaying, width, height])

  return (
    <canvas
      ref={canvasRef}
      className={styles.canvas}
      width={width}
      height={height}
    />
  )
}

export default SpotifyVisualizer
