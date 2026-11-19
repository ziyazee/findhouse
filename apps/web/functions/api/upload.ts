interface Env {
  R2_BUCKET: R2Bucket
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const formData = await context.request.formData()
  const file = formData.get('file') as File | null
  const key = formData.get('key') as string | null

  if (!file || !key) {
    return new Response('Missing file or key', { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  await context.env.R2_BUCKET.put(key, bytes, {
    httpMetadata: { contentType: file.type },
  })

  return new Response(JSON.stringify({ key }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  const key = url.searchParams.get('key')

  if (!key) {
    return new Response('Missing key', { status: 400 })
  }

  await context.env.R2_BUCKET.delete(key)
  return new Response(JSON.stringify({ deleted: key }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
