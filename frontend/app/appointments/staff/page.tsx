"use client";

import type { AxiosError } from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  MenuItem,
  TableCell,
  TableRow,
  TextField,
} from "@mui/material";
import { AppShell, PageSkeleton, StatCard } from "@/app/components/app-shell";
import { staffNav } from "@/app/components/navigation";
import { PaginatedTableCard } from "@/app/components/paginated-table-card";
import { SearchSettingsCard } from "@/app/components/search-settings-card";
import api from "@/lib/api";
import { formatDate, formatTime, titleCase } from "@/lib/format";
import type { Profile } from "@/lib/access";

type Appointment = {
  appointment_id: number;
  status: string | null;
  approval_status: string | null;
  child: {
    first_name: string | null;
    last_name: string | null;
  } | null;
  booked_by: {
    username: string;
    parent: {
      first_name: string | null;
      last_name: string | null;
    }[];
  } | null;
  work_schedules: {
    work_date: string | null;
    start_time: string | null;
    end_time: string | null;
    staff: {
      first_name: string | null;
      last_name: string | null;
      role: string | null;
    } | null;
  } | null;
};

type Schedule = {
  schedule_id: number;
  work_date: string | null;
  start_time: string | null;
  end_time: string | null;
  slot_status: string | null;
  appointments: {
    appointment_id: number;
    status: string | null;
    approval_status: string | null;
    child: {
      first_name: string | null;
      last_name: string | null;
    } | null;
  } | null;
};

type ApiErrorResponse = {
  message?: string | string[];
};

type SectionKey = "appointments" | "schedules";

const pageSize = 10;

