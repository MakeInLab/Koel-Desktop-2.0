/** One HTMLAudioElement for the lifetime of the renderer (survives route navigation). */
export class AudioEngine {
  readonly element: HTMLAudioElement
  constructor() {
    this.element = new Audio()
    this.element.preload = 'metadata'
    this.element.volume = 0.72
  }
  load(url: string): void {
    this.element.pause()
    this.element.removeAttribute('src')
    this.element.load()
    this.element.src = url
    this.element.load()
  }
  play(): Promise<void> { return this.element.play() }
  pause(): void { this.element.pause() }
  seek(seconds: number): void {
    if (!Number.isFinite(seconds)) return
    const duration = this.element.duration
    this.element.currentTime = Math.max(0, Math.min(seconds, Number.isFinite(duration) ? duration : seconds))
  }
  setVolume(value: number): void { this.element.volume = Math.max(0, Math.min(1, value / 100)) }
  reset(): void {
    this.element.pause()
    this.element.removeAttribute('src')
    this.element.load()
  }
}
export const audioEngine = new AudioEngine()
