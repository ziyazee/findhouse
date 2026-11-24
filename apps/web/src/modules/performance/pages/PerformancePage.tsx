import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChartColumn, Eye, MessageCircle, Share2, TrendingUp, TriangleAlert } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/shared/components/Button'
import { Card, CardHeader, EmptyState, Skeleton } from '@/shared/components/Card'
import { Item, Reveal } from '@/shared/components/Motion'
import { PageHero } from '@/shared/components/PageHero/PageHero'
import { heroBody } from '@/shared/components/PageHero/heroClasses'
import { pop, stagger, useEntranceInitial } from '@/shared/motion'
import { useProperties } from '@/modules/properties/hooks/useProperties'
import { enquiryRate, perDay, perProperty, totalsOf } from '../metrics'
import { usePerformanceStats } from '../usePerformanceStats'
import styles from './PerformancePage.module.css'

const RANGES = [7, 30, 90] as const

const percent = (r: number | null) => (r === null ? '—' : `${(r * 100).toFixed(r < 0.1 ? 1 : 0)}%`)

export default function PerformancePage() {
  const entranceInitial = useEntranceInitial()
  const [days, setDays] = useState<(typeof RANGES)[number]>(30)
  const stats = usePerformanceStats(days)
  const props = useProperties()

  const rows = useMemo(() => stats.data ?? [], [stats.data])
  const properties = useMemo(() => props.data ?? [], [props.data])
  const totals = useMemo(() => totalsOf(rows), [rows])
  const daily = useMemo(() => perDay(rows, days), [rows, days])
  const ranked = useMemo(() => perProperty(rows, properties), [rows, properties])

  const isLoading = stats.isLoading || props.isLoading
  const isError = stats.isError || props.isError
  const maxDay = Math.max(1, ...daily.map((d) => d.views))
  const maxViews = Math.max(1, ...ranked.map((p) => p.views))
  const showData = !isError && (isLoading || properties.length > 0)
  const range = `Last ${days} days`

  return (
    <>
      <PageHero
        overlap={showData}
        title="Performance"
        subtitle="How people respond to your listings: views, shares and enquiries."
      />

      {isError ? (
        <Card className={heroBody}>
          <EmptyState
            icon={<TriangleAlert size={20} />}
            title="Couldn’t load performance"
            description="Check your connection and try again."
            action={<Button variant="secondary" onClick={() => { void stats.refetch(); void props.refetch() }}>Try again</Button>}
          />
        </Card>
      ) : !showData ? (
        <Card className={heroBody}>
          <EmptyState
            icon={<ChartColumn size={20} />}
            title="No data yet"
            description="Once you add properties and share their links, views and enquiries will appear here."
          />
        </Card>
      ) : (
        <>
          <motion.section className={styles.kpis} aria-label="Key figures" variants={stagger(0.08, 0.15)} initial={entranceInitial} animate="show">
            <Kpi tint="mint" icon={<Eye size={18} />} label="Views" value={String(totals.views)} sub="Times a listing page was opened" loading={isLoading} />
            <Kpi tint="lavender" icon={<Share2 size={18} />} label="Shares" value={String(totals.shares)} sub="Times a link was shared" loading={isLoading} />
            <Kpi tint="green" icon={<MessageCircle size={18} />} label="Enquiries" value={String(totals.enquiries)} sub={`${totals.whatsapp} WhatsApp · ${totals.calls} calls`} loading={isLoading} />
            <Kpi tint="peach" icon={<TrendingUp size={18} />} label="Enquiry rate" value={percent(enquiryRate(totals))} sub="Enquiries per view" loading={isLoading} />
          </motion.section>

          <Reveal className={`${styles.grid} ${entranceInitial === false ? styles.still : ''}`} gap={0.1} delay={0.35}>
            <Item className={styles.wide}>
              <Card>
                <CardHeader
                  title="Views per day"
                  description={range}
                  action={
                    <div className={styles.range} role="group" aria-label="Period">
                      {RANGES.map((r) => (
                        <button key={r} type="button" aria-pressed={days === r} onClick={() => setDays(r)}>{r}d</button>
                      ))}
                    </div>
                  }
                />
                <div className={styles.cardBody}>
                  {isLoading ? <Skeleton height={140} /> : totals.views === 0 && totals.enquiries === 0 ? (
                    <p className={styles.muted}>No activity in this period yet. Share a listing link to get started.</p>
                  ) : (
                    <>
                      <ol className={styles.days} style={{ gridTemplateColumns: `repeat(${daily.length}, minmax(0, 1fr))` }}>
                        {daily.map((d, i) => (
                          <li key={d.key} title={`${d.label}: ${d.views} views, ${d.enquiries} enquiries`}>
                            <span className={styles.dayTrack}>
                              <span className={styles.dayBar} style={{ height: `${(d.views / maxDay) * 100}%` }} />
                            </span>
                            <span className={styles.dayLabel}>{i % Math.ceil(daily.length / 6) === 0 ? d.label : ''}</span>
                          </li>
                        ))}
                      </ol>
                    </>
                  )}
                </div>
              </Card>
            </Item>

            <Item className={styles.wide}>
              <Card>
                <CardHeader title="By property" description={`${range}, most enquiries first`} />
                <div className={styles.cardBody}>
                  {ranked.length === 0 ? (
                    <p className={styles.muted}>No properties yet.</p>
                  ) : (
                    <ul className={styles.rank}>
                      <li className={styles.rankHead} aria-hidden="true">
                        <span>Property</span><span>Views</span><span>Shares</span><span>Enquiries</span>
                      </li>
                      {ranked.map((p) => (
                        <li key={p.id}>
                          <span className={styles.rankTitle}>
                            <Link to={`/properties/${p.id}`}>{p.title}</Link>
                            <span className={styles.rankTrack}><span className={styles.rankBar} style={{ width: `${(p.views / maxViews) * 100}%` }} /></span>
                          </span>
                          <span className={styles.num} data-label="Views">{p.views}</span>
                          <span className={styles.num} data-label="Shares">{p.shares}</span>
                          <span className={`${styles.num} ${styles.strong}`} data-label="Enquiries">{p.enquiries}</span>
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
