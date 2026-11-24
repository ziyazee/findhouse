import { supabase } from '@/lib/supabase'

export interface Review {
  id: number
  rating: number
  comment: string | null
  name: string | null
  createdAt: string
}

export interface ReviewSummary {
  count: number
  /** One decimal, e.g. 4.6; null when there are no reviews. */
  average: number | null
  /** How many reviews gave each star, 1 to 5. */
  stars: Record<1 | 2 | 3 | 4 | 5, number>
  reviews: Review[]
  /** This browser's own earlier review, if any. */
  mine: { rating: number; comment: string | null; name: string | null } | null
}

export interface ReviewInput {
  rating: number
  comment: string
  name: string
}

export const REVIEW_COMMENT_MAX = 600
export const REVIEW_NAME_MAX = 60

/** A reason the review was refused, in words for the visitor. */
export class ReviewError extends Error {}

const BAD_VALUE = '22023'
const FUNCTION_MISSING = 'PGRST202'

const REFUSALS: Record<string, string> = {
  rating: 'Pick a star rating from 1 to 5.',
  name: 'Please enter your name.',
  too_long: 'That’s a bit long. Please shorten it.',
  not_found: 'This agent can’t be reviewed right now.',
  own_page: 'You can’t review your own page.',
}

const DEVICE_KEY = 'findhouse.reviewer'

/** A random id kept in this browser, so one visitor leaves one review per agent (sending again edits it). */
export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    return crypto.randomUUID() // storage blocked: the review still goes through, it just can't be edited later
  }
}

interface RawSummary {
  count: number
  average: number | null
  stars: Record<string, number>
  reviews: { id: number; rating: number; comment: string | null; name: string | null; created_at: string }[] | null
  mine: { rating: number; comment: string | null; name: string | null } | null
}

export interface IReviewService {
  /** Null when reviews aren't available (no such agent, or migration 021 isn't run yet). */
  getReviews(brokerId: string): Promise<ReviewSummary | null>
  submit(brokerId: string, input: ReviewInput): Promise<void>
  /** The signed-in broker deletes a review on their own page. */
  remove(reviewId: number): Promise<void>
}

class SupabaseReviewService implements IReviewService {
  async getReviews(brokerId: string): Promise<ReviewSummary | null> {
    const { data, error } = await supabase.rpc('get_broker_reviews', { page_broker_id: brokerId, device: deviceId() })
    if (error?.code === FUNCTION_MISSING) return null
    if (error) throw new Error(error.message)
    if (!data) return null
    const raw = data as RawSummary
    return {
      count: raw.count,
      average: raw.average,
      stars: { 1: raw.stars['1'] ?? 0, 2: raw.stars['2'] ?? 0, 3: raw.stars['3'] ?? 0, 4: raw.stars['4'] ?? 0, 5: raw.stars['5'] ?? 0 },
      reviews: (raw.reviews ?? []).map((r) => ({ id: r.id, rating: r.rating, comment: r.comment, name: r.name, createdAt: r.created_at })),
      mine: raw.mine,
    }
  }

  async submit(brokerId: string, input: ReviewInput): Promise<void> {
    const { error } = await supabase.rpc('submit_broker_review', {
      page_broker_id: brokerId,
      device: deviceId(),
      stars: input.rating,
      review_comment: input.comment.trim() || null,
      reviewer_name: input.name.trim() || null,
    })
    if (error?.code === BAD_VALUE) throw new ReviewError(REFUSALS[error.message] ?? 'We couldn’t save your review. Please try again.')
    if (error) throw new Error(error.message)
  }

  async remove(reviewId: number): Promise<void> {
    const { error } = await supabase.rpc('delete_my_broker_review', { review_id: reviewId })
    if (error) throw new Error(error.message)
  }
}

export const reviewService: IReviewService = new SupabaseReviewService()
