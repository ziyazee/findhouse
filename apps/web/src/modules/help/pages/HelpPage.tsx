import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BookOpen, Camera, ChevronDown, CircleCheck, ClipboardList, MessageCircle, Send } from 'lucide-react'
import { Badge } from '@/shared/components/Badge'
import { Card, CardHeader, } from '@/shared/components/Card'
import { Item, Reveal } from '@/shared/components/Motion'
import { PageHero } from '@/shared/components/PageHero/PageHero'
import { heroBody } from '@/shared/components/PageHero/heroClasses'
import { LISTING_STATUSES, STATUS_META } from '@/modules/properties/listingStatus'
import styles from './HelpPage.module.css'

const STEPS = [
  { icon: <Camera size={18} />, title: 'Send photos and details', text: 'From your registered number, send photos, videos and a message with the rent, area and rooms.' },
  { icon: <Send size={18} />, title: 'Reply “done”', text: 'This tells FindHouse the property is complete. Anything sent before it belongs to the same property.' },
  { icon: <ClipboardList size={18} />, title: 'FindHouse builds the listing', text: 'Details are read from your message and photos are sorted by room.' },
  { icon: <CircleCheck size={18} />, title: 'Review and share', text: 'The property appears in My properties with its own public page. Check the details, then share the link.' },
]

const FAQ = [
  {
    q: 'Why is my property marked Draft?',
    a: 'A property is a draft until it has a rent (or price) and at least one photo. Open it, add what’s missing, and it becomes Active automatically.',
  },
  {
    q: 'A WhatsApp submission shows “Failed”. What now?',
    a: 'Usually the message had no usable details or the photos couldn’t be downloaded. Send the property again and reply “done”, or add it manually with Add property.',
  },
  {
    q: 'Does deleting a property delete my WhatsApp messages?',
    a: 'No. The property, its details and photos are removed, but the original WhatsApp messages stay on record.',
  },
  {
    q: 'Who can see the public page?',
    a: 'Anyone with the link can open it. Share it only with the people you want to see the property.',
  },
]

export default function HelpPage() {
  const { hash } = useLocation()

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash])

  return (
    <>
      <PageHero title="Help & support" subtitle="How FindHouse works and answers to common questions." />

      <Reveal className={`${styles.stack} ${heroBody}`} gap={0.09} delay={0.2}>
        <Item>
          <Card>
            <div id="whatsapp" className={styles.anchor} />
            <CardHeader title="List a property from WhatsApp" description="The fastest way to add a property from your phone." />
            <ol className={styles.steps}>
              {STEPS.map((s, i) => (
                <li key={s.title} className={styles.step}>
                  <span className={styles.stepIcon} aria-hidden="true">{s.icon}</span>
                  <div>
                    <p className={styles.stepTitle}><span className={styles.stepNum}>{i + 1}.</span> {s.title}</p>
                    <p className={styles.stepText}>{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </Item>

        <Item>
          <Card>
            <CardHeader title="What the statuses mean" />
            <ul className={styles.statuses}>
              {LISTING_STATUSES.map((s) => (
                <li key={s}>
                  <Badge variant={STATUS_META[s].variant} dot>{STATUS_META[s].label}</Badge>
                  <span>{STATUS_META[s].hint}.</span>
                </li>
              ))}
            </ul>
          </Card>
        </Item>

        <Item>
          <Card>
            <CardHeader title="Frequently asked questions" />
            <div className={styles.faq}>
              {FAQ.map((f) => (
                <details key={f.q} className={styles.faqItem}>
                  <summary>
                    {f.q}
                    <ChevronDown size={16} aria-hidden="true" className={styles.faqChevron} />
                  </summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </Card>
        </Item>

        <Item>
          <Card padded>
            <div className={styles.contact}>
              <span className={styles.stepIcon} aria-hidden="true"><BookOpen size={18} /></span>
              <div className={styles.contactText}>
                <p className={styles.stepTitle}>Broker booklet</p>
                <p className={styles.stepText}>A step-by-step guide to listing, sharing and managing your properties. Save it as a PDF to keep.</p>
              </div>
              <a href="/booklet" target="_blank" rel="noopener" className={styles.contactLink}>Open booklet</a>
            </div>
          </Card>
        </Item>

        <Item>
          <Card padded>
            <div className={styles.contact}>
              <span className={styles.stepIcon} aria-hidden="true"><MessageCircle size={18} /></span>
              <div className={styles.contactText}>
                <p className={styles.stepTitle}>Pipeline monitor</p>
                <p className={styles.stepText}>See each WhatsApp submission as it’s collected, processed and turned into a listing.</p>
              </div>
              <Link to="/test/pipeline" className={styles.contactLink}>Open monitor</Link>
            </div>
          </Card>
        </Item>
      </Reveal>
    </>
  )
}
