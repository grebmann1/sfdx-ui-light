declare module '*?url' {
  const url: string
  export default url
}

declare module '*?worker' {
  interface WorkerConstructor {
    new (): Worker
  }

  const Worker: WorkerConstructor
  export default Worker
}

declare module '*?raw' {
  const content: string
  export default content
}

declare module '@codingame/*' {
  const value: any
  export = value
}

declare module 'vscode' {
  const value: any
  export = value
}

declare module 'ansi-colors' {
  const value: any
  export = value
}

declare module 'vite' {
  const value: any
  export = value
}

declare module '@codingame/esbuild-import-meta-url-plugin' {
  const value: any
  export = value
}

interface ImportMeta {
  glob(pattern: string): Record<string, () => Promise<any>>
}
