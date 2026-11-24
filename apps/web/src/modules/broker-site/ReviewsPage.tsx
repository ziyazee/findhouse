import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Star, TriangleAlert } from 'lucide-react'
import { Button } from '@/shared/components/Button'
import { Card, EmptyState } from '@/shared/components/Card'
import { Item, Reveal } from '@/shared/components/Motion'
import { PageHero } from '@/shared/components/PageHero/PageHero'
import { heroBody } from '@/shared/components/PageHero/heroClasses'
import { useAuth } from '@/modules/auth/useAuth'
import { reviewService } from './ReviewService'
import { ReviewItem, Summary, reviewKey } from './Reviews'
import styles from './Reviews.module.css'

/** The signed-in broker's own reviews, left by visitors on their public page. */
export default function ReviewsPage() {
  const { user } = useAuth()
  const brokerId = user?.id ?? ''
  const reviews = useQuery({
    queryKey: reviewKey(brokerId),
    queryFn: () => reviewService.getReviews(brokerId),
    enabled: !!brokerId,
  })
  const data = reviews.data

  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: (id: number) => reviewService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reviewKey(brokerId) }),
  })

  return (
    <>
      <PageHero title="Reviews" subtitle="What visitors say about you on your public page." />
      <Reveal className={heroBody} delay={0.2}>
        <Item>
          <Card>
            {reviews.isError ? (
              <EmptyState
                icon={<TriangleAlert size={20} />}
                title="Couldn’t load your reviews"
                description="Check your connection and try again."
                action={<Button variant="secondary" onClick={() => void reviews.refetch()}>Try again</Button>}
              />
            ) : reviews.isLoading ? (
              <p className={styles.none} aria-busy="true">Loading…</p>
            ) : !data ? (
              <EmptyState
                icon={<Star size={20} />}
                title="Reviews aren’t set up yet"
                description="Reviews are switched on once FindHouse finishes a database update. Check back soon."
              />
            ) : data.count === 0 ? (
              <EmptyState
                icon={<Star size={20} />}
                title="No reviews yet"
                description="Share your public page with clients and ask them to leave a review. They show here as soon as they’re posted."
              />
            ) : (
              <div className={styles.dash}>
                <Summary data={data} />
                <ul className={styles.list}>
                  {data.reviews.map((r) => (
                    <ReviewItem
                      key={r.id}
                      review={r}
                      deleting={remove.isPending && remove.variables === r.id}
                      onDelete={() => { if (window.confirm('Delete this review? This can’t be undone.')) remove.mutate(r.id) }}
                    />
                  ))}
                </ul>
                {remove.isError && <p className={styles.error} role="alert">Couldn’t delete that review. Try again.</p>}
              </div>
            )}
          </Card>
        </Item>
      </Reveal>
    </>
  )
}
