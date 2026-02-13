export interface LrcLine {
  time: number // seconds
  text: string
}

export default function parseLrc (lrc: string): LrcLine[] {
  const lines: LrcLine[] = []
  const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/

  for (const line of lrc.split('\n')) {
    const match = line.match(regex)
    if (!match) continue

    const minutes = parseInt(match[1], 10)
    const seconds = parseInt(match[2], 10)
    const ms = match[3].length === 2 ? parseInt(match[3], 10) * 10 : parseInt(match[3], 10)
    const time = minutes * 60 + seconds + ms / 1000
    const text = match[4].trim()

    if (text) {
      lines.push({ time, text })
    }
  }

  return lines
}
