import { motion } from 'framer-motion'
import { useId, useRef, useState, type ReactNode } from 'react'
import { AlignLeft, ArrowLeft, BedDouble, CalendarCheck, FileText, ListChecks, MapPin, Plus, X } from 'lucide-react'
import { Input } from '@/shared/components/Input'
import { Button } from '@/shared/components/Button'
import { AddDetailSheet } from './AddDetailSheet'
import { capitalize } from '@/shared/format'
import type { CreatePropertyInput, Property } from '../property.types'
import {
  extrasProblem, maintenanceHint, priceHint, suggestTitle, toFormState, toPropertyInput, type ExtraRow, type PropertyFormState,
} from '../propertyFormModel'
import {
  AMENITY_OPTIONS, BALCONIES, BATHROOMS, BEDROOMS, FURNISHING_OPTIONS, PARKING_LABELS, PARKING_OPTIONS, PROPERTY_TYPES,
} from '../propertyOptions'
import { rise, stagger, useEntranceInitial } from '@/shared/motion'
import styles from './PropertyForm.module.css'

interface PropertyFormProps {
  initialValues?: Partial<Property>
  onSubmit: (data: CreatePropertyInput) => Promise<void>
  submitLabel?: string
  isLoading?: boolean
  /** Shows a back button beside the submit button on phones, where the page has no other way back. */
  onBack?: () => void
}

