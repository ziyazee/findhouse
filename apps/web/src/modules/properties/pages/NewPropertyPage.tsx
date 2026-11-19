import { useNavigate } from 'react-router-dom'
import { PageHero } from '@/shared/components/PageHero/PageHero'
import { toast } from '@/shared/components/toastStore'
import { PropertyForm } from '../components/PropertyForm'
import { useCreateProperty } from '../hooks/usePropertyMutations'
import type { CreatePropertyInput, UpdatePropertyInput } from '../property.types'
import styles from './NewPropertyPage.module.css'

export default function NewPropertyPage() {
  const navigate = useNavigate()
  const { mutateAsync, isPending } = useCreateProperty()

  async function handleSubmit(data: CreatePropertyInput | UpdatePropertyInput) {
    const property = await mutateAsync(data as CreatePropertyInput)
    toast.success('Property created. Add photos to make it active.')
    navigate(`/properties/${property.id}`)
  }

  return (
    <>
      <PageHero title="Add property" subtitle="Fill in the details. Photos come next." />

      <div className={styles.formWrap}>
        <PropertyForm onSubmit={handleSubmit} submitLabel="Create property" isLoading={isPending} />
      </div>
    </>
  )
}
