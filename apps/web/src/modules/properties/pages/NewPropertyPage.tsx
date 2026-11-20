import { useLocation, useNavigate } from 'react-router-dom'
import { PageHero } from '@/shared/components/PageHero/PageHero'
import { toast } from '@/shared/components/toastStore'
import { PropertyForm } from '../components/PropertyForm'
import { useCreateProperty } from '../hooks/usePropertyMutations'
import type { CreatePropertyInput } from '../property.types'
import styles from './NewPropertyPage.module.css'

export default function NewPropertyPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { mutateAsync, isPending } = useCreateProperty()

  // Opened directly (no earlier page in the app), going back would leave FindHouse
  const goBack = () => (location.key === 'default' ? navigate('/dashboard') : navigate(-1))

  async function handleSubmit(data: CreatePropertyInput) {
    const property = await mutateAsync(data)
    toast.success('Property created. Add photos to make it active.')
    navigate(`/properties/${property.id}`)
  }

  return (
    <>
      <PageHero title="Add property" subtitle="Fill in the details. Photos come next." />

      <div className={styles.formWrap}>
        <PropertyForm onSubmit={handleSubmit} submitLabel="Create property" isLoading={isPending} onBack={goBack} />
      </div>
    </>
  )
}
