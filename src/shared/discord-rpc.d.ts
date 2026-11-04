declare module 'discord-rpc' {
  import { EventEmitter } from 'node:events'
  export class Client extends EventEmitter {
    constructor(options: { transport: 'ipc' })
    login(options: { clientId: string }): Promise<void>
    destroy(): Promise<void>
    setActivity(options: Record<string, unknown>): Promise<void>
    request(command: 'SET_ACTIVITY', args: { pid: number; activity: Record<string, unknown> }): Promise<unknown>
    clearActivity(): Promise<void>
  }
  const rpc: { Client: typeof Client }
  export default rpc
}
