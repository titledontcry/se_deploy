"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Alert, Box, Button, Chip, Stack, Typography } from "@mui/material";
import { AppShell, DashboardCard, PageSkeleton, StatCard } from "@/app/components/app-shell";
import { staffNav } from "@/app/components/navigation";
import api from "@/lib/api";
import { formatDate, titleCase } from "@/lib/format";
import type { Profile } from "@/lib/access";

type RoleDashboard = {
  role: string;
  summary: {
    staffCount: number;
    todaySchedules: number;
    todayAppointments: number;
    ownAppointmentCount: number;
    assessments: number;
    prescriptions: number;
  };
  ownAppointments: Array<{
    appointment_id: number;
    status: string | null;
    child: {
      first_name: string | null;
      last_name: string | null;
    } | null;
    work_schedules: {
      work_date: string | null;
    } | null;
  }>;
};

export default function StaffRoleDashboardPage() {
  const router = useRouter();
  const params = useParams<{ roleName: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dashboard, setDashboard] = useState<RoleDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [{ data: profileData }, { data }] = await Promise.all([
          api.get<Profile>("/auth/profile"),
          api.get<RoleDashboard>(`/users/staff/dashboard/${params.roleName}`),
        ]);
        setProfile(profileData);
        setDashboard(data);
      } catch (err: any) {
        if (err?.response?.status === 401) {
          localStorage.removeItem("access_token");
          router.push("/login");
          return;
        }
        const message = err?.response?.data?.message || "Unable to load role dashboard";
        setError(Array.isArray(message) ? message.join(", ") : message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [params.roleName, router]);

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <AppShell
      title={`${titleCase(dashboard?.role)} Desk`}
      subtitle="Role-focused metrics and the most recent queue activity for today's work."
      navTitle="Clinic Ops"
      navItems={staffNav(profile)}
      badge={titleCase(dashboard?.role)}
      profileName={profile?.username}
      profileMeta="Role dashboard"
      actions={
        <>
          <Button variant="outlined" onClick={() => router.push("/dashboard/staff")}>
            Staff overview
          </Button>
          <Button variant="contained" onClick={() => router.push("/appointments/staff")}>
            Open appointments
          </Button>
        </>
      }
    >
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(3, 1fr)" }} gap={2} mb={2}>
        <StatCard label="Staff in role" value={dashboard?.summary.staffCount ?? 0} />
        <StatCard label="Today's schedules" value={dashboard?.summary.todaySchedules ?? 0} />
        <StatCard label="Today's queue" value={dashboard?.summary.todayAppointments ?? 0} />
      </Box>

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(3, 1fr)" }} gap={2} mb={3}>
        <StatCard label="My appointments" value={dashboard?.summary.ownAppointmentCount ?? 0} />
        <StatCard label="Assessments" value={dashboard?.summary.assessments ?? 0} />
        <StatCard label="Prescriptions" value={dashboard?.summary.prescriptions ?? 0} />
      </Box>

      <DashboardCard>
        <Typography variant="h5">Recent queue</Typography>
        <Stack spacing={1.5} sx={{ mt: 2.25 }}>
          {dashboard?.ownAppointments.map((appointment) => (
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
                    {formatDate(appointment.work_schedules?.work_date || null, "en-US")}
                  </Typography>
                </Box>
                <Chip label={titleCase(appointment.status)} />
              </Box>
            </Box>
          ))}
          {dashboard?.ownAppointments.length === 0 && (
            <Typography color="text.secondary">No queue items for this role right now.</Typography>
          )}
        </Stack>
      </DashboardCard>
    </AppShell>
  );
}
