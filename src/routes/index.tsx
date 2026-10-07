import { createFileRoute } from '@tanstack/react-router'
import { TownView } from '@/components/TownView'

export const Route = createFileRoute('/')({
  component: TownView,
})
