import type { KoelDesktopAPI } from './koel'
import type { NativeAPI } from './native'
export type DesktopInfo = { platform: string; version: string }
export type GPUStatus = { compositing: string; rasterization: string }
export interface DesktopAPI {
  getGPUStatus(): Promise<GPUStatus>
  getInfo(): Promise<DesktopInfo>
  minimize(): void
  toggleMaximize(): void
  isMaximized(): Promise<boolean>
  onMaximizedChange(callback: (maximized: boolean) => void): () => void
  close(): void
  native: NativeAPI
  koel: KoelDesktopAPI
}
