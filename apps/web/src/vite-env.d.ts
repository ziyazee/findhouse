/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** Older name for the publishable key, still accepted. */
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_R2_PUBLIC_URL?: string
  readonly VITE_APP_URL?: string
  /** Set once *.<domain> is routed to the app (see docs/ARCHITECTURE.md); "localhost" tries it in development. */
  readonly VITE_SITE_DOMAIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.module.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}
