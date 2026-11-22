// Serves every broker subdomain (ravi-homes.findhouse.in) from the FindHouse build on Cloudflare Pages.
// Pages can't take a wildcard custom domain, so this Worker sits on the `*.findhouse.in/*` route and fetches the
// same files from the Pages project. The app reads the subdomain from the address bar, so nothing else is needed.
export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.hostname === `www.${env.SITE_DOMAIN}`) {
      url.hostname = env.SITE_DOMAIN
      return Response.redirect(url.toString(), 301)
    }

    const upstream = new URL(url.pathname + url.search, env.PAGES_ORIGIN)

    // Build files under /assets have the content hash in their name, so they never change: keep them at Cloudflare's
    // edge and in the visitor's browser for good. Everything else is fetched as before.
    if (url.pathname.startsWith('/assets/')) {
      const res = await fetch(new Request(upstream, request), { cf: { cacheEverything: true, cacheTtl: 31536000 } })
      if (!res.ok) return res
      const cached = new Response(res.body, res)
      cached.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
      return cached
    }
    return fetch(new Request(upstream, request))
  },
}
