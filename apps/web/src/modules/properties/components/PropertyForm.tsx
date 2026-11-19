import { motion } from 'framer-motion'
import { useId, useState, type ReactNode } from 'react'
import { AlignLeft, BedDouble, FileText, ListChecks, MapPin } from 'lucide-react'
import { Input } from '@/shared/components/Input'
import { Button } from '@/shared/components/Button'
import type { CreatePropertyInput, Property, UpdatePropertyInput } from '../property.types'
import { rise, stagger, useEntranceInitial } from '@/shared/motion'
import styles from './PropertyForm.module.css'

const PROPERTY_TYPES = ['apartment', 'house', 'villa', 'plot', 'commercial']
const BEDROOMS = ['1', '2', '3', '4', '5', '6']
const BATHROOMS = ['1', '2', '3', '4', '5']
const FURNISHING_OPTS = ['unfurnished', 'semi-furnished', 'furnished']
const PARKING_OPTS = ['none', 'open', 'covered', '1', '2']
const PARKING_LABELS: Record<string, string> = { '1': '1 car', '2': '2 cars' }

const AMENITY_OPTIONS = [
  'Gym', 'Swimming Pool', 'Lift', 'Security', 'Power Backup',
  'Clubhouse', 'Garden', 'Parking', 'CCTV', 'Intercom',
  'Fire Safety', 'Wifi', 'Rainwater Harvesting', 'Maintenance Staff',
]

interface PropertyFormProps {
  initialValues?: Partial<Property>
  onSubmit: (data: CreatePropertyInput | UpdatePropertyInput) => Promise<void>
  submitLabel?: string
  isLoading?: boolean
}

