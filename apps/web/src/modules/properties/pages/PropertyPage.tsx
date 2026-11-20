import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Bath, BedDouble, ChevronDown, Copy, Ellipsis, ExternalLink, FilePen, Globe, Images, Lock, MapPin, Ruler, SearchX, Share2, Sofa, Trash2, TriangleAlert } from 'lucide-react'
import { Button } from '@/shared/components/Button'
import { ListingTypeBadge } from '@/shared/components/Badge'
import { motion, type Variants } from 'framer-motion'
import { Card, EmptyState, Skeleton } from '@/shared/components/Card'
import { easeOut, pop, stagger, useEntranceInitial } from '@/shared/motion'
import { Menu, type MenuItem } from '@/shared/components/Menu'
import { PageHero } from '@/shared/components/PageHero/PageHero'
import { heroBody, heroGlassBtn } from '@/shared/components/PageHero/heroClasses'
import { toast } from '@/shared/components/toastStore'
import { PropertyForm } from '../components/PropertyForm'
import { MediaGallery } from '../components/MediaGallery'
import { usePropertyActions } from '../components/usePropertyActions'
import { useProperty } from '../hooks/useProperty'
import { useUpdateProperty } from '../hooks/usePropertyMutations'
import { STATUS_META, STATUS_TO_DB, coverUrl, listingStatus, placeOf } from '../listingStatus'
import { copyPropertyLink, shareProperty } from '../shareProperty'
import { useMySite } from '@/modules/broker-site/useBrokerSite'
import { depositLine, maintenanceLine } from '../listingExtras'
import { ListingStatusBadge } from '../components/ListingStatusBadge'
import { VisibilityBadge } from '../components/VisibilityBadge'
import { hiddenReason } from '../visibility'
import type { UpdatePropertyInput } from '../property.types'
import styles from './PropertyPage.module.css'

type Tab = 'details' | 'media'

