"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Pagination,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { AxiosError } from "axios";
import { AppShell, DashboardCard, PageSkeleton, StatCard } from "@/app/components/app-shell";
import { staffNav } from "@/app/components/navigation";
import api from "@/lib/api";
import { formatDate } from "@/lib/format";
import { getEffectiveRoles, type Profile } from "@/lib/access";

type ApiErrorResponse = { message?: string | string[] };

type VisitRecord = {
  visit_id: number;
  appointment_id: number | null;
  visit_date: string | null;
  diagnoses: Array<{ diagnose_id: number; diagnosis_text: string | null }>;
  treatment_plans: Array<{ plan_id: number; plan_detail: string | null }>;
  prescriptions: Array<{ prescription_id: number; items: Array<{ prescription_item_id: number }> }>;
  appointment: {
    appointment_id: number;
    patient: { first_name: string | null; last_name: string | null } | null;
    booked_by?: { parent?: Array<{ first_name: string | null; last_name: string | null }> } | null;
  } | null;
};

const PAGE_SIZE = 8;

export default function PastAppointmentsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () =>
      [...visits]
        .filter((v) =>
          `${v.appointment?.patient?.first_name ?? ""} ${v.appointment?.patient?.last_name ?? ""} ${v.appointment?.booked_by?.parent?.[0]?.first_name ?? ""} ${v.appointment?.booked_by?.parent?.[0]?.last_name ?? ""}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .sort((a, b) => {
          const at = a.visit_date ? new Date(a.visit_date).getTime() : 0;
          const bt = b.visit_date ? new Date(b.visit_date).getTime() : 0;
          return bt - at;
        }),
    [query, visits],
  );

  const paged = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [{ data: profileData }, { data: visitData }] = await Promise.all([
        api.get<Profile>("/auth/profile"),
        api.get<VisitRecord[]>("/visit"),
      ]);
      setProfile(profileData);
      setVisits(visitData);
    } catch (err: unknown) {
      const e = err as AxiosError<ApiErrorResponse>;
      if (e.response?.status === 401) {
        localStorage.removeItem("access_token");
        router.push("/login");
        return;
      }
      const msg = e.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(", ") : (msg ?? "Unable to load visit records"));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <AppShell
      title="Past Appointments"
      subtitle="รายการ appointment ที่มี visit record แล้ว กดเพื่อเปิดและแก้ไขได้"
      navTitle="Clinic Ops"
      navItems={staffNav(profile)}
      badge="Visit"
      profileName={profile?.username}
      profileMeta={getEffectiveRoles(profile).join(", ") || "Clinic team"}
      actions={
        <Button variant="outlined" onClick={() => router.push("/visits/staff")}>
          Back to Visit Workspace
        </Button>
      }
    >
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(2, 1fr)" }} gap={2} mb={3}>
        <StatCard label="Total visit records" value={visits.length} helper="Appointments with saved visits" />
        <StatCard
          label="Showing"
          value={filtered.length}
          helper={query ? "Matching search" : "All records"}
        />
      </Box>

      <DashboardCard>
        <TextField
          fullWidth
          label="Search past appointments"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          placeholder="Child or parent name"
          sx={{ mb: 2.25 }}
        />
        <Stack spacing={1.5}>
          {visits.length === 0 && (
            <Typography color="text.secondary">No past appointments yet.</Typography>
          )}
          {paged.map((visit) => (
            <Box
              key={visit.visit_id}
              sx={{
                p: 2,
                borderRadius: 4,
                background: "rgba(255,255,255,0.56)",
                border: "1px solid rgba(122, 156, 156, 0.14)",
              }}
            >
              <Box display="flex" justifyContent="space-between" gap={2} flexWrap="wrap">
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>
                    {visit.appointment?.patient?.first_name || "-"}{" "}
                    {visit.appointment?.patient?.last_name || ""}
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                    Visit date: {formatDate(visit.visit_date)}
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                    Parent: {visit.appointment?.booked_by?.parent?.[0]?.first_name || "-"}{" "}
                    {visit.appointment?.booked_by?.parent?.[0]?.last_name || ""}
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                    Diagnoses: {visit.diagnoses.length} | Medications:{" "}
                    {visit.prescriptions.flatMap((p) => p.items).length}
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  onClick={() =>
                    router.push(
                      `/visits/staff?appointmentId=${visit.appointment_id}`,
                    )
                  }
                >
                  Review
                </Button>
              </Box>
            </Box>
          ))}
        </Stack>
        {filtered.length > PAGE_SIZE && (
          <Box display="flex" justifyContent="center" sx={{ mt: 2.25 }}>
            <Pagination
              page={page}
              count={Math.ceil(filtered.length / PAGE_SIZE)}
              onChange={(_, value) => setPage(value)}
              color="primary"
            />
          </Box>
        )}
      </DashboardCard>
    </AppShell>
  );
}
