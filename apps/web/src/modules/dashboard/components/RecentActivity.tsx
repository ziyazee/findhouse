import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/modules/auth/useAuth'
import { StatusBadge } from '@/shared/components/Badge'
import styles from './RecentActivity.module.css'

interface RecentProperty {
  id: string
  title: string
  status: string
  listingType: string
  createdAt: string
}

export function RecentActivity() {
  const { user } = useAuth()
  const brokerId = user?.id ?? ''

  const { data: recent = [], isLoading } = useQuery({
    queryKey: ['recent-properties', brokerId],
    queryFn: async (): Promise<RecentProperty[]> => {
      const { data } = await supabase
        .from('properties')
        .select('id, title, status, listing_type, created_at')
        .eq('broker_id', brokerId)
        .order('created_at', { ascending: false })
        .limit(8)

      return (data ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        listingType: r.listing_type,
        createdAt: r.created_at,
      }))
    },
    enabled: !!brokerId,
    staleTime: 30_000,
  })

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h2 className={styles.title}>Recent Properties</h2>
        <Link to="/properties" className={styles.seeAll}>See all →</Link>
      </div>

      {isLoading ? (
        <div className={styles.loading}><div className="spinner" /></div>
      ) : recent.length === 0 ? (
        <p className={styles.empty}>No properties yet.</p>
      ) : (
        <ul className={styles.list}>
          {recent.map((p) => (
            <li key={p.id}>
              <Link to={`/properties/${p.id}`} className={styles.item}>
                <div className={styles.itemLeft}>
                  <span className={styles.itemTitle}>{p.title}</span>
                  <span className={styles.itemMeta}>
                    {p.listingType === 'sale' ? 'For Sale' : 'For Rent'} · {formatDate(p.createdAt)}
                  </span>
                </div>
                <StatusBadge status={p.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' })
}