export default function PropertyPage() {
  const entranceInitial = useEntranceInitial()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('details')

  const { data: property, isLoading, isError, refetch } = useProperty(id)
  const { mutateAsync: update, isPending: saving } = useUpdateProperty(id!)
  const actions = usePropertyActions(() => navigate('/properties'))
  const site = useMySite()

  async function handleSave(data: UpdatePropertyInput) {
    await update(data)
    toast.success('Changes saved')
  }

  if (isLoading) {
    return (
      <>
        <PageHero back={BACK} className={styles.coverHero} />
        <div className={styles.sheet} aria-busy="true" aria-label="Loading property">
          <Skeleton width={120} height={12} />
          <Skeleton width="45%" height={26} className={styles.loadingLine} />
          <Skeleton width="30%" height={12} className={styles.loadingLine} />
        </div>
      </>
    )
  }

  if (isError) {
    return (
      <>
        <PageHero back={BACK} title="Couldn’t load this property" />
        <Card className={heroBody}>
          <EmptyState
            icon={<TriangleAlert size={20} />}
            title="Couldn’t load this property"
            description="Check your connection and try again."
            action={<Button variant="secondary" onClick={() => refetch()}>Try again</Button>}
          />
        </Card>
      </>
    )
  }

  if (!property) {
    return (
      <>
        <PageHero back={BACK} title="Property not found" />
        <Card className={heroBody}>
          <EmptyState
            icon={<SearchX size={20} />}
            title="Property not found"
            description="It may have been deleted, or the link is wrong."
            action={<Button as={Link} to="/properties" variant="secondary">Back to my properties</Button>}
          />
        </Card>
      </>
    )
  }

  const status = listingStatus(property)
  const photoCount = property.media.filter((m) => m.mediaType === 'image').length
  const statusOptions = (['active', 'rented', 'inactive'] as const)
    .filter((s) => property.listingType === 'rent' || s !== 'rented')
  const specs = [
    property.bedrooms != null && { icon: <BedDouble size={18} />, value: `${property.bedrooms} BHK`, label: 'Bedrooms' },
    property.bathrooms != null && { icon: <Bath size={18} />, value: String(property.bathrooms), label: 'Bathrooms' },
    property.builtUpArea != null && { icon: <Ruler size={18} />, value: `${property.builtUpArea.toLocaleString('en-IN')} sq ft`, label: 'Built-up area' },
    property.furnishing && { icon: <Sofa size={18} />, value: property.furnishing.charAt(0).toUpperCase() + property.furnishing.slice(1), label: 'Furnishing' },
  ].filter((x): x is { icon: React.ReactElement; value: string; label: string } => Boolean(x))

  const statusItems: MenuItem[] = statusOptions.map((s) => ({
    label: s === 'inactive' && property.listingType === 'sale' ? 'Sold' : STATUS_META[s].label,
    disabled: property.status === STATUS_TO_DB[s],
    onSelect: () => actions.changeStatus(property, STATUS_TO_DB[s]),
  }))
  const moreItems: MenuItem[] = [
    { label: 'Copy public link', icon: <Copy size={16} />, onSelect: () => copyPropertyLink(property, site.listingUrl(property)) },
    { label: 'Delete property', icon: <Trash2 size={16} />, danger: true, separatorBefore: true, onSelect: () => actions.requestDelete(property) },
  ]
  const priceLabel = property.listingType === 'rent' ? 'Monthly rent' : 'Price'
  const priceNotes = [maintenanceLine(property), depositLine(property)].filter((s): s is string => Boolean(s))
  const statusTrigger = <>Status: {STATUS_META[status].label}<ChevronDown size={16} aria-hidden="true" /></>

  return (
    <>
      <PageHero
        image={coverUrl(property)}
        back={BACK}
        className={styles.coverHero}
        actions={
          <>
            <button type="button" className={heroGlassBtn} onClick={() => shareProperty(property, site.listingUrl(property))} aria-label="Share property">
              <Share2 size={18} aria-hidden="true" />
            </button>
            <Menu label="More actions" triggerClassName={heroGlassBtn} trigger={<Ellipsis size={20} aria-hidden="true" />} items={moreItems} />
          </>
        }
      >
        <button type="button" className={styles.photoChip} onClick={() => setTab('media')}>
          <Images size={14} aria-hidden="true" />
          {photoCount ? `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}` : 'Add photos'}
        </button>
      </PageHero>

      <motion.section
        className={styles.sheet}
        aria-label="Property summary"
        variants={sheetIn}
        initial={entranceInitial}
        animate="show"
      >
        <div className={styles.sheetHead}>
          <div className={styles.eyebrow}>
            <ListingTypeBadge type={property.listingType} />
            <ListingStatusBadge property={property} />
            <VisibilityBadge property={property} />
          </div>
          <h1 className={styles.sheetTitle}>{property.title}</h1>
          {placeOf(property) && <p className={styles.sheetPlace}><MapPin size={14} aria-hidden="true" />{placeOf(property)}</p>}
        </div>
        <div className={styles.sheetPrice}>
          <span className={styles.priceLabel}>{priceLabel}</span>
          {property.price
            ? <span className={styles.priceValue}>₹{property.price.toLocaleString('en-IN')}</span>
            : <span className={styles.priceEmpty}>Not set</span>}
          {priceNotes.map((line) => <span key={line} className={styles.priceNote}>{line}</span>)}
        </div>
        {specs.length > 0 && (
          <motion.ul className={styles.tiles} variants={stagger(0.07)}>
            {specs.map((sp, i) => (
              <motion.li key={sp.label} className={styles[`tint_${TINTS[i % TINTS.length]}`]} variants={pop}>
                <span className={styles.tileIcon} aria-hidden="true">{sp.icon}</span>
                <span className={styles.specText}>
                  <span className={styles.specValue}>{sp.value}</span>
                  <span className={styles.specLabel}>{sp.label}</span>
                </span>
              </motion.li>
            ))}
          </motion.ul>
        )}
        <div className={styles.sheetActions}>
          <Button as="a" href={site.listingUrl(property)} target="_blank" rel="noreferrer" variant="secondary">
            <ExternalLink size={16} aria-hidden="true" />
            Public page
          </Button>
          <Menu label="Change status" triggerClassName={styles.statusBtn} trigger={statusTrigger} items={statusItems} />
        </div>
      </motion.section>

      <section className={styles.visibility} aria-labelledby="visibility-title">
        <span className={styles.visibilityIcon} aria-hidden="true">
          {property.isPublic ? <Globe size={18} /> : <Lock size={18} />}
        </span>
        <div className={styles.visibilityText}>
          <h2 id="visibility-title">{property.isPublic ? 'Public listing' : 'Private listing'}</h2>
          <p>
            {property.isPublic
              ? hiddenReason(property) ?? 'Shown on your public page, where anyone can find it.'
              : 'Hidden from your public page and from search engines. Anyone you send the link to can still open it.'}
          </p>
          {property.isPublic && site.pageUrl && (
            <a className={styles.visibilityLink} href={site.pageUrl} target="_blank" rel="noreferrer">
              View your public page<ExternalLink size={14} aria-hidden="true" />
            </a>
          )}
        </div>
        <div className={styles.segment} role="group" aria-label="Who can find this listing">
          <button
            type="button"
            aria-pressed={!property.isPublic}
            disabled={actions.visibilityPending}
            onClick={() => property.isPublic && actions.changeVisibility(property, false)}
          >
            <Lock size={16} aria-hidden="true" />Private
          </button>
          <button
            type="button"
            aria-pressed={property.isPublic}
            disabled={actions.visibilityPending}
            onClick={() => !property.isPublic && actions.changeVisibility(property, true)}
          >
            <Globe size={16} aria-hidden="true" />Public
          </button>
        </div>
      </section>

      {status === 'draft' && (
        <div className={styles.notice} role="note">
          <FilePen size={18} aria-hidden="true" />
          <p>
            <strong>This property is a draft.</strong>{' '}
            {!property.price && !photoCount
              ? 'Add the rent and at least one photo to make it active.'
              : !property.price
                ? 'Add the rent to make it active.'
                : 'Add at least one photo to make it active.'}
          </p>
          {!photoCount && (
            <button type="button" className={styles.noticeAction} onClick={() => setTab('media')}>Add photos</button>
          )}
        </div>
      )}

      <div className={styles.tabs} role="tablist" aria-label="Property sections">
        <button
          role="tab"
          id="tab-details"
          aria-selected={tab === 'details'}
          aria-controls="panel-details"
          className={`${styles.tab} ${tab === 'details' ? styles.tabActive : ''}`}
          onClick={() => setTab('details')}
        >
          Details
        </button>
        <button
          role="tab"
          id="tab-media"
          aria-selected={tab === 'media'}
          aria-controls="panel-media"
          className={`${styles.tab} ${tab === 'media' ? styles.tabActive : ''}`}
          onClick={() => setTab('media')}
        >
          <span>Photos<span className={styles.tabLong}> and videos</span></span>
          <span className={styles.tabCount}>{property.media.length}</span>
        </button>
      </div>

      {tab === 'details' && (
        <div role="tabpanel" id="panel-details" aria-labelledby="tab-details">
          <PropertyForm
            initialValues={property}
            onSubmit={handleSave}
            submitLabel="Save changes"
            isLoading={saving}
          />
        </div>
      )}

      {tab === 'media' && (
        <div role="tabpanel" id="panel-media" aria-labelledby="tab-media">
          <MediaGallery propertyId={property.id} media={property.media} />
        </div>
      )}

      {actions.dialog}
    </>
  )
}

const TINTS = ['mint', 'green', 'lavender', 'peach'] as const
const sheetIn: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: easeOut, delay: 0.15, delayChildren: 0.35 } },
}
const BACK = { to: '/properties', label: 'Back to my properties' }
