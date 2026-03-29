import { Suspense } from "react";
import { PageSkeleton } from "@/app/components/app-shell";
import StaffVisitsClient from "./staff-visits-client";

export default function StaffVisitsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <StaffVisitsClient />
    </Suspense>
  );
}
