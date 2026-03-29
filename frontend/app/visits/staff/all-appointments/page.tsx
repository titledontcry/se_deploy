"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Chip,
  Pagination,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { AxiosError } from "axios";
import { AppShell, DashboardCard, PageSkeleton, StatCard } from "@/app/components/app-shell";
import { staffNav } from "@/app/components/navigation";
import api from "@/lib/api";
import { formatDate, formatTime, titleCase } from "@/lib/format";
import { getEffectiveRoles, type Profile } from "@/lib/access";

type ApiErrorResponse = { message?: string | string[] };

type Appointment = {
  appointment_id: number;
  status: string | null;
  approval_status?: string | null;
  patient_id?: number | null;
  child: { first_name: string | null; last_name: string | null } | null;
  booked_by: { parent: Array<{ first_name: string | null; last_name: string | null }> } | null;
  work_schedules: {
    work_date: string | null;
    start_time: string | null;
    end_time: string | null;
    staff: { first_name: string | null; last_name: string | null; role: string | null } | null;
  } | null;
};

type Visit = { visit_id: number; appointment_id: number | null };

const PAGE_SIZE = 8;

export default function AllAppointmentsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const visitMap = useMemo(
    () =>
      new Map(
        visits
          .filter((v) => v.appointment_id !== null)
          .map((v) => [v.appointment_id as number, v.visit_id]),
      ),
    [visits],
  );

  const filtered = useMemo(
    () =>
      appointments.filter((a) =>
        `${a.child?.first_name ?? ""} ${a.child?.last_name ?? ""} ${a.booked_by?.parent?.[0]?.first_name ?? ""} ${a.booked_by?.parent?.[0]?.last_name ?? ""} ${a.work_schedules?.staff?.first_name ?? ""} ${a.work_schedules?.staff?.last_name ?? ""} ${a.status ?? ""} ${a.approval_status ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [query, appointments],
  );

  const paged = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [{ data: profileData }, { data: appointmentData }, { data: visitData }] =
        await Promise.all([
          api.get<Profile>("/auth/profile"),
          api.get<Appointment[]>("/appointments"),
          api.get<Visit[]>("/visit"),
        ]);
      setProfile(profileData);
      setAppointments(appointmentData);
      setVisits(visitData);
    } catch (err: unknown) {
      const e = err as AxiosError<ApiErrorResponse>;
      if (e.response?.status === 401) {
        localStorage.removeItem("access_token");
        router.push("/login");
        return;
      }
      const msg = e.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(", ") : (msg ?? "Unable to load appointments"));
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
      title="All Appointments"
      subtitle="รายการ appointment ทั้งหมด กดสร้างหรือเปิด visit record ได้เลย"
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

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(3, 1fr)" }} gap={2} mb={3}>
        <StatCard label="Total" value={appointments.length} helper="All appointments" />
        <StatCard
          label="Approved"
          value={appointments.filter((a) => a.approval_status === "approved").length}
          helper="Ready to create visit"
        />
        <StatCard
          label="With visit record"
          value={visitMap.size}
          helper="Already have a visit saved"
        />
      </Box>

      <DashboardCard>
        <TextField
          fullWidth
          label="Search appointments"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          placeholder="Child, parent, specialist, status"
          sx={{ mb: 2.25 }}
        />
        <Stack spacing={1.5}>
          {appointments.length === 0 && (
            <Typography color="text.secondary">No appointments available.</Typography>
          )}
          {paged.map((appointment) => {
            const linkedVisitId = visitMap.get(appointment.appointment_id) ?? null;
            return (
              <Box
                key={appointment.appointment_id}
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
                      {appointment.child?.first_name || "-"} {appointment.child?.last_name || ""}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                      {formatDate(appointment.work_schedules?.work_date || null)} |{" "}
                      {formatTime(appointment.work_schedules?.start_time || null)} -{" "}
                      {formatTime(appointment.work_schedules?.end_time || null)}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                      Parent: {appointment.booked_by?.parent?.[0]?.first_name || "-"}{" "}
                      {appointment.booked_by?.parent?.[0]?.last_name || ""}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                      Specialist: {appointment.work_schedules?.staff?.first_name || "-"}{" "}
                      {appointment.work_schedules?.staff?.last_name || ""}
                    </Typography>
                  </Box>
                  <Stack alignItems={{ xs: "flex-start", sm: "flex-end" }} spacing={1.25}>
                    <Chip
                      label={linkedVisitId ? "Visit saved" : titleCase(appointment.status)}
                      color={linkedVisitId ? "success" : appointment.status === "cancelled" ? "error" : "default"}
                    />
                    <Chip
                      label={`Approval: ${titleCase(appointment.approval_status || "pending")}`}
                      color={
                        appointment.approval_status === "approved"
                          ? "success"
                          : appointment.approval_status === "rejected"
                            ? "error"
                            : "warning"
                      }
                    />
                    <Button
                      variant={linkedVisitId ? "outlined" : "contained"}
                      disabled={
                        appointment.status === "cancelled" ||
                        appointment.approval_status !== "approved"
                      }
                      onClick={() =>
                        router.push(
                          `/visits/staff?appointmentId=${appointment.appointment_id}`,
                        )
                      }
                    >
                      {linkedVisitId
                        ? "Open record"
                        : appointment.approval_status === "approved"
                          ? "Create visit"
                          : "Waiting for approval"}
                    </Button>
                  </Stack>
                </Box>
              </Box>
            );
          })}
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
