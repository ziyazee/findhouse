import { useState } from 'react'
import { Input } from '@/shared/components/Input'
import { Button } from '@/shared/components/Button'
import type { CreatePropertyInput, Property, UpdatePropertyInput } from '../property.types'
import styles from './PropertyForm.module.css'

const PROPERTY_TYPES = ['apartment', 'house', 'villa', 'plot', 'commercial']
const FURNISHING_OPTS = ['unfurnished', 'semi-furnished', 'furnished']
const PARKING_OPTS = ['none', 'open', 'covered', '1', '2']

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
  submitLabel = 'Save Property',
  isLoading = false,
}: PropertyFormProps) {
  const [form, setForm] = useState({
    title: initialValues?.title ?? '',
    propertyType: initialValues?.propertyType ?? 'apartment',
    listingType: initialValues?.listingType ?? 'sale',
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

  function set(key: keyof typeof form, value: string | string[]) {
    setForm((f) => ({ ...f, [key]: value }))
    setError('')
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
    if (!form.title.trim()) { setError('Title is required.'); return }

    const payload: CreatePropertyInput = {
      title: form.title.trim(),
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
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {/* Basic info */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Basic Information</h2>
        <div className={styles.grid2}>
          <div className={styles.span2}>
            <Input
              label="Title"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Spacious 3BHK in Bandra West"
              required
            />
          </div>
          <div>
            <label className={styles.label}>Property Type</label>
            <select className={styles.select} value={form.propertyType} onChange={(e) => set('propertyType', e.target.value)}>
              {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{capitalize(t)}</option>)}
            </select>
          </div>
          <div>
            <label className={styles.label}>Listing Type</label>
            <div className={styles.toggle}>
              {(['sale', 'rent'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`${styles.toggleBtn} ${form.listingType === v ? styles.toggleActive : ''}`}
                  onClick={() => set('listingType', v)}
                >
                  {v === 'sale' ? 'For Sale' : 'For Rent'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Location */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Location</h2>
        <div className={styles.grid2}>
          <div className={styles.span2}>
            <Input
              label="Full Address"
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="e.g. 14 Sea View Apts, Carter Rd, Bandra West, Mumbai"
            />
          </div>
          <Input
            label="Locality / Neighbourhood"
            value={form.locality}
            onChange={(e) => set('locality', e.target.value)}
            placeholder="e.g. Bandra West"
          />
          <Input
            label="Price (₹)"
            type="number"
            value={form.price}
            onChange={(e) => set('price', e.target.value)}
            placeholder="e.g. 8500000"
          />
        </div>
      </section>

      {/* Details */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Property Details</h2>
        <div className={styles.grid3}>
          <Input label="Bedrooms" type="number" value={form.bedrooms} onChange={(e) => set('bedrooms', e.target.value)} placeholder="3" />
          <Input label="Bathrooms" type="number" value={form.bathrooms} onChange={(e) => set('bathrooms', e.target.value)} placeholder="2" />
          <Input label="Built-up Area (sq ft)" type="number" value={form.builtUpArea} onChange={(e) => set('builtUpArea', e.target.value)} placeholder="1200" />
          <Input label="Carpet Area (sq ft)" type="number" value={form.carpetArea} onChange={(e) => set('carpetArea', e.target.value)} placeholder="950" />
          <Input label="Floor" value={form.floor} onChange={(e) => set('floor', e.target.value)} placeholder="e.g. 5" />
          <Input label="Total Floors" type="number" value={form.totalFloors} onChange={(e) => set('totalFloors', e.target.value)} placeholder="12" />
        </div>
        <div className={styles.grid2} style={{ marginTop: 12 }}>
          <div>
            <label className={styles.label}>Furnishing</label>
            <select className={styles.select} value={form.furnishing} onChange={(e) => set('furnishing', e.target.value)}>
              <option value="">Not specified</option>
              {FURNISHING_OPTS.map((o) => <option key={o} value={o}>{capitalize(o)}</option>)}
            </select>
          </div>
          <div>
            <label className={styles.label}>Parking</label>
            <select className={styles.select} value={form.parking} onChange={(e) => set('parking', e.target.value)}>
              <option value="">Not specified</option>
              {PARKING_OPTS.map((o) => <option key={o} value={o}>{capitalize(o)}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* Amenities */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Amenities</h2>
        <div className={styles.amenities}>
          {AMENITY_OPTIONS.map((a) => (
            <button
              key={a}
              type="button"
              className={`${styles.chip} ${form.amenities.includes(a) ? styles.chipActive : ''}`}
              onClick={() => toggleAmenity(a)}
            >
              {a}
            </button>
          ))}
        </div>
      </section>

      {/* Description */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Description</h2>
        <textarea
          className={styles.textarea}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Describe the property — highlights, nearby landmarks, condition…"
          rows={4}
        />
      </section>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <Button type="submit" variant="primary" size="lg" loading={isLoading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
