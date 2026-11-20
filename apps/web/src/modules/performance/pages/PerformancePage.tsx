import { useMemo, type ReactNode } from 'react'
import { ChartColumn, IndianRupee, KeyRound, MessageCircle, TriangleAlert, Wallet } from 'lucide-react'
import { Button } from '@/shared/components/Button'
import { Card, CardHeader, EmptyState, Skeleton } from '@/shared/components/Card'
import { motion } from 'framer-motion'
import { Item, Reveal } from '@/shared/components/Motion'
import { PageHero } from '@/shared/components/PageHero/PageHero'
import { pop, stagger, useEntranceInitial } from '@/shared/motion'
import { heroBody } from '@/shared/components/PageHero/heroClasses'
import { inr } from '@/shared/format'
import { useDashboardData } from '@/modules/dashboard/hooks/useDashboardData'
import { LISTING_STATUSES, STATUS_META } from '@/modules/properties/listingStatus'
import { addedByMonth, rentByArea, submissionSuccess } from '../metrics'
import styles from './PerformancePage.module.css'

export default function PerformancePage() {
  const entranceInitial = useEntranceInitial()
  const { isLoading, isError, refetch, summary, intake, properties } = useDashboardData()

  const byArea = useMemo(() => rentByArea(properties), [properties])
  const months = useMemo(() => addedByMonth(properties), [properties])
  const { finished, rate: success } = submissionSuccess(intake)
  const maxMonth = Math.max(1, ...months.map((m) => m.count))
  const maxArea = Math.max(1, ...byArea.map((a) => a.avg))
  const showData = !isError && (isLoading || properties.length > 0)

  return (
    <>
      <PageHero
        overlap={showData}
        title="Performance"
        subtitle="How your portfolio is doing, based on your current properties."
      />

      {isError ? (
        <Card className={heroBody}>
          <EmptyState
            icon={<TriangleAlert size={20} />}
            title="Couldn’t load performance"
            description="Check your connection and try again."
            action={<Button variant="secondary" onClick={() => refetch()}>Try again</Button>}
          />
        </Card>
      ) : !showData ? (
        <Card className={heroBody}>
          <EmptyState
            icon={<ChartColumn size={20} />}
            title="No data yet"
            description="Once you add properties, occupancy and rent figures will appear here."
          />
        </Card>
      ) : (
        <>
          <motion.section className={styles.kpis} aria-label="Key figures" variants={stagger(0.08, 0.15)} initial={entranceInitial} animate="show">
            <Kpi tint="mint" icon={<KeyRound size={18} />} label="Occupancy" value={`${Math.round(summary.occupancy * 100)}%`} sub="Rentals with a tenant" loading={isLoading} />
            <Kpi tint="green" icon={<IndianRupee size={18} />} label="Monthly rent, rented units" value={inr(summary.rentRoll)} sub={`${summary.byStatus.rented} rented`} loading={isLoading} />
            <Kpi tint="lavender" icon={<Wallet size={18} />} label="Average asking rent" value={summary.avgRent ? inr(summary.avgRent) : '—'} sub="Across rentals with a price" loading={isLoading} />
            <Kpi
              tint="peach"
              icon={<MessageCircle size={18} />}
              label="WhatsApp success rate"
              value={success === null ? '—' : `${Math.round(success * 100)}%`}
              sub={`${finished} recent submissions`}
              loading={isLoading}
            />
          </motion.section>

          <Reveal className={`${styles.grid} ${entranceInitial === false ? styles.still : ''}`} gap={0.1} delay={0.35}>
            <Item>
              <Card>
                <CardHeader title="Properties by status" description={`${summary.total} in total`} />
                <div className={styles.cardBody}>
                  {isLoading ? <Skeleton height={12} radius={999} /> : (
                    <div className={styles.stack} role="img" aria-label={LISTING_STATUSES.map((s) => `${STATUS_META[s].label} ${summary.byStatus[s]}`).join(', ')}>
                      {LISTING_STATUSES.map((s) => summary.byStatus[s] > 0 && (
                        <span key={s} className={styles[`seg_${s}`]} style={{ flexGrow: summary.byStatus[s] }} />
                      ))}
                    </div>
                  )}
                  <ul className={styles.legend}>
                    {LISTING_STATUSES.map((s) => (
                      <li key={s}>
                        <span className={`${styles.swatch} ${styles[`seg_${s}`]}`} aria-hidden="true" />
                        <span className={styles.legendLabel}>{STATUS_META[s].label}</span>
                        <span className={styles.legendValue}>{isLoading ? '–' : summary.byStatus[s]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            </Item>

            <Item>
              <Card>
                <CardHeader title="Added per month" description="Last 6 months" />
                <div className={styles.cardBody}>
                  <ol className={styles.columns}>
                    {months.map((m) => (
                      <li key={m.key}>
                        <span className={styles.colValue}>{m.count}</span>
                        <span className={styles.colTrack}>
                          <span className={styles.colBar} style={{ height: `${(m.count / maxMonth) * 100}%` }} />
                        </span>
                        <span className={styles.colLabel}>{m.label}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </Card>
            </Item>

            <Item className={styles.wide}>
              <Card>
                <CardHeader title="Average rent by area" description="Rentals with a price, top 6 areas" />
                <div className={styles.cardBody}>
                  {byArea.length === 0 ? (
                    <p className={styles.muted}>Add a locality and rent to your rentals to compare areas.</p>
                  ) : (
                    <ul className={styles.bars}>
                      {byArea.map((a) => (
                        <li key={a.area}>
                          <span className={styles.barLabel}>{a.area}<span className={styles.barCount}>{a.count}</span></span>
                          <span className={styles.barTrack}><span className={styles.bar} style={{ width: `${(a.avg / maxArea) * 100}%` }} /></span>
                          <span className={styles.barValue}>{inr(a.avg)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            </Item>
          </Reveal>
        </>
      )}
    </>
  )
}

function Kpi({ tint, icon, label, value, sub, loading }: {
  tint: 'mint' | 'green' | 'lavender' | 'peach'
  icon: ReactNode
  label: string
  value: string
  sub: string
  loading: boolean
}) {
  return (
    <motion.div className={`${styles.kpi} ${styles[`tint_${tint}`]}`} variants={pop}>
      <span className={styles.kpiHead}>
        <span className={styles.kpiLabel}>{label}</span>
        <span className={styles.kpiIcon} aria-hidden="true">{icon}</span>
      </span>
      {loading ? <Skeleton width={90} height={28} /> : <span className={styles.kpiValue}>{value}</span>}
      <span className={styles.kpiSub}>{sub}</span>
    </motion.div>
  )
}