export function PropertyForm({
  initialValues,
  onSubmit,
  submitLabel = 'Save listing',
  isLoading = false,
  onBack,
}: PropertyFormProps) {
  const entranceInitial = useEntranceInitial()
  const [form, setForm] = useState(() => toFormState(initialValues))
  const [error, setError] = useState('')
  const [titleError, setTitleError] = useState('')
  const nextExtraId = useRef(0)
  const [addingExtra, setAddingExtra] = useState(false)

  const isRent = form.listingType === 'rent'
  const maintenanceIncluded = /^includ/i.test(form.maintenance.trim())
  const suggestedTitle = suggestTitle(form.bedrooms, form.propertyType, form.locality)

  function set<K extends keyof PropertyFormState>(key: K, value: PropertyFormState[K]) {
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

  function setExtra(id: string, patch: Partial<ExtraRow>) {
    set('extras', form.extras.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function addExtra(label: string, value: string) {
    const id = `new-${++nextExtraId.current}`
    set('extras', [...form.extras, { id, label, value }])
    setAddingExtra(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const title = form.title.trim() || suggestedTitle
    if (!title) { setTitleError('Add a title, or pick bedrooms and we’ll write one.'); return }
    const problem = extrasProblem(form.extras)
    if (problem) { setError(problem); return }

    try {
      await onSubmit(toPropertyInput(form, title))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  return (
    <motion.form className={styles.form} onSubmit={handleSubmit} noValidate variants={stagger(0.07, 0.15)} initial={entranceInitial} animate="show">
      <div className={styles.columns}>
        <div className={styles.column}>
          <Section
            className={styles.basics}
            icon={<FileText size={18} />}
            tint="mint"
            title="Basics"
            meta={
              <div className={`${styles.toggle} ${styles.toggleCompact}`} role="group" aria-label="Listing type">
                {(['rent', 'sale'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={form.listingType === v}
                    className={`${styles.toggleBtn} ${form.listingType === v ? styles.toggleActive : ''}`}
                    onClick={() => set('listingType', v)}
                  >
                    {form.listingType === v && (
                      <motion.span layoutId="listing-type-pill" className={styles.togglePill} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
                    )}
                    <span className={styles.toggleLabel}>{v === 'sale' ? 'For sale' : 'For rent'}</span>
                  </button>
                ))}
              </div>
            }
          >
            <Choices
              label="Property type"
              options={PROPERTY_TYPES}
              oneLine
              value={form.propertyType}
              onChange={(v) => set('propertyType', v || form.propertyType)}
            />
            <div className={styles.field}>
              <label className={styles.label} htmlFor="property-title">Title</label>
              <textarea
                id="property-title"
                name="title"
                className={`${styles.textarea} ${styles.titleArea}`}
                rows={2}
                value={form.title}
                onChange={(e) => set('title', e.target.value.replace(/\n/g, ' '))}
                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
                placeholder={suggestedTitle || 'e.g. Spacious 3BHK in Bandra West'}
                aria-invalid={!!titleError}
                aria-describedby="property-title-note"
              />
              {titleError && <p id="property-title-note" className={styles.titleError} role="alert">{titleError}</p>}
              {!titleError && !form.title && suggestedTitle && <p id="property-title-note" className={styles.titleHint}>Leave blank to use the suggested title.</p>}
            </div>
          </Section>

          <Section className={styles.location} icon={<MapPin size={18} />} tint="green" title={isRent ? 'Location and rent' : 'Location and price'}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="property-address">Address</label>
              <textarea
                id="property-address"
                name="address"
                className={`${styles.textarea} ${styles.titleArea}`}
                rows={2}
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                placeholder="e.g. 14 Sea View Apts, Carter Rd, Bandra West"
              />
            </div>
            <div className={styles.grid2}>
              <Input
                label={isRent ? 'Monthly rent (₹)' : 'Sale price (₹)'}
                type="number"
                inputMode="numeric"
                min={0}
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                placeholder={isRent ? 'e.g. 45000' : 'e.g. 8500000'}
              />
              <Input
                label="Security deposit (₹)"
                type="number"
                inputMode="numeric"
                min={0}
                value={form.deposit}
                onChange={(e) => set('deposit', e.target.value)}
                placeholder={isRent ? 'e.g. 135000' : 'e.g. 500000'}
                hint={priceHint(form.deposit, false)}
              />
              <div className={styles.maintenanceField}>
                <Input
                  label="Maintenance (₹/month)"
                  value={form.maintenance}
                  onChange={(e) => set('maintenance', e.target.value)}
                  placeholder="e.g. 3500, or Included"
                  hint={maintenanceHint(form.maintenance)}
                />
                <button
                  type="button"
                  aria-pressed={maintenanceIncluded}
                  className={`${styles.chip} ${styles.includedTag} ${maintenanceIncluded ? styles.chipActive : ''}`}
                  onClick={() => set('maintenance', maintenanceIncluded ? '' : 'Included in rent')}
                >
                  Included
                </button>
              </div>
              <Input
                label={isRent ? 'Move-in' : 'Possession'}
                value={form.moveInDate}
                onChange={(e) => set('moveInDate', e.target.value)}
                placeholder="e.g. Immediate, or 1st January"
              />
            </div>
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
          <Section className={styles.rooms} icon={<BedDouble size={18} />} tint="lavender" title="Property details">
            <Choices label="Furnishing" options={withValue(FURNISHING_OPTIONS, form.furnishing)} value={form.furnishing} onChange={(v) => set('furnishing', v)} />
            <div className={styles.grid2}>
              <Input label="Floor" value={form.floor} onChange={(e) => set('floor', e.target.value)} placeholder="e.g. 5" />
              <Input label="Total floors" type="number" inputMode="numeric" min={0} value={form.totalFloors} onChange={(e) => set('totalFloors', e.target.value)} placeholder="12" />
            </div>
            <div className={styles.grid2}>
              <Choices label="Bedrooms" options={withValue(BEDROOMS, form.bedrooms)} value={form.bedrooms} onChange={(v) => set('bedrooms', v)} compact />
              <Choices label="Bathrooms" options={withValue(BATHROOMS, form.bathrooms)} value={form.bathrooms} onChange={(v) => set('bathrooms', v)} compact />
            </div>
            <Choices label="Balconies" options={withValue(BALCONIES, form.balconies)} value={form.balconies} onChange={(v) => set('balconies', v)} compact />
            <Choices
              label="Parking"
              options={withValue(PARKING_OPTIONS, form.parking)}
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

          <Section className={styles.more} icon={<CalendarCheck size={18} />} tint="green" title="Area and other details" meta="Optional">
            <div className={styles.grid2}>
              <Input label="Built-up area (sq ft)" type="number" inputMode="numeric" min={0} value={form.builtUpArea} onChange={(e) => set('builtUpArea', e.target.value)} placeholder="1200" />
              <Input label="Carpet area (sq ft)" type="number" inputMode="numeric" min={0} value={form.carpetArea} onChange={(e) => set('carpetArea', e.target.value)} placeholder="950" />
            </div>
            <div className={styles.field}>
              <span className={styles.label}>Other details</span>
              {form.extras.length > 0 && (
                <ul className={styles.extras}>
                  {form.extras.map((row) => (
                    <li key={row.id} className={styles.extra}>
                      <input
                        id={`${row.id}-label`}
                        aria-label="Detail name"
                        value={row.label}
                        onChange={(e) => setExtra(row.id, { label: e.target.value })}
                        placeholder="e.g. Facing"
                      />
                      <input
                        aria-label={row.label ? `${row.label} value` : 'Detail value'}
                        value={row.value}
                        onChange={(e) => setExtra(row.id, { value: e.target.value })}
                        placeholder="e.g. East"
                      />
                      <button
                        type="button"
                        className={styles.extraRemove}
                        aria-label={row.label ? `Remove ${row.label}` : 'Remove this detail'}
                        onClick={() => set('extras', form.extras.filter((r) => r.id !== row.id))}
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className={styles.extraAdd} onClick={() => setAddingExtra(true)}>
                <Plus size={16} aria-hidden="true" />
                Add a detail
              </button>
            </div>
          </Section>
        </div>
      </div>

      <AddDetailSheet open={addingExtra} onAdd={addExtra} onClose={() => setAddingExtra(false)} />

      {error && <p className={styles.error} role="alert">{error}</p>}

      <div className={styles.actions}>
        {onBack && (
          <Button type="button" variant="secondary" className={styles.back} onClick={onBack} aria-label="Back">
            <ArrowLeft size={20} aria-hidden="true" />
          </Button>
        )}
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
  meta?: ReactNode
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
  /** Keeps every option on one line on phones. */
  oneLine?: boolean
}

function Choices({ label, options, value, onChange, format = capitalize, compact = false, oneLine = false }: ChoicesProps) {
  const id = useId()
  return (
    <div className={styles.field}>
      <span className={styles.label} id={id}>{label}</span>
      <div className={`${styles.chips} ${oneLine ? styles.chipsOneLine : ''}`} role="group" aria-labelledby={id}>
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
