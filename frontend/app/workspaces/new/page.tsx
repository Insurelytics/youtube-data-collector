import { Suspense } from "react"
import { NewWorkspaceClient } from "./NewWorkspaceClient.tsx"

export default function NewWorkspacePage() {
  return (
    <Suspense fallback={null}>
      <NewWorkspaceClient />
    </Suspense>
  )
}


