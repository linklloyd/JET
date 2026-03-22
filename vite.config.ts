import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import http from 'node:http'
import https from 'node:https'

function proxyRequest(
  targetUrl: string,
  method: string,
  body: Buffer | null,
  extraHeaders: Record<string, string>,
  res: http.ServerResponse
) {
  const url = new URL(targetUrl)
  const client = url.protocol === 'https:' ? https : http

  const headers: Record<string, string> = {
    'User-Agent': 'JET/1.0',
    ...extraHeaders,
  }
  if (body && body.length > 0) {
    headers['Content-Length'] = String(body.length)
  }

  const proxyReq = client.request(
    {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers,
    },
    (proxyRes) => {
      // Follow redirects for downloads
      if (
        proxyRes.statusCode &&
        [301, 302, 303, 307, 308].includes(proxyRes.statusCode) &&
        proxyRes.headers.location
      ) {
        proxyRequest(proxyRes.headers.location, 'GET', null, {}, res)
        return
      }

      const resHeaders: Record<string, string> = {
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      }
      if (proxyRes.headers['content-type']) {
        resHeaders['Content-Type'] = proxyRes.headers['content-type']
      }
      if (proxyRes.headers['content-length']) {
        resHeaders['Content-Length'] = proxyRes.headers['content-length']
      }
      res.writeHead(proxyRes.statusCode || 502, resHeaders)
      proxyRes.pipe(res)
    }
  )

  proxyReq.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'error', error: { code: 'proxy.connection.failed' } }))
  })

  if (body && body.length > 0) proxyReq.write(body)
  proxyReq.end()
}

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
  })
}

function cobaltProxyPlugin(): Plugin {
  return {
    name: 'cobalt-proxy',
    configureServer(server) {
      // Main API proxy (POST and GET)
      server.middlewares.use('/cobalt-proxy-session', async (req, res) => {
        const targetUrl = req.headers['x-target-url'] as string
        if (!targetUrl) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ status: 'error', error: { code: 'missing-target' } }))
          return
        }
        const body = await readBody(req)
        const turnstileToken = req.headers['cf-turnstile-response'] as string || ''
        proxyRequest(targetUrl, 'POST', body, {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(turnstileToken ? { 'cf-turnstile-response': turnstileToken } : {}),
        }, res as any)
      })

      server.middlewares.use('/cobalt-proxy', async (req, res) => {
        const targetUrl = req.headers['x-target-url'] as string
        if (!targetUrl) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ status: 'error', error: { code: 'missing-target' } }))
          return
        }

        const method = (req.method || 'GET').toUpperCase()

        if (method === 'GET') {
          proxyRequest(targetUrl, 'GET', null, {
            'Accept': 'application/json',
          }, res as any)
        } else {
          const body = await readBody(req)
          const auth = req.headers['authorization'] as string || ''
          proxyRequest(targetUrl, method, body, {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(auth ? { 'Authorization': auth } : {}),
          }, res as any)
        }
      })

      // Media download proxy
      server.middlewares.use('/cobalt-download', async (req, res) => {
        const targetUrl = req.headers['x-target-url'] as string
        if (!targetUrl) {
          res.writeHead(400)
          res.end('Missing x-target-url header')
          return
        }
        proxyRequest(targetUrl, 'GET', null, {}, res as any)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cobaltProxyPlugin()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  build: {
    target: 'esnext',
  },
})
