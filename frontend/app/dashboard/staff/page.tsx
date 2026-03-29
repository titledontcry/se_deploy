"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import type { AxiosError } from "axios";
import { AppShell, DashboardCard, PageSkeleton, StatCard } from "@/app/components/app-shell";
import { staffNav } from "@/app/components/navigation";
import api from "@/lib/api";
import { formatDate, formatMoney, titleCase } from "@/lib/format";
import { getEffectiveRoles, hasRole, type Profile } from "@/lib/access";

type ApiErrorResponse = {
  message?: string | string[];
};

type CommonDashboard = {
  summary: {
    totalSchedules: number;
    bookedSchedules: number;
    availableSchedules: number;
    todayAppointments: number;
    totalStaff: number;
    totalParents: number;
    totalChildren: number;
    revenue: {
      total: number;
      thisMonth: number;
    };
    appointmentStatus: Array<{ status: string | null; count: number }>;
  };
  upcomingSchedules: Array<{
    schedule_id: number;
    work_date: string | null;
    slot_status: string | null;
    staff: {
      first_name: string | null;
      last_name: string | null;
      role: string | null;
    } | null;
  }>;
  recentAppointments: Array<{
    appointment_id: number;
    status: string | null;
    child: {
      first_name: string | null;
      last_name: string | null;
    } | null;
  }>;
};

export default function StaffDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dashboard, setDashboard] = useState<CommonDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [{ data: profileData }, { data: dashboardData }] =
          await Promise.all([
            api.get<Profile>("/auth/profile"),
            api.get<CommonDashboard>("/users/staff/dashboard/common"),
          ]);
        setProfile(profileData);
        setDashboard(dashboardData);
      } catch (err: unknown) {
        const error = err as AxiosError<ApiErrorResponse>;
        if (error.response?.status === 401) {
          localStorage.removeItem("access_token");
          router.push("/login");
          return;
        }
        const message = error.response?.data?.message;
        setError(
          Array.isArray(message)
            ? message.join(", ")
            : (message ?? "Unable to load dashboard"),
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <AppShell
      title="Staff Dashboard"
      subtitle="A shared command center for schedules, queue pressure, role shortcuts, and clinic health."
      navTitle="Clinic Ops"
      navItems={staffNav(profile)}
      badge="Staff"
      profileName={profile?.username}
      profileMeta={getEffectiveRoles(profile).join(", ") || "Clinic team"}
      actions={
        <>
          <Button
            variant="contained"
            onClick={() => router.push("/appointments/staff")}
          >
            Manage appointments
          </Button>
          <Button
            variant="outlined"
            onClick={() => router.push("/assessments/staff")}
          >
            Assessments
          </Button>
          <Button
            variant="outlined"
            onClick={() => router.push("/dashboard/staff/management")}
          >
            Management
          </Button>
          {hasRole(profile, ["admin"]) && (
            <Button
              variant="outlined"
              onClick={() => router.push("/reports/staff")}
            >
              Reports
            </Button>
          )}
        </>
      }
    >
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Box
        display="grid"
        gridTemplateColumns={{ xs: "1fr", md: "repeat(4, 1fr)" }}
        gap={2}
        mb={3}
      >
        <StatCard
          label="Schedules"
          value={dashboard?.summary.totalSchedules ?? 0}
        />
        <StatCard
          label="Booked"
          value={dashboard?.summary.bookedSchedules ?? 0}
        />
        <StatCard
          label="Today's queue"
          value={dashboard?.summary.todayAppointments ?? 0}
        />
        <StatCard
          label="Month revenue"
          value={formatMoney(dashboard?.summary.revenue.thisMonth ?? 0)}
        />
      </Box>

      <Box
        display="grid"
        gridTemplateColumns={{ xs: "1fr", xl: "1.2fr 0.95fr" }}
        gap={2.5}
      >
        <Stack spacing={2.5}>
          <DashboardCard>
            <Typography variant="h5">Desk shortcuts</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              Open the main staff categories without overloading the sidebar.
            </Typography>
            <Box display="flex" gap={1.25} flexWrap="wrap" sx={{ mt: 2.25 }}>
              <Button variant="outlined" onClick={() => router.push("/appointments/staff")}>
                Appointments
              </Button>
              <Button variant="outlined" onClick={() => router.push("/visits/staff")}>
                Visit records
              </Button>
              <Button variant="outlined" onClick={() => router.push("/payment/staff")}>
                Payments
              </Button>
              <Button variant="outlined" onClick={() => router.push("/dashboard/staff/management")}>
                Management
              </Button>
            </Box>
          </DashboardCard>

          <DashboardCard>
            <Typography variant="h5">Assessment workspace</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              Build test templates, review child submissions, and keep
              interpretation bands aligned with the clinic flow.
            </Typography>
            <Button
              sx={{ mt: 2.25 }}
              variant="contained"
              onClick={() => router.push("/assessments/staff")}
            >
              Open assessments
            </Button>
          </DashboardCard>

          <DashboardCard>
            <Typography variant="h5">Upcoming schedules</Typography>
            <Stack spacing={1.5} sx={{ mt: 2.25 }}>
              {dashboard?.upcomingSchedules.map((schedule) => (
                <Box
                  key={schedule.schedule_id}
                  sx={{
                    p: 2,
                    borderRadius: 4,
                    background: "rgba(255,255,255,0.56)",
                    border: "1px solid rgba(122, 156, 156, 0.14)",
                  }}
                >
                  <Typography sx={{ fontWeight: 700 }}>
                    {schedule.staff?.first_name || "-"}{" "}
                    {schedule.staff?.last_name || ""}
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                    {titleCase(schedule.staff?.role)} •{" "}
                    {formatDate(schedule.work_date, "en-US")}
                  </Typography>
                  <Chip
                    size="small"
                    label={titleCase(schedule.slot_status)}
                    sx={{ mt: 1.25 }}
                  />
                </Box>
              ))}
            </Stack>
          </DashboardCard>
        </Stack>

        <Stack spacing={2.5}>
          <DashboardCard>
            <Typography variant="h5">Appointment status mix</Typography>
            <Box display="flex" gap={1} flexWrap="wrap" sx={{ mt: 2.25 }}>
              {dashboard?.summary.appointmentStatus.map((item) => (
                <Chip
                  key={item.status ?? "unknown"}
                  label={`${titleCase(item.status)}: ${item.count}`}
                />
              ))}
            </Box>
          </DashboardCard>

          <DashboardCard>
            <Typography variant="h5">Recent appointments</Typography>
            <Stack spacing={1.5} sx={{ mt: 2.25 }}>
              {dashboard?.recentAppointments.map((appointment) => (
                <Box
                  key={appointment.appointment_id}
                  sx={{
                    p: 2,
                    borderRadius: 4,
                    background: "rgba(255,255,255,0.56)",
                    border: "1px solid rgba(122, 156, 156, 0.14)",
                  }}
                >
                  <Typography sx={{ fontWeight: 700 }}>
                    {appointment.child?.first_name || "-"}{" "}
                    {appointment.child?.last_name || ""}
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                    Status: {titleCase(appointment.status)}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </DashboardCard>
        </Stack>
      </Box>
    </AppShell>
  );
}