export default function StaffAppointmentsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState<"all" | "day" | "week" | "month">("all");
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<SectionKey>("appointments");
  const [page, setPage] = useState(1);

  const isAdmin = useMemo(() => {
    const roles = new Set<string>([
      ...(profile?.staffRole ? [profile.staffRole] : []),
      ...(profile?.roleNames ?? []),
    ]);
    return roles.has("admin");
  }, [profile]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [{ data: profileData }, { data: appointmentData }, { data: scheduleData }] = await Promise.all([
        api.get<Profile>("/auth/profile"),
        api.get<Appointment[]>("/appointments", { params: { range } }),
        api.get<Schedule[]>("/appointments/my-schedules"),
      ]);
      setProfile(profileData);
      setAppointments(appointmentData);
      setSchedules(scheduleData);
    } catch (err: unknown) {
      const error = err as AxiosError<ApiErrorResponse>;
      const message = error.response?.data?.message || "Unable to load appointment workspace";
      setError(Array.isArray(message) ? message.join(", ") : message);
      if (error.response?.status === 401) {
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  }, [range, router]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filteredAppointments = useMemo(
    () =>
      appointments.filter((appointment) =>
        `${appointment.child?.first_name ?? ""} ${appointment.child?.last_name ?? ""} ${appointment.booked_by?.parent?.[0]?.first_name ?? ""} ${appointment.booked_by?.parent?.[0]?.last_name ?? ""} ${appointment.work_schedules?.staff?.first_name ?? ""} ${appointment.work_schedules?.staff?.last_name ?? ""} ${appointment.status ?? ""} ${appointment.approval_status ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [appointments, query],
  );

  const filteredSchedules = useMemo(
    () =>
      schedules.filter((schedule) =>
        `${formatDate(schedule.work_date)} ${schedule.appointments?.child?.first_name ?? ""} ${schedule.appointments?.child?.last_name ?? ""} ${schedule.slot_status ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [query, schedules],
  );

  const activeCount = section === "appointments" ? filteredAppointments.length : filteredSchedules.length;
  const pagedRows =
    section === "appointments"
      ? filteredAppointments.slice((page - 1) * pageSize, page * pageSize)
      : filteredSchedules.slice((page - 1) * pageSize, page * pageSize);

  const handleCancelAppointment = async (appointmentId: number) => {
    if (!window.confirm("Cancel this appointment?")) return;
    try {
      await api.patch(`/appointments/${appointmentId}/cancel`);
      await fetchData();
    } catch (err: unknown) {
      const error = err as AxiosError<ApiErrorResponse>;
      const message = error.response?.data?.message || "Unable to cancel appointment";
      setError(Array.isArray(message) ? message.join(", ") : message);
    }
  };

  const handleApproval = async (
    appointmentId: number,
    approval_status: "approved" | "rejected",
  ) => {
    try {
      await api.patch(`/appointments/${appointmentId}/approval`, { approval_status });
      await fetchData();
    } catch (err: unknown) {
      const error = err as AxiosError<ApiErrorResponse>;
      const message = error.response?.data?.message || "Unable to update approval";
      setError(Array.isArray(message) ? message.join(", ") : message);
    }
  };

  const handleDeleteSchedule = async (scheduleId: number) => {
    if (!window.confirm("Delete this schedule?")) return;
    try {
      await api.delete(`/appointments/schedules/${scheduleId}`);
      await fetchData();
    } catch (err: unknown) {
      const error = err as AxiosError<ApiErrorResponse>;
      const message = error.response?.data?.message || "Unable to delete schedule";
      setError(Array.isArray(message) ? message.join(", ") : message);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <AppShell
      title="Appointments"
      subtitle="Keep appointment work under one category page, then switch between appointment rows and schedule rows inside the same workspace."
      navTitle="Clinic Ops"
      navItems={staffNav(profile)}
      badge="Appointments"
      profileName={profile?.username}
      profileMeta="Appointment operations"
      actions={
        <>
          <Button variant="contained" onClick={() => router.push("/appointments/staff/schedules/new")}>
            Create schedule
          </Button>
          <Button variant="outlined" onClick={() => router.push("/visits/staff")}>
            Visit records
          </Button>
        </>
      }
    >
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(4, 1fr)" }} gap={2} mb={3}>
        <StatCard label="Appointments" value={appointments.length} helper="Booking records" />
        <StatCard label="Schedules" value={schedules.length} helper="Published time slots" />
        <StatCard label="Approved" value={appointments.filter((item) => item.approval_status === "approved").length} helper="Ready for visit creation" />
        <StatCard label="Available slots" value={schedules.filter((item) => item.slot_status === "available").length} helper="Still open to book" />
      </Box>

      <SearchSettingsCard description="This category page groups appointment and schedule work together, but keeps the result area as a single table.">
        <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "220px 220px minmax(0, 1fr)" }} gap={1.5}>
          <TextField
            select
            label="Type"
            value={section}
            onChange={(event) => {
              setSection(event.target.value as SectionKey);
              setPage(1);
            }}
          >
            <MenuItem value="appointments">Appointments</MenuItem>
            <MenuItem value="schedules">Schedules</MenuItem>
          </TextField>
          <TextField
            select
            label="Range"
            value={range}
            onChange={(event) => {
              setRange(event.target.value as typeof range);
              setPage(1);
            }}
          >
            <MenuItem value="all">All appointments</MenuItem>
            <MenuItem value="day">Today</MenuItem>
            <MenuItem value="week">Next 7 days</MenuItem>
            <MenuItem value="month">Next 30 days</MenuItem>
          </TextField>
          <TextField
            label={section === "appointments" ? "Search appointments" : "Search schedules"}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder={
              section === "appointments"
                ? "Child, parent, specialist, status"
                : "Date, child, slot status"
            }
          />
        </Box>
      </SearchSettingsCard>

      <Box sx={{ mt: 2.5 }}>
        <PaginatedTableCard
          title={section === "appointments" ? "Appointment table" : "Schedule table"}
          subtitle={`Showing ${activeCount} row(s) in the selected appointment category.`}
          page={page}
          pageCount={Math.max(1, Math.ceil(activeCount / pageSize))}
          onPageChange={setPage}
          empty={activeCount === 0}
          header={
            <TableRow>
              {section === "appointments" ? (
                <>
                  <TableCell>Child</TableCell>
                  <TableCell>Parent</TableCell>
                  <TableCell>Specialist</TableCell>
                  <TableCell>Schedule</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </>
              ) : (
                <>
                  <TableCell>Date</TableCell>
                  <TableCell>Time</TableCell>
                  <TableCell>Booked child</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </>
              )}
            </TableRow>
          }
          body={
            <>
              {section === "appointments" &&
                (pagedRows as typeof filteredAppointments).map((appointment) => (
                  <TableRow
                    key={appointment.appointment_id}
                    hover
                    sx={{
                      "& td": {
                        py: 1.9,
                        verticalAlign: "middle",
                      },
                    }}
                  >
                    <TableCell sx={{ width: "13%" }}>{appointment.child?.first_name || "-"} {appointment.child?.last_name || ""}</TableCell>
                    <TableCell sx={{ width: "14%" }}>{appointment.booked_by?.parent?.[0] ? `${appointment.booked_by.parent[0].first_name || "-"} ${appointment.booked_by.parent[0].last_name || ""}` : appointment.booked_by?.username || "-"}</TableCell>
                    <TableCell sx={{ width: "15%" }}>{appointment.work_schedules?.staff?.first_name || "-"} {appointment.work_schedules?.staff?.last_name || ""}</TableCell>
                    <TableCell sx={{ width: "18%" }}>{formatDate(appointment.work_schedules?.work_date || null)} {formatTime(appointment.work_schedules?.start_time || null)}-{formatTime(appointment.work_schedules?.end_time || null)}</TableCell>
                    <TableCell sx={{ width: "15%" }}>{titleCase(appointment.status)} / {titleCase(appointment.approval_status)}</TableCell>
                    <TableCell sx={{ width: "25%", minWidth: 340 }}>
                      <Box
                        display="flex"
                        gap={1}
                        flexWrap="wrap"
                        alignItems="center"
                        sx={{
                          "& .MuiButton-root": {
                            minHeight: 42,
                            px: 2,
                            borderRadius: 3,
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          },
                        }}
                      >
                        {isAdmin && appointment.status !== "completed" && appointment.approval_status !== "approved" && (
                          <Button size="small" variant="contained" color="success" onClick={() => handleApproval(appointment.appointment_id, "approved")}>
                            Approve
                          </Button>
                        )}
                        {isAdmin && appointment.status !== "completed" && appointment.approval_status !== "rejected" && (
                          <Button size="small" variant="outlined" color="warning" onClick={() => handleApproval(appointment.appointment_id, "rejected")}>
                            Reject
                          </Button>
                        )}
                        {appointment.status !== "cancelled" && appointment.approval_status === "approved" && (
                          <Button size="small" variant="contained" onClick={() => router.push(`/visits/staff?appointmentId=${appointment.appointment_id}`)}>
                            Visit record
                          </Button>
                        )}
                        {appointment.status !== "cancelled" && appointment.approval_status !== "rejected" && (
                          <Button size="small" variant="outlined" color="error" onClick={() => handleCancelAppointment(appointment.appointment_id)}>
                            Cancel
                          </Button>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              {section === "schedules" &&
                (pagedRows as typeof filteredSchedules).map((schedule) => (
                  <TableRow
                    key={schedule.schedule_id}
                    hover
                    sx={{
                      "& td": {
                        py: 1.9,
                        verticalAlign: "middle",
                      },
                    }}
                  >
                    <TableCell sx={{ width: "18%" }}>{formatDate(schedule.work_date)}</TableCell>
                    <TableCell sx={{ width: "18%" }}>{formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}</TableCell>
                    <TableCell sx={{ width: "22%" }}>{schedule.appointments?.child ? `${schedule.appointments.child.first_name || "-"} ${schedule.appointments.child.last_name || ""}` : "None"}</TableCell>
                    <TableCell sx={{ width: "17%" }}>{titleCase(schedule.slot_status)}{schedule.appointments?.approval_status ? ` / ${titleCase(schedule.appointments.approval_status)}` : ""}</TableCell>
                    <TableCell sx={{ width: "25%", minWidth: 280 }}>
                      <Box
                        display="flex"
                        gap={1}
                        flexWrap="wrap"
                        alignItems="center"
                        sx={{
                          "& .MuiButton-root": {
                            minHeight: 42,
                            px: 2,
                            borderRadius: 3,
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          },
                        }}
                      >
                        {!schedule.appointments ? (
                          <Button size="small" variant="outlined" color="error" onClick={() => handleDeleteSchedule(schedule.schedule_id)}>
                            Delete
                          </Button>
                        ) : schedule.appointments.approval_status === "approved" ? (
                          <Button size="small" variant="contained" onClick={() => router.push(`/visits/staff?appointmentId=${schedule.appointments?.appointment_id}`)}>
                            Open visit
                          </Button>
                        ) : (
                          <Button size="small" variant="outlined" onClick={() => setSection("appointments")}>
                            View appointment
                          </Button>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
            </>
          }
        />
      </Box>
    </AppShell>
  );
}
