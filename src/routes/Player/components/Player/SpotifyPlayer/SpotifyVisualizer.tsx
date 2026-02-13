import React, { useEffect, useRef } from 'react'
import styles from './SpotifyVisualizer.css'

export interface AudioFeatures {
  tempo: number
  energy: number
  valence: number
  danceability: number
  key: number
  mode: number
}

interface SpotifyVisualizerProps {
  features: AudioFeatures | null
  position: number
  isPlaying: boolean
  width: number
  height: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  hue: number
  alpha: number
  life: number
  maxLife: number
}

const DEFAULT_FEATURES: AudioFeatures = {
  tempo: 120,
  energy: 0.5,
  valence: 0.5,
  danceability: 0.5,
  key: 7, // G
  mode: 1,
}

// Layered sine waves for smooth organic flow field
function flowAngle (x: number, y: number, t: number): number {
  return (
    Math.sin(x * 0.003 + t * 0.3) * 2.0
    + Math.cos(y * 0.004 + t * 0.2) * 2.0
    + Math.sin((x + y) * 0.002 + t * 0.15) * 1.5
    + Math.cos((x - y) * 0.0015 + t * 0.25) * 1.0
  )
}

function createParticle (w: number, h: number, baseHue: number): Particle {
  const maxLife = 8 + Math.random() * 12
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: 0,
    vy: 0,
    size: 1.5 + Math.random() * 2.5,
    hue: baseHue + (Math.random() - 0.5) * 50,
    alpha: 0.3 + Math.random() * 0.4,
    life: maxLife,
    maxLife,
  }
}

function respawnParticle (p: Particle, w: number, h: number, baseHue: number) {
  const maxLife = 8 + Math.random() * 12
  p.x = Math.random() * w
  p.y = Math.random() * h
  p.vx = 0
  p.vy = 0
  p.size = 1.5 + Math.random() * 2.5
  p.hue = baseHue + (Math.random() - 0.5) * 50
  p.alpha = 0.3 + Math.random() * 0.4
  p.life = maxLife
  p.maxLife = maxLife
}

