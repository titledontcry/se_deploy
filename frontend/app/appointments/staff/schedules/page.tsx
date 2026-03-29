"use client";

import type { AxiosError } from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
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
import { type Profile } from "@/lib/access";

type Schedule = {
  schedule_id: number;
  work_date: string | null;
  start_time: string | null;
  end_time: string | null;
  slot_status: string | null;
  staff?: {
    first_name: string | null;
    last_name: string | null;
    role: string | null;
  } | null;
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

export default function StaffSchedulesPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [{ data: profileData }, { data: scheduleData }] = await Promise.all([
        api.get<Profile>("/auth/profile"),
        api.get<Schedule[]>("/appointments/my-schedules"),
      ]);
      setProfile(profileData);
      setSchedules(scheduleData);
    } catch (err: unknown) {
      const error = err as AxiosError<ApiErrorResponse>;
      const message = error.response?.data?.message || "Unable to load schedules";
      setError(Array.isArray(message) ? message.join(", ") : message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredSchedules = useMemo(
    () =>
      schedules.filter((schedule) =>
        `${formatDate(schedule.work_date)} ${schedule.appointments?.child?.first_name ?? ""} ${schedule.appointments?.child?.last_name ?? ""} ${schedule.slot_status ?? ""}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [query, schedules],
  );
  const pageSize = 10;
  const pagedSchedules = useMemo(
    () => filteredSchedules.slice((page - 1) * pageSize, page * pageSize),
    [filteredSchedules, page],
  );

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
      title="Schedules"
      subtitle="Keep schedule publishing separate from appointments and visits so each workflow stays clean."
      navTitle="Clinic Ops"
      navItems={staffNav(profile)}
      badge="Schedules"
      profileName={profile?.username}
      profileMeta="Schedule management"
      actions={
        <>
          <Button variant="outlined" onClick={() => router.push("/appointments/staff")}>
            Appointment table
          </Button>
          <Button variant="contained" onClick={() => router.push("/appointments/staff/schedules/new")}>
            Create schedule
          </Button>
        </>
      }
    >
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(3, 1fr)" }} gap={2} mb={3}>
        <StatCard label="Schedules" value={schedules.length} helper="Loaded schedule rows" />
        <StatCard label="Booked" value={schedules.filter((item) => item.slot_status === "booked").length} helper="Already taken" />
        <StatCard label="Available" value={schedules.filter((item) => item.slot_status === "available").length} helper="Still open" />
      </Box>

      <SearchSettingsCard description="Search schedules by date, child, or status.">
        <TextField
          fullWidth
          label="Search schedules"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="Date, child, slot status"
        />
      </SearchSettingsCard>

      <Box sx={{ mt: 2.5 }}>
        <PaginatedTableCard
          title="Schedule table"
          subtitle="Use row actions only for schedule work. Appointment and visit actions live on their own pages."
          page={page}
          pageCount={Math.ceil(filteredSchedules.length / pageSize)}
          onPageChange={setPage}
          empty={filteredSchedules.length === 0}
          header={
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Time</TableCell>
              <TableCell>Booked child</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          }
          body={
            <>
              {pagedSchedules.map((schedule) => (
                <TableRow key={schedule.schedule_id} hover>
                  <TableCell>{formatDate(schedule.work_date)}</TableCell>
                  <TableCell>{formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}</TableCell>
                  <TableCell>{schedule.appointments?.child ? `${schedule.appointments.child.first_name || "-"} ${schedule.appointments.child.last_name || ""}` : "None"}</TableCell>
                  <TableCell>{titleCase(schedule.slot_status)}{schedule.appointments?.approval_status ? ` / ${titleCase(schedule.appointments.approval_status)}` : ""}</TableCell>
                  <TableCell>
                    {!schedule.appointments ? (
                      <Button variant="outlined" color="error" onClick={() => handleDeleteSchedule(schedule.schedule_id)}>
                        Delete
                      </Button>
                    ) : schedule.appointments.approval_status === "approved" ? (
                      <Button variant="contained" onClick={() => router.push(`/visits/staff?appointmentId=${schedule.appointments?.appointment_id}`)}>
                        Open visit
                      </Button>
                    ) : (
                      "-"
                    )}
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
