import { useNavigate, Link } from 'react-router-dom'
import { AppShell } from '@/shared/components/AppShell/AppShell'
import { PropertyForm } from '../components/PropertyForm'
import { useCreateProperty } from '../hooks/usePropertyMutations'
import type { CreatePropertyInput } from '../property.types'
import styles from './NewPropertyPage.module.css'

export default function NewPropertyPage() {
  const navigate = useNavigate()
  const { mutateAsync, isPending } = useCreateProperty()

  async function handleSubmit(data: CreatePropertyInput | import('../property.types').UpdatePropertyInput) {
    const property = await mutateAsync(data as CreatePropertyInput)
    navigate(`/properties/${property.id}`)
  }

  return (
    <AppShell>
      <div className={styles.root}>
        <header className={styles.header}>
          <Link to="/properties" className={styles.back}>← Properties</Link>
          <h1 className={styles.title}>New Property</h1>
          <p className={styles.sub}>Fill in the details to create a listing manually.</p>
        </header>

        <div className={styles.formWrap}>
          <PropertyForm
            onSubmit={handleSubmit}
            submitLabel="Create Property"
            isLoading={isPending}
          />
        </div>
      </div>
    </AppShell>
  )
}
