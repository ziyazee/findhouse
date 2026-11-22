import { servePreview } from '../p/[slug]'

// Current listing links look like /<shortId>/<name> (ravi-homes.findhouse.in/k3f9x2ab/2-bhk-in-andheri). This adds the
// listing's link-preview tags, the same as /p/<slug> does. Other two-part paths (/properties/new …) get the plain page.
// Short ids are 8 lowercase letters and digits, so anything else skips the database lookup.
const SHORT_ID = /^[a-z0-9]{8}$/

export const onRequestGet: PagesFunction<Record<string, string | undefined>> = (context) => {
  const shortId = String(context.params.shortId).toLowerCase()
  if (!SHORT_ID.test(shortId)) return context.next()
  return servePreview(context, 'short_id', shortId)
}
