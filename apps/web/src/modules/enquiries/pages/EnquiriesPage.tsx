import { Link } from 'react-router-dom'
import { Inbox } from 'lucide-react'
import { Button } from '@/shared/components/Button'
import { Card, EmptyState } from '@/shared/components/Card'
import { Item, Reveal } from '@/shared/components/Motion'
import { PageHero } from '@/shared/components/PageHero/PageHero'
import { heroBody } from '@/shared/components/PageHero/heroClasses'

export default function EnquiriesPage() {
  return (
    <>
      <PageHero title="Enquiries" subtitle="People asking about your properties." />
      <Reveal className={heroBody} delay={0.2}>
        <Item>
          <Card>
            <EmptyState
              icon={<Inbox size={20} />}
              title="No enquiries yet"
              description="Your public property pages don’t have an enquiry form yet. Once they do, every enquiry will be listed here with the property it’s about."
              action={<Button as={Link} to="/properties" variant="secondary">View my properties</Button>}
            />
          </Card>
        </Item>
      </Reveal>
    </>
  )
}
