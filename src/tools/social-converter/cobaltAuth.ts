declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string
          callback: (token: string) => void
          'error-callback'?: (err: unknown) => void
          size?: 'invisible' | 'normal' | 'compact'
          appearance?: 'always' | 'execute' | 'interaction-only'
        }
      ) => string
      remove: (widgetId: string) => void
      reset: (widgetId: string) => void
    }
  }
}

interface CobaltInstanceInfo {
  turnstileSitekey?: string
  auth?: boolean
  services?: string[]
}

interface CachedToken {
  token: string
  expiresAt: number
}

const tokenCache = new Map<string, CachedToken>()

export async function getInstanceInfo(instanceUrl: string): Promise<CobaltInstanceInfo> {
  try {
    const response = await fetch('/cobalt-proxy', {
      method: 'GET',
      headers: { 'x-target-url': instanceUrl },
    })
    if (!response.ok) return {}
    const data = await response.json()
    // The API nests info under "cobalt" key
    const cobalt = data.cobalt || data
    return {
      turnstileSitekey: cobalt.turnstileSitekey,
      auth: !!cobalt.turnstileSitekey,
      services: cobalt.services,
    }
  } catch {
    return {}
  }
}

function ensureTurnstileScript(): Promise<void> {
  return new Promise((resolve) => {
    if (window.turnstile) {
      resolve()
      return
    }
    const existing = document.querySelector('script[src*="turnstile"]')
    if (existing) {
      const check = () => {
        if (window.turnstile) resolve()
        else setTimeout(check, 100)
      }
      check()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.onload = () => {
      const check = () => {
        if (window.turnstile) resolve()
        else setTimeout(check, 100)
      }
      check()
    }
    document.head.appendChild(script)
  })
}

function solveTurnstile(sitekey: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Turnstile challenge timed out. The sitekey may not be valid for this domain.'))
    }, 20000)

    try {
      await ensureTurnstileScript()
      const turnstile = window.turnstile!

      // Use a visible container so user can interact if needed
      let container = document.getElementById('turnstile-container')
      if (!container) {
        container = document.createElement('div')
        container.id = 'turnstile-container'
        document.body.appendChild(container)
      }
      // Make it visible for interaction
      container.style.position = 'fixed'
      container.style.bottom = '20px'
      container.style.right = '20px'
      container.style.zIndex = '9999'
      container.innerHTML = ''

      const widgetId = turnstile.render(container, {
        sitekey,
        size: 'normal',
        appearance: 'always',
        callback: (token: string) => {
          clearTimeout(timeout)
          try { turnstile.remove(widgetId) } catch {}
          container!.innerHTML = ''
          container!.style.position = ''
          resolve(token)
        },
        'error-callback': (err: unknown) => {
          clearTimeout(timeout)
          try { turnstile.remove(widgetId) } catch {}
          container!.innerHTML = ''
          container!.style.position = ''
          reject(new Error('Turnstile challenge failed (code: ' + String(err) + '). This usually means the sitekey is domain-locked and cannot be used from this origin.'))
        },
      })
    } catch (err) {
      clearTimeout(timeout)
      reject(err)
    }
  })
}

export async function getCobaltToken(instanceUrl: string): Promise<string | null> {
  // Check cache first
  const cached = tokenCache.get(instanceUrl)
  if (cached && cached.expiresAt > Date.now() + 30000) {
    return cached.token
  }

  // Get instance info to find turnstile sitekey
  const info = await getInstanceInfo(instanceUrl)

  // No auth required
  if (!info.turnstileSitekey && !info.auth) {
    return null
  }

  if (!info.turnstileSitekey) {
    // Auth required but no turnstile key — can't authenticate
    throw new Error('Instance requires authentication but no Turnstile sitekey was provided.')
  }

  // Try to solve turnstile challenge
  let turnstileToken: string
  try {
    turnstileToken = await solveTurnstile(info.turnstileSitekey)
  } catch {
    throw new Error(
      'Turnstile verification failed. Public Cobalt instances use domain-locked Turnstile keys that only work on their own domains. ' +
      'To use URL downloads, either:\n' +
      '• Self-host a Cobalt instance without Turnstile\n' +
      '• Use the file upload option instead (download the video manually first)\n' +
      '• Set a custom Cobalt instance URL in settings'
    )
  }

  // Exchange for JWT
  const sessionResponse = await fetch('/cobalt-proxy-session', {
    method: 'POST',
    headers: {
      'x-target-url': instanceUrl + '/session',
      'cf-turnstile-response': turnstileToken,
    },
  })

  if (!sessionResponse.ok) {
    throw new Error('Failed to get session token from Cobalt instance')
  }

  const sessionData = await sessionResponse.json()
  if (sessionData.status === 'error') {
    throw new Error(`Cobalt session error: ${sessionData.error?.code || 'unknown'}`)
  }
  if (!sessionData.token) {
    throw new Error('No token in session response')
  }

  // Cache the token (default 4 min expiry)
  tokenCache.set(instanceUrl, {
    token: sessionData.token,
    expiresAt: Date.now() + (sessionData.exp || 240) * 1000,
  })

  return sessionData.token
}

export function clearTokenCache() {
  tokenCache.clear()
}