export function PropertyForm({
  initialValues,
  onSubmit,
  submitLabel = 'Save listing',
  isLoading = false,
}: PropertyFormProps) {
  const entranceInitial = useEntranceInitial()
  const [form, setForm] = useState({
    title: initialValues?.title ?? '',
    propertyType: initialValues?.propertyType ?? 'apartment',
    listingType: initialValues?.listingType ?? 'rent',
    price: initialValues?.price?.toString() ?? '',
    location: initialValues?.location ?? '',
    locality: initialValues?.locality ?? '',
    bedrooms: initialValues?.bedrooms?.toString() ?? '',
    bathrooms: initialValues?.bathrooms?.toString() ?? '',
    builtUpArea: initialValues?.builtUpArea?.toString() ?? '',
    carpetArea: initialValues?.carpetArea?.toString() ?? '',
    furnishing: initialValues?.furnishing ?? '',
    floor: initialValues?.floor ?? '',
    totalFloors: initialValues?.totalFloors?.toString() ?? '',
    parking: initialValues?.parking ?? '',
    amenities: initialValues?.amenities ?? [] as string[],
    description: initialValues?.description ?? '',
  })
  const [error, setError] = useState('')
  const [titleError, setTitleError] = useState('')

  const isRent = form.listingType === 'rent'
  const suggestedTitle = suggestTitle(form.bedrooms, form.propertyType, form.locality)

  function set(key: keyof typeof form, value: string | string[]) {
    setForm((f) => ({ ...f, [key]: value }))
    setError('')
    if (key === 'title' || key === 'bedrooms' || key === 'locality') setTitleError('')
  }

  function toggleAmenity(amenity: string) {
    set(
      'amenities',
      form.amenities.includes(amenity)
        ? form.amenities.filter((a) => a !== amenity)
        : [...form.amenities, amenity],
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const title = form.title.trim() || suggestedTitle
    if (!title) { setTitleError('Add a title, or pick bedrooms or a locality and we’ll write one.'); return }

    const payload: CreatePropertyInput = {
      title,
      propertyType: form.propertyType,
      listingType: form.listingType as 'sale' | 'rent',
      ...(form.price && { price: Number(form.price) }),
      ...(form.location && { location: form.location.trim() }),
      ...(form.locality && { locality: form.locality.trim() }),
      ...(form.bedrooms && { bedrooms: Number(form.bedrooms) }),
      ...(form.bathrooms && { bathrooms: Number(form.bathrooms) }),
      ...(form.builtUpArea && { builtUpArea: Number(form.builtUpArea) }),
      ...(form.carpetArea && { carpetArea: Number(form.carpetArea) }),
      ...(form.furnishing && { furnishing: form.furnishing }),
      ...(form.floor && { floor: form.floor.trim() }),
      ...(form.totalFloors && { totalFloors: Number(form.totalFloors) }),
      ...(form.parking && { parking: form.parking }),
      amenities: form.amenities,
      ...(form.description && { description: form.description.trim() }),
    }

    try {
      await onSubmit(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  return (
    <motion.form className={styles.form} onSubmit={handleSubmit} noValidate variants={stagger(0.07, 0.15)} initial={entranceInitial} animate="show">
      <div className={styles.columns}>
        <div className={styles.column}>
          <Section className={styles.basics} icon={<FileText size={18} />} tint="mint" title="Basics">
            <div className={styles.toggle} role="group" aria-label="Listing type">
              {(['rent', 'sale'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={form.listingType === v}
                  className={`${styles.toggleBtn} ${form.listingType === v ? styles.toggleActive : ''}`}
                  onClick={() => set('listingType', v)}
                >
                  {v === 'sale' ? 'For sale' : 'For rent'}
                </button>
              ))}
            </div>
            <Choices
              label="Property type"
              options={PROPERTY_TYPES}
              value={form.propertyType}
              onChange={(v) => set('propertyType', v || form.propertyType)}
            />
            <Input
              label="Title"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder={suggestedTitle || 'e.g. Spacious 3BHK in Bandra West'}
              hint={!form.title && suggestedTitle ? 'Leave blank to use the suggested title.' : undefined}
              error={titleError}
            />
          </Section>

          <Section className={styles.location} icon={<MapPin size={18} />} tint="green" title={isRent ? 'Location and rent' : 'Location and price'}>
            <div className={styles.grid2}>
              <Input
                label="Locality"
                value={form.locality}
                onChange={(e) => set('locality', e.target.value)}
                placeholder="e.g. Bandra West"
              />
              <Input
                label={isRent ? 'Monthly rent (₹)' : 'Sale price (₹)'}
                type="number"
                inputMode="numeric"
                min={0}
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                placeholder={isRent ? 'e.g. 45000' : 'e.g. 8500000'}
                hint={formatPrice(form.price, isRent)}
              />
            </div>
            <Input
              label="Address"
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="e.g. 14 Sea View Apts, Carter Rd, Bandra West"
            />
          </Section>

          <Section className={styles.description} icon={<AlignLeft size={18} />} tint="mint" title="Description" meta="Optional">
            <textarea
              name="description"
              aria-label="Description"
              className={styles.textarea}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Highlights, nearby landmarks, condition…"
              rows={4}
            />
          </Section>
        </div>

        <div className={styles.column}>
          <Section className={styles.rooms} icon={<BedDouble size={18} />} tint="lavender" title="Rooms and area">
            <div className={styles.grid2}>
              <Choices label="Bedrooms" options={withValue(BEDROOMS, form.bedrooms)} value={form.bedrooms} onChange={(v) => set('bedrooms', v)} compact />
              <Choices label="Bathrooms" options={withValue(BATHROOMS, form.bathrooms)} value={form.bathrooms} onChange={(v) => set('bathrooms', v)} compact />
              <Input label="Built-up area (sq ft)" type="number" inputMode="numeric" min={0} value={form.builtUpArea} onChange={(e) => set('builtUpArea', e.target.value)} placeholder="1200" />
              <Input label="Carpet area (sq ft)" type="number" inputMode="numeric" min={0} value={form.carpetArea} onChange={(e) => set('carpetArea', e.target.value)} placeholder="950" />
              <Input label="Floor" value={form.floor} onChange={(e) => set('floor', e.target.value)} placeholder="e.g. 5" />
              <Input label="Total floors" type="number" inputMode="numeric" min={0} value={form.totalFloors} onChange={(e) => set('totalFloors', e.target.value)} placeholder="12" />
            </div>
            <Choices label="Furnishing" options={withValue(FURNISHING_OPTS, form.furnishing)} value={form.furnishing} onChange={(v) => set('furnishing', v)} />
            <Choices
              label="Parking"
              options={withValue(PARKING_OPTS, form.parking)}
              value={form.parking}
              onChange={(v) => set('parking', v)}
              format={(o) => PARKING_LABELS[o] ?? capitalize(o)}
            />
          </Section>

          <Section
            className={styles.amenitiesSection}
            icon={<ListChecks size={18} />}
            tint="peach"
            title="Amenities"
            meta={form.amenities.length ? `${form.amenities.length} selected` : 'Tap all that apply'}
          >
            <div className={styles.chips} role="group" aria-label="Amenities">
              {AMENITY_OPTIONS.map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-pressed={form.amenities.includes(a)}
                  className={`${styles.chip} ${form.amenities.includes(a) ? styles.chipActive : ''}`}
                  onClick={() => toggleAmenity(a)}
                >
                  {a}
                </button>
              ))}
            </div>
          </Section>
        </div>
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}

      <div className={styles.actions}>
        <Button type="submit" variant="primary" loading={isLoading}>
          {submitLabel}
        </Button>
      </div>
    </motion.form>
  )
}

interface SectionProps {
  icon: ReactNode
  tint: 'mint' | 'green' | 'lavender' | 'peach'
  title: string
  meta?: string
  className?: string
  children: ReactNode
}

function Section({ icon, tint, title, meta, className = '', children }: SectionProps) {
  const id = useId()
  return (
    <motion.section className={`${styles.section} ${className}`} variants={rise} aria-labelledby={id}>
      <div className={styles.sectionHead}>
        <span className={`${styles.sectionIcon} ${styles[`tint_${tint}`]}`} aria-hidden="true">{icon}</span>
        <h2 className={styles.sectionTitle} id={id}>{title}</h2>
        {meta && <span className={styles.sectionMeta}>{meta}</span>}
      </div>
      {children}
    </motion.section>
  )
}

interface ChoicesProps {
  label: string
  options: string[]
  value: string
  /** Called with '' when the selected option is tapped again. */
  onChange: (value: string) => void
  format?: (option: string) => string
  compact?: boolean
}

function Choices({ label, options, value, onChange, format = capitalize, compact = false }: ChoicesProps) {
  const id = useId()
  return (
    <div className={styles.field}>
      <span className={styles.label} id={id}>{label}</span>
      <div className={styles.chips} role="group" aria-labelledby={id}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={value === o}
            className={`${styles.chip} ${compact ? styles.chipSquare : ''} ${value === o ? styles.chipActive : ''}`}
            onClick={() => onChange(value === o ? '' : o)}
          >
            {format(o)}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Keeps a saved value selectable even when it isn't one of the quick options. */
function withValue(options: string[], value: string) {
  return value && !options.includes(value) ? [...options, value] : options
}

function suggestTitle(bedrooms: string, propertyType: string, locality: string) {
  if (!bedrooms && !locality.trim()) return ''
  const type = capitalize(propertyType)
  const head = bedrooms && propertyType !== 'plot' && propertyType !== 'commercial' ? `${bedrooms}BHK ${type}` : type
  return locality.trim() ? `${head} in ${locality.trim()}` : head
}

function formatPrice(raw: string, isRent: boolean) {
  const n = Number(raw)
  if (!raw || !Number.isFinite(n) || n <= 0) return undefined
  let text = `₹${n.toLocaleString('en-IN')}`
  if (n >= 1e7) text = `₹${trim(n / 1e7)} crore`
  else if (n >= 1e5) text = `₹${trim(n / 1e5)} lakh`
  return isRent ? `${text} per month` : text
}

function trim(n: number) {
  return Number(n.toFixed(2)).toString()
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
