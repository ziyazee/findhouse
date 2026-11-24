import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MotionConfig, motion } from 'framer-motion'
import { Home, ImageOff, MapPin, Phone, Share2 } from 'lucide-react'
import { brokerSiteUrl, currentSite, listingPath, mainOrigin, siteSubdomain } from '@/lib/site'
import { propertyKeys } from '@/modules/properties/queryKeys'
import { coverUrl, placeOf } from '@/modules/properties/listingStatus'
import { shareLink } from '@/modules/properties/shareProperty'
import type { ListingType, Property } from '@/modules/properties/property.types'
import { useAuthStore } from '@/modules/auth/AuthStore'
import { WhatsAppIcon } from '@/modules/property-site/components/ContactBar'
import { formatPhone, priceLine, whatsAppLink } from '@/modules/property-site/listingContent'
import { initials } from '@/shared/format'
import { easeOut, rise, stagger } from '@/shared/motion'
import logoMark from '@/assets/logo-mark.png'
import { brokerService, type BrokerProfile } from './BrokerService'
import { brokerEnquiryMessage, brokerPageListings, cardFacts, countByType, homesCount } from './brokerPage'
import Reviews from './Reviews'
import styles from './BrokerSitePage.module.css'

/**
 * A broker's public page: who they are, how to reach them, and every listing they've made public.
 * Opened on the broker's subdomain, or at /b/:brokerId on the main site.
 */
export default function BrokerSitePage() {
  const { brokerId } = useParams<{ brokerId?: string }>()
  const ref = brokerId ? { id: brokerId } : siteSubdomain ? { subdomain: siteSubdomain } : null
  // The broker and their listings come back together, so the page isn't waiting on two requests in a row.
  const site = useQuery({
    queryKey: propertyKeys.brokerSite(brokerId ?? `@${siteSubdomain ?? ''}`),
    queryFn: () => brokerService.getSite(ref!),
    enabled: Boolean(ref),
  })
  const profile = site
  const broker = site.data?.profile
  const listings = { data: site.data?.listings, isLoading: site.isLoading, isError: site.isError, refetch: site.refetch }

  // The older /b/:id address moves to the broker's own subdomain once subdomains are on.
  const home = broker ? brokerSiteUrl(currentSite(), broker) : null
  const moving = Boolean(brokerId && broker?.subdomain && home && !home.endsWith(`/b/${broker.id}`))
  useEffect(() => {
    if (moving && home) window.location.replace(home)
  }, [moving, home])

  const name = broker?.name ?? null
  useEffect(() => {
    if (broker) document.title = `${name ?? 'Homes'} · FindHouse`
  }, [broker, name])

  return (
    <MotionConfig reducedMotion="user">
      {profile.isLoading || moving ? (
        <Loading />
      ) : broker && home ? (
        <Page profile={broker} pageUrl={home} listings={listings} />
      ) : (
        <Unavailable failed={profile.isError} />
      )}
    </MotionConfig>
  )
}

interface PageProps {
  profile: BrokerProfile
  /** The canonical address of this page, for sharing. */
  pageUrl: string
  listings: { data?: Property[]; isLoading: boolean; isError: boolean; refetch: () => unknown }
}

