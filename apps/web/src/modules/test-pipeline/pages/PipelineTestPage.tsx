import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { createSubmissionService } from '@/modules/submissions/SubmissionService'
import { createSubmissionMessageService } from '@/modules/submissions/SubmissionMessageService'
import { getSignedUrls } from '@/lib/storage'
import type { Submission, SubmissionMessage, SubmissionStatus } from '@/modules/submissions/submission.types'
import styles from './PipelineTestPage.module.css'

// ── Gallery types ─────────────────────────────────────────────────────────────

interface ClassifiedMediaItem {
  id: string
  storagePath: string
  category: string | null
  aiDescription: string | null
  aiConfidence: number | null
  isCover: boolean
  displayOrder: number
}

const CATEGORY_ORDER = [
  'EXTERIOR', 'LIVING_ROOM', 'BEDROOM', 'KITCHEN',
  'BATHROOM', 'BALCONY', 'AMENITIES', 'PARKING', 'FLOOR_PLAN', 'OTHER',
] as const

const CATEGORY_LABELS: Record<string, string> = {
  EXTERIOR: 'Exterior', LIVING_ROOM: 'Living Room', BEDROOM: 'Bedroom',
  KITCHEN: 'Kitchen',   BATHROOM: 'Bathroom',       BALCONY: 'Balcony',
  AMENITIES: 'Amenities', PARKING: 'Parking',       FLOOR_PLAN: 'Floor Plan',
  OTHER: 'Other',
}

const CLASS_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:         { label: 'Classification pending',  color: '#8892A4', bg: '#F1F5F9' },
  PROCESSING:      { label: 'Classifying images…',     color: '#D97706', bg: '#FEF3C7' },
  COMPLETED:       { label: 'Images classified',       color: '#16A34A', bg: '#DCFCE7' },
  PARTIAL_FAILURE: { label: 'Partial failure',         color: '#EA580C', bg: '#FFF7ED' },
  FAILED:          { label: 'Classification failed',   color: '#DC2626', bg: '#FEE2E2' },
}

