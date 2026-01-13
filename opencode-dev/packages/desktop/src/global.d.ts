declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown
    __OPENCODE__?: {
      serverReady?: boolean
      updaterEnabled?: boolean
    }
  }
}

export {}