const SpotifyVisualizer = ({ features, position, isPlaying, width, height }: SpotifyVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef(0)
  const particlesRef = useRef<Particle[]>([])
  const pulsesRef = useRef<Array<{ radius: number, alpha: number, hue: number }>>([])
  const lastBeatRef = useRef(-1)
  const timeRef = useRef(0)
  const prevTimestampRef = useRef(0)

  // Use refs for frequently-changing values to avoid restarting the animation loop
  const positionRef = useRef(position)
  const isPlayingRef = useRef(isPlaying)
  const featuresRef = useRef(features)

  // Sync refs after each render so the animation loop reads latest values
  useEffect(() => {
    positionRef.current = position
    isPlayingRef.current = isPlaying
    featuresRef.current = features
  })

  // Initialize particles when canvas size or features change
  useEffect(() => {
    const f = features || DEFAULT_FEATURES
    const baseHue = (f.key / 12) * 360 + (f.valence - 0.5) * 60
    const count = Math.floor(100 + f.energy * 100)
    const particles: Particle[] = []
    for (let i = 0; i < count; i++) {
      particles.push(createParticle(width, height, baseHue))
    }
    particlesRef.current = particles
    pulsesRef.current = []
    lastBeatRef.current = -1
  }, [width, height, features])

  // Main animation loop — only restarts on canvas resize
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !width || !height) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const render = (timestamp: number) => {
      frameRef.current = requestAnimationFrame(render)

      const dt = prevTimestampRef.current
        ? Math.min((timestamp - prevTimestampRef.current) / 1000, 0.1)
        : 0.016
      prevTimestampRef.current = timestamp

      const playing = isPlayingRef.current
      const f = featuresRef.current || DEFAULT_FEATURES
      const pos = positionRef.current

      timeRef.current += playing ? dt : dt * 0.2
      const t = timeRef.current

      const baseHue = (f.key / 12) * 360
      const hueShift = (f.valence - 0.5) * 60
      const palette = baseHue + hueShift
      const sat = 40 + f.energy * 35
      const beatSec = 60 / f.tempo

      // === Clear with trail fade ===
      ctx.fillStyle = `rgba(0, 0, 0, ${0.08 + (playing ? 0.07 : 0.02)})`
      ctx.fillRect(0, 0, width, height)

      // === Beat detection ===
      const currentBeat = Math.floor(pos / beatSec)
      const beatPhase = (pos / beatSec) % 1
      const beatPulse = Math.pow(Math.max(0, 1 - beatPhase * 3), 2)

      if (currentBeat !== lastBeatRef.current && playing && pos > 0) {
        lastBeatRef.current = currentBeat
        pulsesRef.current.push({
          radius: 5,
          alpha: 0.3 + f.energy * 0.35,
          hue: palette + Math.random() * 30 - 15,
        })
      }

      // === Background atmosphere ===
      const bgHue = palette + Math.sin(t * 0.05) * 20
      const bgAlpha = playing ? 0.02 + f.energy * 0.04 : 0.01
      const cx = width * (0.5 + Math.sin(t * 0.07) * 0.15)
      const cy = height * (0.5 + Math.cos(t * 0.06) * 0.15)
      const bgGrad = ctx.createRadialGradient(
        cx, cy, 0,
        width / 2, height / 2, Math.max(width, height) * 0.8,
      )
      bgGrad.addColorStop(0, `hsla(${bgHue}, ${sat}%, 25%, ${bgAlpha * 2})`)
      bgGrad.addColorStop(0.6, `hsla(${bgHue + 30}, ${sat * 0.7}%, 12%, ${bgAlpha})`)
      bgGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, width, height)

      // === Pulse rings ===
      const maxRadius = Math.max(width, height) * 0.65
      for (let i = pulsesRef.current.length - 1; i >= 0; i--) {
        const pulse = pulsesRef.current[i]
        pulse.radius += (3 + f.energy * 5) * dt * 60
        pulse.alpha *= Math.pow(0.96, dt * 60)

        if (pulse.alpha < 0.005 || pulse.radius > maxRadius) {
          pulsesRef.current.splice(i, 1)
          continue
        }

        ctx.beginPath()
        ctx.arc(width / 2, height / 2, pulse.radius, 0, Math.PI * 2)
        ctx.strokeStyle = `hsla(${pulse.hue}, ${sat + 10}%, 55%, ${pulse.alpha})`
        ctx.lineWidth = 1 + pulse.alpha * 5
        ctx.stroke()
      }

      // === Particles ===
      const particles = particlesRef.current
      const speed = 0.4 + f.energy * 0.8 + f.danceability * 0.4

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        // Flow field movement
        const angle = flowAngle(p.x, p.y, t)
        p.vx += Math.cos(angle) * speed * 0.08 * dt * 60
        p.vy += Math.sin(angle) * speed * 0.08 * dt * 60
        p.vx *= 0.97
        p.vy *= 0.97
        p.x += p.vx
        p.y += p.vy
        p.life -= dt

        // Respawn if dead or off-screen
        if (p.life <= 0 || p.x < -30 || p.x > width + 30 || p.y < -30 || p.y > height + 30) {
          respawnParticle(p, width, height, palette)
          continue
        }

        const lifeFrac = p.life / p.maxLife
        const fadeIn = Math.min(1, (1 - lifeFrac) * 4)
        const fadeOut = Math.min(1, lifeFrac * 3)
        const a = p.alpha * fadeIn * fadeOut * (0.5 + beatPulse * 0.5) * (playing ? 1 : 0.3)
        const s = p.size * (0.85 + beatPulse * 0.3)
        const h = p.hue + Math.sin(t * 0.3 + p.x * 0.001) * 15

        // Glow (larger, dimmer)
        ctx.beginPath()
        ctx.arc(p.x, p.y, s * 3, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${h}, ${sat}%, 45%, ${a * 0.12})`
        ctx.fill()

        // Core (smaller, brighter)
        ctx.beginPath()
        ctx.arc(p.x, p.y, s, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${h}, ${sat + 15}%, 70%, ${a})`
        ctx.fill()
      }

      // === Floating orbs (large, slow, ambient) ===
      for (let i = 0; i < 3; i++) {
        const ox = width * (0.5 + 0.35 * Math.sin(t * 0.025 + i * 2.094))
        const oy = height * (0.5 + 0.3 * Math.cos(t * 0.032 + i * 2.094))
        const or = Math.min(width, height) * (0.06 + 0.03 * Math.sin(t * 0.08 + i * 1.5))
        const oh = palette + i * 35 + Math.sin(t * 0.04 + i) * 15
        const oa = (0.035 + beatPulse * 0.025) * (playing ? 1 : 0.3)

        const orbGrad = ctx.createRadialGradient(ox, oy, 0, ox, oy, or)
        orbGrad.addColorStop(0, `hsla(${oh}, ${sat}%, 45%, ${oa})`)
        orbGrad.addColorStop(0.6, `hsla(${oh + 10}, ${sat * 0.8}%, 30%, ${oa * 0.4})`)
        orbGrad.addColorStop(1, 'transparent')
        ctx.fillStyle = orbGrad
        ctx.fillRect(ox - or, oy - or, or * 2, or * 2)
      }
    }

    frameRef.current = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(frameRef.current)
      prevTimestampRef.current = 0
    }
  }, [width, height])

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
