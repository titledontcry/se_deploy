'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { AppShell, DashboardCard, PageSkeleton, StatCard } from '@/app/components/app-shell';
import { parentNav } from '@/app/components/navigation';
import api from '@/lib/api';
import type { Profile } from '@/lib/access';
import { formatDate, formatTime, titleCase } from '@/lib/format';

type RangeValue = 'all' | 'day' | 'week' | 'month';

type Appointment = {
  appointment_id: number;
  status: string | null;
  approval_status: string | null;
  child: {
    first_name: string | null;
    last_name: string | null;
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
  room: {
    room_name: string | null;
  } | null;
};

export default function AppointmentHistoryPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [range, setRange] = useState<RangeValue>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAppointments = async (selectedRange: RangeValue) => {
    setLoading(true);
    setError('');

    try {
      const [{ data: profileData }, { data }] = await Promise.all([
        api.get<Profile>('/auth/profile'),
        api.get<Appointment[]>('/appointments', { params: { range: selectedRange } }),
      ]);
      setProfile(profileData);
      setAppointments(data);
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Unable to load appointment history';
      setError(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments(range);
  }, [range]);

  const activeAppointments = useMemo(
    () => appointments.filter((item) => item.status !== 'cancelled'),
    [appointments],
  );
  const filteredAppointments = useMemo(
    () =>
      appointments.filter((item) =>
        `${item.child?.first_name ?? ''} ${item.child?.last_name ?? ''} ${item.work_schedules?.staff?.first_name ?? ''} ${item.work_schedules?.staff?.last_name ?? ''} ${item.status ?? ''} ${item.approval_status ?? ''} ${item.room?.room_name ?? ''}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [appointments, query],
  );
  const pageSize = 6;
  const pagedAppointments = useMemo(
    () => filteredAppointments.slice((page - 1) * pageSize, page * pageSize),
    [filteredAppointments, page],
  );

  const handleCancelAppointment = async (appointmentId: number) => {
    if (!window.confirm('Cancel this appointment?')) {
      return;
    }

    try {
      await api.patch(`/appointments/${appointmentId}/cancel`);
      fetchAppointments(range);
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Unable to cancel appointment';
      window.alert(Array.isArray(message) ? message.join(', ') : message);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <AppShell
      title="Appointment History"
      subtitle="Track booked visits, approval state, room details, and status changes for each child."
      navTitle="Guardian Care"
      navItems={parentNav()}
      badge="Parent"
      profileName={profile?.username}
      profileMeta="Appointment records"
      actions={
        <>
          <TextField
            select
            size="small"
            value={range}
            onChange={(event) => setRange(event.target.value as RangeValue)}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="day">Today</MenuItem>
            <MenuItem value="week">This week</MenuItem>
            <MenuItem value="month">This month</MenuItem>
          </TextField>
          <Button variant="outlined" onClick={() => router.push('/dashboard/parent')}>
            Dashboard
          </Button>
          <Button variant="contained" onClick={() => router.push('/appointments/parent')}>
            Book new appointment
          </Button>
        </>
      }
    >
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'repeat(3, 1fr)' }} gap={2} mb={3}>
        <StatCard label="Total records" value={appointments.length} />
        <StatCard label="Active" value={activeAppointments.length} />
        <StatCard label="Cancelled" value={appointments.filter((item) => item.status === 'cancelled').length} />
      </Box>

      <Stack spacing={2.5}>
          <DashboardCard>
            <Typography variant="h5">Search settings</Typography>
            <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 180px' }} gap={1.5} sx={{ mt: 2 }}>
              <TextField
                label="Search appointments"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Child, doctor, room, status"
              />
              <TextField
                select
                label="Range"
                value={range}
                onChange={(event) => {
                  setRange(event.target.value as RangeValue);
                  setPage(1);
                }}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="day">Today</MenuItem>
                <MenuItem value="week">This week</MenuItem>
                <MenuItem value="month">This month</MenuItem>
              </TextField>
            </Box>
          </DashboardCard>
          {appointments.length === 0 ? (
            <DashboardCard>
              <Typography variant="h5">No history yet</Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Once appointments are booked, they will appear here.
              </Typography>
            </DashboardCard>
          ) : (
            pagedAppointments.map((appointment) => (
              <DashboardCard key={appointment.appointment_id}>
                <Box display="flex" justifyContent="space-between" gap={2} flexWrap="wrap">
                  <Box>
                    <Typography variant="h6">
                      {appointment.child
                        ? `${appointment.child.first_name || '-'} ${appointment.child.last_name || ''}`
                        : `${profile?.first_name || profile?.username || '-'} ${profile?.last_name || ''}`}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                      Specialist: {appointment.work_schedules?.staff?.first_name || '-'} {appointment.work_schedules?.staff?.last_name || ''}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                      Date: {formatDate(appointment.work_schedules?.work_date || null)}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                      Time: {formatTime(appointment.work_schedules?.start_time || null)} - {formatTime(appointment.work_schedules?.end_time || null)}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                      Room: {appointment.room?.room_name || '-'}
                    </Typography>
                  </Box>

                  <Stack alignItems={{ xs: 'flex-start', sm: 'flex-end' }} spacing={1.25}>
                    <Chip
                      label={titleCase(appointment.status)}
                      color={appointment.status === 'cancelled' ? 'error' : 'success'}
                    />
                    <Chip
                      label={`Approval: ${titleCase(appointment.approval_status || 'pending')}`}
                      color={
                        appointment.approval_status === 'approved'
                          ? 'success'
                          : appointment.approval_status === 'rejected'
                            ? 'error'
                            : 'warning'
                      }
                    />
                    {appointment.status !== 'cancelled' && (
                      <Button
                        variant="outlined"
                        color="error"
                        onClick={() => handleCancelAppointment(appointment.appointment_id)}
                      >
                        Cancel appointment
                      </Button>
                    )}
                  </Stack>
                </Box>
              </DashboardCard>
            ))
          )}
          {filteredAppointments.length > pageSize && (
            <Box display="flex" justifyContent="center">
              <Pagination
                page={page}
                count={Math.ceil(filteredAppointments.length / pageSize)}
                onChange={(_, value) => setPage(value)}
                color="primary"
              />
            </Box>
          )}
        </Stack>
    </AppShell>
  );
}
