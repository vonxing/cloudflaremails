/**
 * 静态资源管理器模块
 * @module assets/manager
 */

/**
 * React SPA 静态资源管理器
 */
export class AssetManager {
  constructor() {
    this.entryPath = '/index.html';
    this.spaRoutes = new Set(['/', '/index.html', '/login', '/app', '/mailboxes', '/admin']);
    this.staticPrefixes = ['/assets/'];
    this.staticFiles = new Set([
      '/logo.svg',
      '/favicon.svg',
      '/favicon.ico',
      '/manifest.webmanifest',
      '/robots.txt',
    ]);
    this.staticAssetPattern =
      /\.(css|js|mjs|map|png|jpg|jpeg|gif|svg|webp|avif|ico|txt|xml|json|woff|woff2|ttf|otf)$/i;
  }

  normalizePathname(pathname) {
    if (!pathname || pathname === '/') {
      return '/';
    }

    return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  }

  isStaticAssetPath(pathname) {
    if (this.staticFiles.has(pathname)) {
      return true;
    }

    if (this.staticPrefixes.some((prefix) => pathname.startsWith(prefix))) {
      return true;
    }

    return this.staticAssetPattern.test(pathname);
  }

  isSpaRoutePath(pathname) {
    return this.spaRoutes.has(this.normalizePathname(pathname));
  }

  async handleAssetRequest(request, env, mailDomains) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (!env.ASSETS || !env.ASSETS.fetch) {
      return new Response('静态资源服务未配置', { status: 500 });
    }

    if (this.isStaticAssetPath(pathname)) {
      return env.ASSETS.fetch(request);
    }

    if (!this.isSpaRoutePath(pathname)) {
      return new Response('Not Found', { status: 404 });
    }

    return this.handleSpaEntryRequest(request, env, mailDomains);
  }

  async handleSpaEntryRequest(request, env, mailDomains) {
    const url = new URL(request.url);
    const entryRequest = new Request(new URL(this.entryPath, url).toString(), request);
    const response = await env.ASSETS.fetch(entryRequest);

    if (!response.ok) {
      return response;
    }

    try {
      const html = await response.text();
      const injected = html.replace(
        '<meta name="mail-domains" content="">',
        `<meta name="mail-domains" content="${mailDomains.join(',')}">`,
      );

      const headers = new Headers(response.headers);
      headers.set('Content-Type', 'text/html; charset=utf-8');
      headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

      return new Response(injected, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (_) {
      return response;
    }
  }

  isApiPath(pathname) {
    return pathname.startsWith('/api/') || pathname === '/receive';
  }

  getAccessLog(request) {
    const url = new URL(request.url);
    return {
      timestamp: new Date().toISOString(),
      method: request.method,
      path: url.pathname,
      userAgent: request.headers.get('User-Agent') || '',
      referer: request.headers.get('Referer') || '',
      ip:
        request.headers.get('CF-Connecting-IP') ||
        request.headers.get('X-Forwarded-For') ||
        request.headers.get('X-Real-IP') ||
        'unknown',
    };
  }
}

export function createAssetManager() {
  return new AssetManager();
}
