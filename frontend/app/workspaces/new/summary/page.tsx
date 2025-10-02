import { Suspense } from "react"
import { NewWorkspaceSummaryClient } from "./NewWorkspaceSummaryClient"

export default function NewWorkspaceSummaryPage() {
  return (
    <Suspense fallback={null}>
      <NewWorkspaceSummaryClient />
    </Suspense>
  )
}