function Page({ profile, pageUrl, listings }: PageProps) {
  const viewer = useAuthStore((s) => s.session?.user)
  const isOwner = viewer?.id === profile.id
  const name = profile.name ?? (isOwner ? viewer.name : null)
  const homes = brokerPageListings(listings.data ?? [])
  const counts = countByType(homes)
  const [type, setType] = useState<ListingType | null>(null)
  const shown = type ? homes.filter((p) => p.listingType === type) : homes

  return (
    <div className={styles.page}>
      <header className={styles.band}>
        <nav className={styles.nav} aria-label="FindHouse">
          <Brand />
          <button type="button" className={styles.shareBtn} onClick={() => shareLink(name ?? 'Homes on FindHouse', pageUrl)}>
            <Share2 size={16} aria-hidden="true" />
            Share
          </button>
        </nav>

        <motion.div className={styles.identity} variants={stagger(0.08, 0.05)} initial="hidden" animate="show">
          <motion.span className={styles.avatar} variants={rise} aria-hidden="true">
            {name ? initials(name) : <Home size={28} />}
          </motion.span>
          <motion.h1 className={styles.name} variants={rise}>{name ?? 'Homes from your agent'}</motion.h1>
          <motion.p className={styles.meta} variants={rise}>
            {listings.isLoading ? 'Agent on FindHouse' : `${homesCount(homes.length)} available`}
          </motion.p>
          {profile.phone && (
            <motion.div className={styles.contact} variants={rise}>
              <a className={styles.callBtn} href={`tel:+${profile.phone}`}>
                <Phone size={18} aria-hidden="true" />
                {formatPhone(profile.phone)}
              </a>
              <a
                className={styles.whatsappBtn}
                href={whatsAppLink(profile.phone, brokerEnquiryMessage(pageUrl))}
                target="_blank"
                rel="noopener noreferrer"
              >
                <WhatsAppIcon />
                WhatsApp
              </a>
            </motion.div>
          )}
        </motion.div>
      </header>

      <main className={styles.main}>
        {counts.rent > 0 && counts.sale > 0 && (
          <div className={styles.filters} role="group" aria-label="Show homes">
            <Chip label="All" count={homes.length} active={!type} onSelect={() => setType(null)} />
            <Chip label="For rent" count={counts.rent} active={type === 'rent'} onSelect={() => setType('rent')} />
            <Chip label="For sale" count={counts.sale} active={type === 'sale'} onSelect={() => setType('sale')} />
          </div>
        )}

        {listings.isLoading ? (
          <div className={styles.grid} aria-busy="true" aria-label="Loading homes">
            {[0, 1, 2].map((i) => (
              <div key={i} className={styles.card}>
                <span className={`${styles.shimmer} ${styles.cardImage}`} />
                <span className={styles.shimmer} style={{ width: '40%', height: 18, marginTop: 14 }} />
                <span className={styles.shimmer} style={{ width: '75%', height: 14, marginTop: 10 }} />
              </div>
            ))}
          </div>
        ) : listings.isError ? (
          <div className={styles.empty}>
            <h2>Couldn’t load the homes</h2>
            <p>Check your connection and try again.</p>
            <button type="button" className={styles.retryBtn} onClick={() => listings.refetch()}>Try again</button>
          </div>
        ) : homes.length === 0 ? (
          <div className={styles.empty}>
            {isOwner ? (
              <>
                <h2>No public listings yet</h2>
                <p>Make a listing public and it shows here. Private listings still open for anyone you send the link to.</p>
                <a className={styles.retryBtn} href={`${mainSite}/properties`}>Go to my properties</a>
              </>
            ) : (
              <>
                <h2>No homes listed right now</h2>
                <p>{profile.phone ? 'Message the agent on WhatsApp to hear about what’s coming up.' : 'Check back soon.'}</p>
              </>
            )}
          </div>
        ) : (
          <motion.ul key={type ?? 'all'} className={styles.grid} variants={stagger(0.05)} initial="hidden" animate="show">
            {shown.map((p) => <ListingCard key={p.id} property={p} />)}
          </motion.ul>
        )}
        <Reviews brokerId={profile.id} isOwner={isOwner} />
      </main>

      <footer className={styles.footer}>
        <Brand small />
        <p>Homes listed by agents on FindHouse.</p>
      </footer>
    </div>
  )
}

const mainSite = mainOrigin(currentSite())

function ListingCard({ property: p }: { property: Property }) {
  const img = coverUrl(p)
  const place = placeOf(p) === '—' ? null : placeOf(p)
  const facts = cardFacts(p)
  return (
    <motion.li variants={rise}>
      <Link className={styles.card} to={listingPath(p)}>
        <span className={styles.cardImage}>
          {img ? <img src={img} alt="" loading="lazy" /> : <ImageOff size={22} aria-hidden="true" />}
          <span className={styles.cardType}>{p.listingType === 'rent' ? 'For rent' : 'For sale'}</span>
        </span>
        <span className={styles.cardPrice}>{priceLine(p)}</span>
        <span className={styles.cardTitle}>{p.title}</span>
        {place && <span className={styles.cardPlace}><MapPin size={14} aria-hidden="true" />{place}</span>}
        {facts.length > 0 && (
          <span className={styles.cardFacts}>
            {facts.map((f) => <span key={f}>{f}</span>)}
          </span>
        )}
      </Link>
    </motion.li>
  )
}

function Chip({ label, count, active, onSelect }: { label: string; count: number; active: boolean; onSelect: () => void }) {
  return (
    <button type="button" className={styles.chip} aria-pressed={active} onClick={onSelect}>
      {label}<span>{count}</span>
    </button>
  )
}

function Brand({ small = false }: { small?: boolean }) {
  return (
    <span className={small ? styles.brandSmall : styles.brand}>
      <span className={styles.brandMark} aria-hidden="true"><img src={logoMark} alt="" /></span>
      FindHouse
    </span>
  )
}

function Loading() {
  return (
    <div className={styles.page} aria-busy="true" aria-label="Loading this agent’s homes">
      <header className={styles.band}>
        <div className={styles.identity}>
          <span className={styles.avatar} />
        </div>
      </header>
    </div>
  )
}

/** No such broker, an inactive one, or (when `failed`) the page couldn't be fetched. */
function Unavailable({ failed }: { failed: boolean }) {
  return (
    <div className={styles.missing}>
      <Brand small />
      <motion.div className={styles.missingCard} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: easeOut }}>
        <span className={styles.missingIcon} aria-hidden="true"><Home size={26} /></span>
        {failed ? (
          <>
            <h1>We couldn’t load this page</h1>
            <p>Check your connection and refresh the page.</p>
          </>
        ) : (
          <>
            <h1>This agent’s page isn’t available</h1>
            <p>The link may be incomplete, or the agent is no longer on FindHouse. Ask them for a new link.</p>
          </>
        )}
      </motion.div>
    </div>
  )
}
