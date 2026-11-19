/**
 * Cloudflare R2 client using S3-compatible API with AWS Sig v4 signing.
 * Used by edge functions to upload media to R2.
 */

const encoder = new TextEncoder()

function getR2Config() {
  const accountId = Deno.env.get('R2_ACCOUNT_ID')!
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')!
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')!
  const bucket = Deno.env.get('R2_BUCKET_NAME') ?? 'findhouse-media'
  const publicUrl = Deno.env.get('R2_PUBLIC_URL')!
  return { accountId, accessKeyId, secretAccessKey, bucket, publicUrl }
}

async function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data))
}

async function sha256(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function getSignatureKey(
  secret: string, dateStamp: string, region: string, service: string,
): Promise<ArrayBuffer> {
  let key = await hmacSha256(encoder.encode('AWS4' + secret), dateStamp)
  key = await hmacSha256(key, region)
  key = await hmacSha256(key, service)
  key = await hmacSha256(key, 'aws4_request')
  return key
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function signRequest(
  method: string, url: string, headers: Record<string, string>,
  body: Uint8Array, accessKeyId: string, secretAccessKey: string,
): Promise<Record<string, string>> {
  const parsedUrl = new URL(url)
  const now = new Date()
  const dateStamp = now.toISOString().replace(/[-:]/g, '').slice(0, 8)
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const region = 'auto'
  const service = 's3'

  const payloadHash = await sha256(body)

  const signedHeaders: Record<string, string> = {
    ...headers,
    host: parsedUrl.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  }

  const headerKeys = Object.keys(signedHeaders).sort()
  const signedHeaderStr = headerKeys.join(';')
  const canonicalHeaders = headerKeys.map((k) => `${k}:${signedHeaders[k]}\n`).join('')

  const canonicalRequest = [
    method,
    parsedUrl.pathname,
    parsedUrl.search.replace('?', ''),
    canonicalHeaders,
    signedHeaderStr,
    payloadHash,
  ].join('\n')

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256(encoder.encode(canonicalRequest)),
  ].join('\n')

  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service)
  const signature = toHex(await hmacSha256(signingKey, stringToSign))

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaderStr}, Signature=${signature}`

  return { ...signedHeaders, authorization }
}

export async function uploadToR2(
  key: string, body: Uint8Array, contentType: string,
): Promise<{ success: boolean; publicUrl: string; error?: string }> {
  const config = getR2Config()
  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${key}`

  const headers = await signRequest(
    'PUT', endpoint, { 'content-type': contentType }, body,
    config.accessKeyId, config.secretAccessKey,
  )

  const res = await fetch(endpoint, { method: 'PUT', headers, body })

  if (!res.ok) {
    const text = await res.text()
    return { success: false, publicUrl: '', error: `R2 upload failed (${res.status}): ${text}` }
  }

  return { success: true, publicUrl: `${config.publicUrl}/${key}` }
}

export async function deleteFromR2(key: string): Promise<void> {
  const config = getR2Config()
  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${key}`

  const headers = await signRequest(
    'DELETE', endpoint, {}, new Uint8Array(0),
    config.accessKeyId, config.secretAccessKey,
  )

  await fetch(endpoint, { method: 'DELETE', headers })
}

export function getR2PublicUrl(key: string): string {
  const config = getR2Config()
  return `${config.publicUrl}/${key}`
}
