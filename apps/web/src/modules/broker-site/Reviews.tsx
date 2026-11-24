import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Star, Trash2 } from 'lucide-react'
import { propertyKeys } from '@/modules/properties/queryKeys'
import {
  REVIEW_COMMENT_MAX,
  REVIEW_NAME_MAX,
  ReviewError,
  reviewService,
  type Review,
  type ReviewSummary,
} from './ReviewService'
import styles from './Reviews.module.css'

export const reviewKey = (brokerId: string) => [...propertyKeys.all, 'reviews', brokerId] as const

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent']

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className={styles.stars} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} className={n <= Math.round(value) ? styles.on : styles.off} />
      ))}
    </span>
  )
}

const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

/** Reviews of an agent on their public page: the rating at a glance, what visitors wrote, and a form to add yours. */
export default function Reviews({ brokerId, isOwner }: { brokerId: string; isOwner: boolean }) {
  const { data, isLoading } = useQuery({ queryKey: reviewKey(brokerId), queryFn: () => reviewService.getReviews(brokerId) })
  const [open, setOpen] = useState(false)

  // null means reviews aren't switched on in this database yet: show nothing rather than a broken section.
  if (isLoading || !data) return null

  return (
    <section className={styles.section} aria-labelledby="reviews-title">
      <div className={styles.head}>
        <h2 id="reviews-title" className={styles.title}>Reviews</h2>
        {!isOwner && !open && (
          <button type="button" className={styles.writeBtn} onClick={() => setOpen(true)}>
            {data.mine ? 'Edit your review' : 'Write a review'}
          </button>
        )}
      </div>

      {data.count > 0 ? <Summary data={data} /> : (
        <p className={styles.none}>{isOwner ? 'No reviews yet. Share your page and ask clients to leave one.' : 'No reviews yet. Be the first to share your experience.'}</p>
      )}

      {open && !isOwner && <ReviewForm brokerId={brokerId} mine={data.mine} onDone={() => setOpen(false)} />}

      {data.reviews.length > 0 && (
        <ul className={styles.list}>
          {data.reviews.map((r) => <ReviewItem key={r.id} review={r} />)}
        </ul>
      )}
      {data.count > 0 && <p className={styles.note}>Reviews are from visitors to this page.</p>}
    </section>
  )
}

export function Summary({ data }: { data: ReviewSummary }) {
  return (
    <div className={styles.summary}>
      <div className={styles.score}>
        <span className={styles.avg}>{data.average?.toFixed(1)}</span>
        <Stars value={data.average ?? 0} size={18} />
        <span className={styles.count}>{data.count} {data.count === 1 ? 'review' : 'reviews'}</span>
      </div>
      <ul className={styles.bars} aria-label="Reviews by rating">
        {([5, 4, 3, 2, 1] as const).map((n) => (
          <li key={n}>
            <span className={styles.barLabel}>{n}</span>
            <span className={styles.track}><span className={styles.fill} style={{ width: `${(data.stars[n] / data.count) * 100}%` }} /></span>
            <span className={styles.barCount}>{data.stars[n]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ReviewItem({ review: r, onDelete, deleting }: { review: Review; onDelete?: () => void; deleting?: boolean }) {
  return (
    <li className={styles.item}>
      <div className={styles.itemHead}>
        <span className={styles.who}>{r.name ?? 'Visitor'}</span>
        <time className={styles.when} dateTime={r.createdAt}>{dateFormat.format(new Date(r.createdAt))}</time>
      </div>
      {onDelete && (
        <button type="button" className={styles.deleteBtn} disabled={deleting} onClick={onDelete} aria-label={`Delete review by ${r.name ?? 'Visitor'}`}>
          <Trash2 size={14} aria-hidden="true" />
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      )}
      <span role="img" aria-label={`${r.rating} out of 5 stars`}><Stars value={r.rating} /></span>
      {r.comment && <p className={styles.comment}>{r.comment}</p>}
    </li>
  )
}

function ReviewForm({ brokerId, mine, onDone }: { brokerId: string; mine: ReviewSummary['mine']; onDone: () => void }) {
  const queryClient = useQueryClient()
  const [rating, setRating] = useState(mine?.rating ?? 0)
  const [comment, setComment] = useState(mine?.comment ?? '')
  const [name, setName] = useState(mine?.name ?? '')
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: () => reviewService.submit(brokerId, { rating, comment, name }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: reviewKey(brokerId) })
      onDone()
    },
    onError: (e) => setError(e instanceof ReviewError ? e.message : 'We couldn’t save your review. Check your connection and try again.'),
  })

  useEffect(() => { if (rating || name.trim()) setError(null) }, [rating, name])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!rating) return setError('Pick a star rating first.')
    if (!name.trim()) return setError('Please enter your name.')
    save.mutate()
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <fieldset className={styles.pick}>
        <legend>Your rating</legend>
        <div className={styles.pickRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={styles.pickBtn}
              aria-label={`${n} star${n > 1 ? 's' : ''}, ${LABELS[n]}`}
              aria-pressed={rating === n}
              onClick={() => setRating(n)}
            >
              <Star size={30} className={n <= rating ? styles.on : styles.off} />
            </button>
          ))}
          {rating > 0 && <span className={styles.pickLabel}>{LABELS[rating]}</span>}
        </div>
      </fieldset>

      <label className={styles.field}>
        <span>Your name</span>
        <input value={name} maxLength={REVIEW_NAME_MAX} required onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </label>
      <label className={styles.field}>
        <span>Your experience <em>(optional)</em></span>
        <textarea value={comment} maxLength={REVIEW_COMMENT_MAX} rows={4} onChange={(e) => setComment(e.target.value)} />
        <small>{comment.length}/{REVIEW_COMMENT_MAX}</small>
      </label>

      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}>
        <button type="submit" className={styles.submit} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : mine ? 'Update review' : 'Post review'}
        </button>
        <button type="button" className={styles.cancel} onClick={onDone}>Cancel</button>
      </div>
    </form>
  )
}
