import { createContext } from 'react'

/** Set by the shell on phones: a tab page's hero reports its height so the shared banner can match it. */
export const PhoneBannerContext = createContext<((height: number) => void) | null>(null)