const submissionSvc = createSubmissionService()
const messageSvc = createSubmissionMessageService()

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<SubmissionStatus, { label: string; color: string; bg: string }> = {
  COLLECTING:  { label: 'Collecting',  color: '#2E6AF0', bg: '#EEF3FE' },
  PROCESSING:  { label: 'Processing',  color: '#D97706', bg: '#FEF3C7' },
  COMPLETED:   { label: 'Completed',   color: '#16A34A', bg: '#DCFCE7' },
  FAILED:      { label: 'Failed',      color: '#DC2626', bg: '#FEE2E2' },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PipelineTestPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<SubmissionMessage[]>([])
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({})
  const [loadingSubmissions, setLoadingSubmissions] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  // Property state
  interface PropertyData {
    title: string; propertyType: string; listingType: string; price: number | null
    deposit: number | null; location: string | null; locality: string | null
    bedrooms: number | null; bathrooms: number | null; balconies: number | null
    builtUpArea: number | null; carpetArea: number | null; furnishing: string | null
    floor: string | null; totalFloors: number | null; parking: string | null
    moveInDate: string | null; amenities: string[]; description: string | null
    other: Record<string, unknown> | null; slug: string
  }
  const [propertyData, setPropertyData] = useState<PropertyData | null>(null)
  const [loadingProperty, setLoadingProperty] = useState(false)

  // Gallery state
  const [activeTab, setActiveTab] = useState<'messages' | 'gallery' | 'property'>('messages')
  const [classifiedMedia, setClassifiedMedia] = useState<ClassifiedMediaItem[]>([])
  const [galleryUrls, setGalleryUrls] = useState<Record<string, string>>({})
  const [classificationStatus, setClassificationStatus] = useState<string | null>(null)
  const [loadingGallery, setLoadingGallery] = useState(false)

  const selected = submissions.find((s) => s.id === selectedId) ?? null

  // ── Fetch submissions ───────────────────────────────────────────────────────
  const fetchSubmissions = useCallback(async () => {
    setFetchError(null)
    try {
      const data = await submissionSvc.list()
      setSubmissions(data)
      setLastRefresh(new Date())
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setFetchError(msg)
      console.error('[PipelineTestPage] fetch submissions:', msg)
    } finally {
      setLoadingSubmissions(false)
    }
  }, [])

  // ── Fetch messages + signed media URLs ─────────────────────────────────────
  const fetchMessages = useCallback(async (submissionId: string) => {
    setLoadingMessages(true)
    setMediaUrls({})
    try {
      const msgs = await messageSvc.getForSubmission(submissionId)
      setMessages(msgs)

      // Batch-sign all media paths
      const paths = msgs
        .map((m) => m.mediaStoragePath)
        .filter((p): p is string => !!p)

      if (paths.length > 0) {
        const urls = await getSignedUrls(paths)
        const map: Record<string, string> = {}
        paths.forEach((p, i) => { if (urls[i]) map[p] = urls[i]! })
        setMediaUrls(map)
      }
    } catch (err) {
      console.error('[PipelineTestPage] fetch messages:', err)
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  // ── Realtime subscription ───────────────────────────────────────────────────
  useEffect(() => {
    fetchSubmissions()

    const channel = supabase
      .channel('pipeline-monitor')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_submissions' },
        () => fetchSubmissions(),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_submission_messages' },
        (payload) => {
          if (payload.new.submission_id === selectedId) {
            fetchMessages(selectedId!)
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchSubmissions, fetchMessages, selectedId])

  // ── Fetch classified gallery from property_media ───────────────────────────
  const fetchGallery = useCallback(async (propertyId: string) => {
    setLoadingGallery(true)
    setClassifiedMedia([])
    setGalleryUrls({})
    setClassificationStatus(null)
    try {
      const { data: prop } = await supabase
        .from('properties')
        .select('image_classification_status')
        .eq('id', propertyId)
        .single()

      setClassificationStatus(prop?.image_classification_status ?? 'PENDING')

      const { data: media } = await supabase
        .from('property_media')
        .select('id, storage_path, category, ai_description, ai_confidence, is_cover, display_order')
        .eq('property_id', propertyId)
        .eq('media_type', 'image')
        .order('display_order', { ascending: true })

      if (!media || media.length === 0) return

      const items: ClassifiedMediaItem[] = media.map((m) => ({
        id:            m.id,
        storagePath:   m.storage_path,
        category:      m.category,
        aiDescription: m.ai_description,
        aiConfidence:  m.ai_confidence,
        isCover:       m.is_cover,
        displayOrder:  m.display_order,
      }))
      setClassifiedMedia(items)

      const paths = items.map((m) => m.storagePath)
      const urls  = await getSignedUrls(paths)
      const map: Record<string, string> = {}
      paths.forEach((p, i) => { if (urls[i]) map[p] = urls[i]! })
      setGalleryUrls(map)
    } catch (err) {
      console.error('[PipelineTestPage] fetch gallery:', err)
    } finally {
      setLoadingGallery(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId) {
      fetchMessages(selectedId)
    } else {
      setMessages([])
      setMediaUrls({})
      setClassifiedMedia([])
      setGalleryUrls({})
      setClassificationStatus(null)
      setPropertyData(null)
      setActiveTab('messages')
    }
  }, [selectedId, fetchMessages])

  // Fetch property data + gallery whenever the selected submission has a property linked
  const fetchProperty = useCallback(async (propertyId: string) => {
    setLoadingProperty(true)
    try {
      const { data } = await supabase
        .from('properties')
        .select('title, property_type, listing_type, price, deposit, location, locality, bedrooms, bathrooms, balconies, built_up_area, carpet_area, furnishing, floor, total_floors, parking, move_in_date, amenities, description, other, slug')
        .eq('id', propertyId)
        .single()
      if (data) {
        setPropertyData({
          title: data.title, propertyType: data.property_type, listingType: data.listing_type,
          price: data.price, deposit: data.deposit, location: data.location, locality: data.locality,
          bedrooms: data.bedrooms, bathrooms: data.bathrooms, balconies: data.balconies,
          builtUpArea: data.built_up_area, carpetArea: data.carpet_area, furnishing: data.furnishing,
          floor: data.floor, totalFloors: data.total_floors, parking: data.parking,
          moveInDate: data.move_in_date, amenities: data.amenities ?? [],
          description: data.description, other: data.other, slug: data.slug,
        })
      }
    } catch (err) {
      console.error('[PipelineTestPage] fetch property:', err)
    } finally {
      setLoadingProperty(false)
    }
  }, [])

  useEffect(() => {
    if (selected?.propertyId) {
      fetchGallery(selected.propertyId)
      fetchProperty(selected.propertyId)
    } else {
      setClassifiedMedia([])
      setGalleryUrls({})
      setClassificationStatus(null)
      setPropertyData(null)
    }
  }, [selected?.propertyId, fetchGallery, fetchProperty])

  // ── Counts ──────────────────────────────────────────────────────────────────
  const counts = {
    COLLECTING:  submissions.filter((s) => s.status === 'COLLECTING').length,
    PROCESSING:  submissions.filter((s) => s.status === 'PROCESSING').length,
    COMPLETED:   submissions.filter((s) => s.status === 'COMPLETED').length,
    FAILED:      submissions.filter((s) => s.status === 'FAILED').length,
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={styles.root}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerTitle}>
            <PipelineIcon />
            <h1>Pipeline Monitor</h1>
          </div>
          <p className={styles.headerSub}>
            Live view of WhatsApp property submissions. Updates in real time.
          </p>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.liveChip}>
            <span className={styles.liveDot} />
            Live
          </div>
          <button className={styles.refreshBtn} onClick={fetchSubmissions}>
            <RefreshIcon /> Refresh
          </button>
          <span className={styles.lastRefresh}>Updated {formatTime(lastRefresh)}</span>
        </div>
      </header>

      {/* Stats */}
      <div className={styles.stats}>
        {(['COLLECTING', 'PROCESSING', 'COMPLETED', 'FAILED'] as const).map((s) => (
          <div key={s} className={styles.statCard} style={{ borderTopColor: STATUS_CONFIG[s].color }}>
            <span className={styles.statNum} style={{ color: STATUS_CONFIG[s].color }}>{counts[s]}</span>
            <span className={styles.statLabel}>{STATUS_CONFIG[s].label}</span>
          </div>
        ))}
        <div className={styles.statCard} style={{ borderTopColor: '#8892A4' }}>
          <span className={styles.statNum}>{submissions.length}</span>
          <span className={styles.statLabel}>Total</span>
        </div>
      </div>

      {/* Main */}
      <div className={styles.main}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <span>Submissions</span>
            <span className={styles.sessionCount}>{submissions.length}</span>
          </div>

          {loadingSubmissions ? (
            <div className={styles.emptyState}><div className="spinner" /></div>
          ) : fetchError ? (
            <div className={styles.emptyState}>
              <p style={{ color: 'var(--color-red)', fontSize: 12, textAlign: 'left', wordBreak: 'break-word' }}>
                Error: {fetchError}
              </p>
            </div>
          ) : submissions.length === 0 ? (
            <div className={styles.emptyState}>
              <EmptyIcon />
              <p>No submissions yet.</p>
              <p className={styles.emptyHint}>Send a WhatsApp message to start one.</p>
            </div>
          ) : (
            <ul className={styles.sessionList}>
              {submissions.map((sub) => {
                const cfg = STATUS_CONFIG[sub.status]
                return (
                  <li key={sub.id}>
                    <button
                      className={`${styles.sessionItem} ${selectedId === sub.id ? styles.selectedItem : ''}`}
                      onClick={() => setSelectedId(sub.id)}
                    >
                      <div className={styles.sessionItemTop}>
                        <span className={styles.sessionPhone}>{sub.senderPhone}</span>
                        <span className={styles.statusBadge} style={{ color: cfg.color, background: cfg.bg }}>
                          {cfg.label}
                        </span>
                      </div>
                      <div className={styles.sessionItemBot}>
                        <span className={styles.sessionTime}>{formatRelative(sub.startedAt)}</span>
                        {sub.completedAt && (
                          <span className={styles.sessionTime}>done {formatRelative(sub.completedAt)}</span>
                        )}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        {/* Detail */}
        <section className={styles.detail}>
          {!selected ? (
            <div className={styles.emptyDetail}>
              <SelectIcon />
              <p>Select a submission to inspect it.</p>
            </div>
          ) : (
            <div className={styles.detailScroll}>
              {/* Header */}
              <div className={styles.detailHeader}>
                <div>
                  <div className={styles.detailTitle}>
                    <span className={styles.sessionPhone}>{selected.senderPhone}</span>
                    <span
                      className={styles.statusBadge}
                      style={{
                        color: STATUS_CONFIG[selected.status].color,
                        background: STATUS_CONFIG[selected.status].bg,
                      }}
                    >
                      {STATUS_CONFIG[selected.status].label}
                    </span>
                  </div>
                  <p className={styles.detailMeta}>
                    Started {formatTime(new Date(selected.startedAt))}
                    {selected.completedAt && ` · Completed ${formatTime(new Date(selected.completedAt))}`}
                  </p>
                </div>
                <code className={styles.sessionId}>{selected.id.slice(0, 8)}…</code>
              </div>

              {/* Tab switcher */}
              <div className={styles.tabs}>
                <button
                  className={`${styles.tab} ${activeTab === 'messages' ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab('messages')}
                >
                  Messages {messages.length > 0 && <span className={styles.tabCount}>{messages.length}</span>}
                </button>
                {selected.propertyId && (
                  <button
                    className={`${styles.tab} ${activeTab === 'property' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('property')}
                  >
                    Property
                  </button>
                )}
                {selected.propertyId && (
                  <button
                    className={`${styles.tab} ${activeTab === 'gallery' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('gallery')}
                  >
                    Gallery {classifiedMedia.length > 0 && <span className={styles.tabCount}>{classifiedMedia.length}</span>}
                  </button>
                )}
              </div>

              {/* Messages tab */}
              {activeTab === 'messages' && (
                <div className={styles.section}>
                  <div className={styles.sectionLabel}>
                    Messages
                    {loadingMessages && <div className={`spinner ${styles.inlineSpinner}`} />}
                  </div>
                  {messages.length === 0 && !loadingMessages ? (
                    <p className={styles.emptyHint}>No messages in this submission.</p>
                  ) : (
                    <div className={styles.messageList}>
                      {groupMessages(messages, mediaUrls).map((group, i) => (
                        <MessageGroup key={i} group={group} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Property tab */}
              {activeTab === 'property' && selected.propertyId && (
                <div className={styles.section}>
                  {loadingProperty ? (
                    <div className={styles.emptyHint}>Loading property data…</div>
                  ) : !propertyData ? (
                    <div className={styles.emptyHint}>No property data found.</div>
                  ) : (
                    <div className={styles.propertyCard}>
                      <div className={styles.propHeader}>
                        <h3 className={styles.propTitle}>{propertyData.title}</h3>
                        <div className={styles.propBadges}>
                          <span className={styles.propBadge}>{propertyData.propertyType || 'Unknown'}</span>
                          <span className={styles.propBadge}>{propertyData.listingType === 'rent' ? 'For Rent' : 'For Sale'}</span>
                        </div>
                      </div>
                      <div className={styles.propGrid}>
                        <div className={styles.propField}>
                          <span className={styles.propFieldLabel}>Price</span>
                          <span className={styles.propFieldValue}>{propertyData.price != null ? `₹${Number(propertyData.price).toLocaleString('en-IN')}` : <em>—</em>}</span>
                        </div>
                        <div className={styles.propField}>
                          <span className={styles.propFieldLabel}>Deposit</span>
                          <span className={styles.propFieldValue}>{propertyData.deposit != null ? `₹${Number(propertyData.deposit).toLocaleString('en-IN')}` : <em>—</em>}</span>
                        </div>
                        <div className={styles.propField}>
                          <span className={styles.propFieldLabel}>Location</span>
                          <span className={styles.propFieldValue}>{propertyData.location || <em>—</em>}</span>
                        </div>
                        <div className={styles.propField}>
                          <span className={styles.propFieldLabel}>Locality</span>
                          <span className={styles.propFieldValue}>{propertyData.locality || <em>—</em>}</span>
                        </div>
                        <div className={styles.propField}>
                          <span className={styles.propFieldLabel}>Bedrooms</span>
                          <span className={styles.propFieldValue}>{propertyData.bedrooms ?? <em>—</em>}</span>
                        </div>
                        <div className={styles.propField}>
                          <span className={styles.propFieldLabel}>Bathrooms</span>
                          <span className={styles.propFieldValue}>{propertyData.bathrooms ?? <em>—</em>}</span>
                        </div>
                        <div className={styles.propField}>
                          <span className={styles.propFieldLabel}>Balconies</span>
                          <span className={styles.propFieldValue}>{propertyData.balconies ?? <em>—</em>}</span>
                        </div>
                        <div className={styles.propField}>
                          <span className={styles.propFieldLabel}>Built-up Area</span>
                          <span className={styles.propFieldValue}>{propertyData.builtUpArea != null ? `${propertyData.builtUpArea} sq ft` : <em>—</em>}</span>
                        </div>
                        <div className={styles.propField}>
                          <span className={styles.propFieldLabel}>Carpet Area</span>
                          <span className={styles.propFieldValue}>{propertyData.carpetArea != null ? `${propertyData.carpetArea} sq ft` : <em>—</em>}</span>
                        </div>
                        <div className={styles.propField}>
                          <span className={styles.propFieldLabel}>Furnishing</span>
                          <span className={styles.propFieldValue}>{propertyData.furnishing || <em>—</em>}</span>
                        </div>
                        <div className={styles.propField}>
                          <span className={styles.propFieldLabel}>Floor</span>
                          <span className={styles.propFieldValue}>{propertyData.floor ?? <em>—</em>}{propertyData.totalFloors != null ? ` of ${propertyData.totalFloors}` : ''}</span>
                        </div>
                        <div className={styles.propField}>
                          <span className={styles.propFieldLabel}>Parking</span>
                          <span className={styles.propFieldValue}>{propertyData.parking || <em>—</em>}</span>
                        </div>
                        <div className={styles.propField}>
                          <span className={styles.propFieldLabel}>Move-in Date</span>
                          <span className={styles.propFieldValue}>{propertyData.moveInDate || <em>—</em>}</span>
                        </div>
                      </div>
                      {propertyData.description && (
                        <p className={styles.propDesc}>{propertyData.description}</p>
                      )}
                      {propertyData.amenities.length > 0 && (
                        <div className={styles.amenities}>
                          {propertyData.amenities.map((a, i) => (
                            <span key={i} className={styles.amenityChip}>{a}</span>
                          ))}
                        </div>
                      )}
                      {propertyData.other && Object.keys(propertyData.other).length > 0 && (
                        <div className={styles.propGrid}>
                          {Object.entries(propertyData.other).map(([key, val]) => (
                            <div key={key} className={styles.propField}>
                              <span className={styles.propFieldLabel}>{key.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').trim()}</span>
                              <span className={styles.propFieldValue}>{String(val)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <a className={styles.viewLink} href={`/property/${propertyData.slug}`} target="_blank" rel="noopener noreferrer">
                        /property/{propertyData.slug}
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Gallery tab */}
              {activeTab === 'gallery' && selected.propertyId && (
                <ClassifiedGallery
                  classificationStatus={classificationStatus}
                  classifiedMedia={classifiedMedia}
                  galleryUrls={galleryUrls}
                  loading={loadingGallery}
                />
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

// ── Classified Gallery ────────────────────────────────────────────────────────

function ClassifiedGallery({
  classificationStatus,
  classifiedMedia,
  galleryUrls,
  loading,
}: {
  classificationStatus: string | null
  classifiedMedia: ClassifiedMediaItem[]
  galleryUrls: Record<string, string>
  loading: boolean
}) {
  const grouped = useMemo(() => {
    const map: Record<string, ClassifiedMediaItem[]> = {}
    for (const cat of CATEGORY_ORDER) {
      const items = classifiedMedia.filter((m) => m.category === cat)
      if (items.length > 0) map[cat] = items
    }
    // Uncategorized (category null — not yet classified)
    const uncat = classifiedMedia.filter((m) => !m.category)
    if (uncat.length > 0) map['_unclassified'] = uncat
    return map
  }, [classifiedMedia])

  const statusCfg = classificationStatus ? CLASS_STATUS_CONFIG[classificationStatus] : null
  const isReady   = classificationStatus === 'COMPLETED' || classificationStatus === 'PARTIAL_FAILURE'

  if (loading) {
    return (
      <div className={styles.galleryEmpty}>
        <div className="spinner" />
        <p>Loading gallery…</p>
      </div>
    )
  }

  return (
    <div className={styles.gallery}>
      {/* Classification status */}
      {statusCfg && (
        <div
          className={styles.classifyBadge}
          style={{ color: statusCfg.color, background: statusCfg.bg }}
        >
          {classificationStatus === 'PROCESSING' && <div className={`spinner ${styles.inlineSpinner}`} />}
          {statusCfg.label}
          {classificationStatus === 'PARTIAL_FAILURE' && ' — some images failed'}
        </div>
      )}

      {/* No media yet */}
      {classifiedMedia.length === 0 && (
        <div className={styles.galleryEmpty}>
          <p>No property images found.</p>
          <p className={styles.emptyHint}>Images appear here after the submission is processed.</p>
        </div>
      )}

      {/* Unclassified fallback (PENDING / before AI runs) */}
      {!isReady && grouped['_unclassified'] && grouped['_unclassified'].length > 0 && (
        <CategorySection
          label="All Images"
          items={grouped['_unclassified']}
          urls={galleryUrls}
          showMeta={false}
        />
      )}

      {/* Classified groups */}
      {isReady && CATEGORY_ORDER.map((cat) => {
        const items = grouped[cat]
        if (!items) return null
        return (
          <CategorySection
            key={cat}
            label={CATEGORY_LABELS[cat]}
            items={items}
            urls={galleryUrls}
            showMeta
          />
        )
      })}
    </div>
  )
}

function CategorySection({
  label,
  items,
  urls,
  showMeta,
}: {
  label: string
  items: ClassifiedMediaItem[]
  urls: Record<string, string>
  showMeta: boolean
}) {
  return (
    <div className={styles.categoryGroup}>
      <div className={styles.categoryHeader}>
        <span className={styles.categoryLabel}>{label}</span>
        <span className={styles.categoryCount}>{items.length}</span>
      </div>
      <div className={styles.categoryGrid}>
        {items.map((item) => (
          <a
            key={item.id}
            href={urls[item.storagePath] ?? '#'}
            target="_blank"
            rel="noreferrer"
            className={styles.galleryCell}
          >
            {item.isCover && <span className={styles.coverBadge}>Cover</span>}
            {urls[item.storagePath] ? (
              <img
                src={urls[item.storagePath]}
                alt={item.aiDescription ?? label}
                className={styles.galleryImg}
                loading="lazy"
              />
            ) : (
              <div className={styles.galleryPlaceholder}><AttachIcon /></div>
            )}
            {showMeta && item.aiDescription && (
              <div className={styles.galleryCaption}>
                <span className={styles.galleryCaptionText}>{item.aiDescription}</span>
                {item.aiConfidence != null && (
                  <span className={styles.galleryConf}>{Math.round(item.aiConfidence * 100)}%</span>
                )}
              </div>
            )}
          </a>
        ))}
      </div>
    </div>
  )
}

// ── Message grouping ──────────────────────────────────────────────────────────

type MsgGroup =
  | { kind: 'text';    msg: SubmissionMessage }
  | { kind: 'photos';  msgs: SubmissionMessage[]; urls: (string | undefined)[] }
  | { kind: 'video';   msg: SubmissionMessage; url?: string }
  | { kind: 'command'; msg: SubmissionMessage }

function groupMessages(messages: SubmissionMessage[], urlMap: Record<string, string>): MsgGroup[] {
  const groups: MsgGroup[] = []
  let i = 0
  while (i < messages.length) {
    const m = messages[i]
    if (m.messageType === 'image') {
      const batch = [m]
      while (i + 1 < messages.length && messages[i + 1].messageType === 'image') {
        batch.push(messages[++i])
      }
      groups.push({
        kind: 'photos',
        msgs: batch,
        urls: batch.map((b) => b.mediaStoragePath ? urlMap[b.mediaStoragePath] : undefined),
      })
    } else if (m.messageType === 'video') {
      groups.push({ kind: 'video', msg: m, url: m.mediaStoragePath ? urlMap[m.mediaStoragePath] : undefined })
    } else if (m.messageType === 'command') {
      groups.push({ kind: 'command', msg: m })
    } else {
      groups.push({ kind: 'text', msg: m })
    }
    i++
  }
  return groups
}

// ── MessageGroup renderer ────────────────────────────────────────────────────

function MessageGroup({ group }: { group: MsgGroup }) {
  if (group.kind === 'command') {
    return (
      <div className={styles.commandMsg}>
        <span className={styles.commandLine} />
        <span className={styles.commandLabel}>
          <DoneIcon /> {group.msg.textBody ?? 'DONE'} · {formatTs(group.msg)}
        </span>
        <span className={styles.commandLine} />
      </div>
    )
  }

  if (group.kind === 'text') {
    const m = group.msg
    return (
      <div className={styles.bubble}>
        <p className={styles.bubbleText}>{m.textBody}</p>
        <span className={styles.bubbleTime}>{formatTs(m)}</span>
      </div>
    )
  }

  if (group.kind === 'photos') {
    const { msgs, urls } = group
    const count = msgs.length
    return (
      <div className={styles.photoGroup}>
        <div className={`${styles.photoGrid} ${styles[`photoGrid${Math.min(count, 3)}`]}`}>
          {msgs.map((m, idx) => (
            <a
              key={m.id}
              href={urls[idx] ?? '#'}
              target="_blank"
              rel="noreferrer"
              className={`${styles.photoCell} ${count === 3 && idx === 0 ? styles.photoCellWide : ''}`}
            >
              {urls[idx] ? (
                <img src={urls[idx]} alt={`photo ${idx + 1}`} className={styles.photo} loading="lazy" />
              ) : (
                <div className={styles.photoPlaceholder}><AttachIcon /></div>
              )}
            </a>
          ))}
        </div>
        {msgs.some((m) => m.caption) && (
          <p className={styles.photoCaption}>
            {msgs.find((m) => m.caption)?.caption}
          </p>
        )}
        <span className={styles.bubbleTime}>{formatTs(msgs[msgs.length - 1])} · {count} photo{count > 1 ? 's' : ''}</span>
      </div>
    )
  }

  if (group.kind === 'video') {
    const { msg: m, url } = group
    return (
      <div className={styles.bubble}>
        {url ? (
          <video src={url} className={styles.videoPlayer} controls muted playsInline />
        ) : (
          <div className={styles.photoPlaceholder}><AttachIcon /> video unavailable</div>
        )}
        {m.caption && <p className={styles.bubbleText} style={{ marginTop: 6 }}>{m.caption}</p>}
        <span className={styles.bubbleTime}>{formatTs(m)}</span>
      </div>
    )
  }

  return null
}

function formatTs(m: SubmissionMessage) {
  const d = m.whatsappTimestamp ? new Date(m.whatsappTimestamp) : new Date(m.createdAt)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function PipelineIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}
function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  )
}
function EmptyIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-fg3)' }}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}
function SelectIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-fg3)' }}>
      <rect width="8" height="8" x="2" y="2" rx="2" />
      <path d="M14 2h4a2 2 0 0 1 2 2v4" />
      <path d="M14 22h4a2 2 0 0 0 2-2v-4" />
      <path d="M2 14v4a2 2 0 0 0 2 2h4" />
    </svg>
  )
}
function AttachIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: 4 }}>
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  )
}
function DoneIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: 4 }}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
