import { defineConfig } from 'vite'
import importMetaUrlPlugin from '@codingame/esbuild-import-meta-url-plugin'
import * as fs from 'fs'
import path from 'path'
const pkg = JSON.parse(
  fs.readFileSync(new URL('./package.json', import.meta.url).pathname).toString()
)

const localDependencies = Object.entries(pkg.dependencies as Record<string, string>)
  .filter(([, version]) => version.startsWith('file:../') || version.startsWith('npm:@codingame/'))
  .map(([name]) => name)
export default defineConfig({
  build: {
    target: 'esnext'
  },
  worker: {
    format: 'es'
  },
  plugins: [
    {
      name: 'load-vscode-css-as-string',
      enforce: 'pre',
      async resolveId(source, importer, options) {
        const resolved = await this.resolve(source, importer, options)
        if (
          resolved != null &&
          resolved.id.match(
            /node_modules\/(@codingame\/monaco-vscode|vscode|monaco-editor).*\.css$/
          )
        ) {
          return {
            ...resolved,
            id: resolved.id + '?inline'
          }
        }
        return undefined
      }
    },
    {
      // For the *-language-features extensions which use SharedArrayBuffer
      name: 'configure-response-headers',
      apply: 'serve',
      configureServer: (server) => {
        server.middlewares.use((_req, res, next) => {
          res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless')
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
          res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
          next()
        })
      }
    },
    {
      // Serve webview HTML and other static assets from dist/extension/libs/ without Vite transforming them
      name: 'force-prevent-transform-assets',
      apply: 'serve',
      configureServer(server) {
        const distExtensionDir = path.resolve(__dirname, '../../dist/extension')
        return () => {
          server.middlewares.use(async (req, res, next) => {
            if (req.originalUrl != null) {
              const pathname = new URL(req.originalUrl, import.meta.url).pathname
              if (pathname.startsWith('/libs/')) {
                const filePath = path.join(distExtensionDir, pathname)
                try {
                  const content = fs.readFileSync(filePath)
                  const ext = path.extname(pathname)
                  const mimeTypes: Record<string, string> = {
                    '.html': 'text/html',
                    '.js': 'application/javascript',
                    '.json': 'application/json',
                    '.css': 'text/css',
                    '.svg': 'image/svg+xml',
                    '.wasm': 'application/wasm'
                  }
                  res.setHeader('Content-Type', mimeTypes[ext] ?? 'application/octet-stream')
                  res.writeHead(200)
                  res.write(content)
                  res.end()
                  return
                } catch {
                  // fall through to next middleware when file not found
                }
              }
            }
            next()
          })
        }
      }
    }
  ],
  esbuild: {
    minifySyntax: false
  },
  optimizeDeps: {
    // This is require because vite excludes local dependencies from being optimized
    // Monaco-vscode-api packages are local dependencies and the number of modules makes chrome hang
    include: [
      // add all local dependencies...
      ...localDependencies,
      // and their exports
      '@codingame/monaco-vscode-api/extensions',
      '@codingame/monaco-vscode-api',
      '@codingame/monaco-vscode-api/monaco',
      'vscode/localExtensionHost',

      // These 2 lines prevent vite from reloading the whole page when starting a worker (so 2 times in a row after cleaning the vite cache - for the editor then the textmate workers)
      // it's mainly empirical and probably not the best way, fix me if you find a better way
      '@vscode/vscode-languagedetection',
      'marked'
    ],
    exclude: [],
    rolldownOptions: {
      plugins: [importMetaUrlPlugin]
    }
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    fs: {
      allow: ['../', '../../dist/extension'] // allow codicon.ttf from monaco-editor and libs from dist/extension
    }
  },
  define: {
    rootDirectory: JSON.stringify(__dirname)
  },
  resolve: {
    alias: [
      {
        find: 'vscode/baseEditor',
        replacement: path.resolve(__dirname, './src/sfWorkbench/vscodeBaseEditorCompat.ts')
      },
      {
        find: 'vscode/toolingApi',
        replacement: path.resolve(__dirname, '../lwc/app/vscode/toolingApi/toolingApi.ts')
      },
      {
        find: 'vscode/metadataApi',
        replacement: path.resolve(__dirname, '../lwc/app/vscode/metadataApi/metadataApi.ts')
      },
      {
        find: 'vscode/sourceTracking',
        replacement: path.resolve(__dirname, '../lwc/app/vscode/sourceTracking/sourceTracking.ts')
      },
      {
        find: /^core\/(.*)$/,
        replacement: path.resolve(__dirname, './src/sfWorkbench/compat/core/$1')
      },
      {
        find: /^shared\/(.*)$/,
        replacement: path.resolve(__dirname, './src/sfWorkbench/compat/shared/$1')
      },
      {
        find: /^agent\/(.*)$/,
        replacement: path.resolve(__dirname, './src/sfWorkbench/compat/agent/$1')
      }
    ],
    dedupe: ['vscode', ...localDependencies]
  }
})
