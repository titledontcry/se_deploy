'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { AppShell, DashboardCard, PageSkeleton, StatCard } from '@/app/components/app-shell';
import { parentNav } from '@/app/components/navigation';
import api from '@/lib/api';
import type { Profile } from '@/lib/access';
import { formatDate, formatTime, titleCase } from '@/lib/format';

type Schedule = {
  schedule_id: number;
  work_date: string | null;
  start_time: string | null;
  end_time: string | null;
  slot_status: string | null;
  staff: {
    first_name: string | null;
    last_name: string | null;
    role: string | null;
  } | null;
};

type Child = {
  child_id: number;
  first_name: string | null;
  last_name: string | null;
};

type Room = {
  room_id: number;
  room_name: string | null;
};

type BookingContext = {
  children: Child[];
  rooms: Room[];
};

const timetableHours = Array.from({ length: 12 }, (_, index) => `${String(index + 8).padStart(2, '0')}:00`);

export default function ParentAppointmentsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [bookingContext, setBookingContext] = useState<BookingContext>({ children: [], rooms: [] });
  const [anchorDate, setAnchorDate] = useState(() => getIsoDate(new Date()));
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');

      try {
        const [{ data: profileData }, { data: scheduleData }, { data: contextData }] = await Promise.all([
          api.get<Profile>('/auth/profile'),
          api.get<Schedule[]>('/appointments/schedules'),
          api.get<BookingContext>('/appointments/booking-context'),
        ]);
        setProfile(profileData);
        setSchedules(scheduleData);
        setBookingContext(contextData);
        if (contextData.children[0]) {
          setSelectedChildId(String(contextData.children[0].child_id));
        }
      } catch (err: any) {
        const message = err?.response?.data?.message || 'Unable to load schedules';
        setError(Array.isArray(message) ? message.join(', ') : message);

        if (err?.response?.status === 401) {
          router.push('/login');
        }
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [router]);

  const anchor = useMemo(() => new Date(`${anchorDate}T00:00:00.000Z`), [anchorDate]);

  const filteredSchedules = useMemo(
    () =>
      schedules.filter((item) => {
        const haystack = `${item.staff?.first_name ?? ''} ${item.staff?.last_name ?? ''} ${item.staff?.role ?? ''} ${item.slot_status ?? ''} ${item.work_date ?? ''} ${item.start_time ?? ''}`
          .toLowerCase();
        return haystack.includes(query.toLowerCase());
      }),
    [query, schedules],
  );

  const todaySlots = useMemo(
    () => filteredSchedules.filter((item) => isSameUtcDay(item.work_date, anchor)),
    [anchor, filteredSchedules],
  );

  const weekDays = useMemo(() => getWeekDays(anchor), [anchor]);
  const monthCells = useMemo(() => getMonthCells(anchor), [anchor]);

  const moveDate = (direction: -1 | 1) => {
    const next = new Date(anchor);
    next.setUTCDate(next.getUTCDate() + direction);
    setAnchorDate(getIsoDate(next));
  };

  const openDetails = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setSelectedRoomId('');
    if (bookingContext.children[0] && !selectedChildId) {
      setSelectedChildId(String(bookingContext.children[0].child_id));
    }
    setDetailOpen(true);
  };

  const handleOpenConfirm = () => {
    if (!selectedSchedule) return;
    if (bookingContext.children.length > 0 && !selectedChildId) {
      setError('Please select a child profile first.');
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirmBooking = async () => {
    if (!selectedSchedule) return;

    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/appointments', {
        patient_id: selectedChildId ? Number(selectedChildId) : undefined,
        schedule_id: selectedSchedule.schedule_id,
        room_id: selectedRoomId ? Number(selectedRoomId) : undefined,
      });

      setConfirmOpen(false);
      setDetailOpen(false);
      setSelectedSchedule(null);
      setSelectedRoomId('');
      setSuccess('Booking submitted successfully. Your request is now waiting for approval.');

      const { data } = await api.get<Schedule[]>('/appointments/schedules');
      setSchedules(data);

      window.setTimeout(() => {
        router.replace('/appointments/parent');
        router.refresh();
      }, 900);
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Unable to complete booking';
      setError(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <AppShell
      title="Appointment Booking"
      subtitle="Browse the clinic schedule in three views: daily timetable, weekly schedule, and monthly calendar. Open any slot to see details and confirm the booking."
      navTitle="Guardian Care"
      navItems={parentNav()}
      badge="Parent"
      profileName={profile?.username}
      profileMeta="Booking workspace"
      actions={
        <>
          <Button variant="outlined" onClick={() => moveDate(-1)}>
            Previous day
          </Button>
          <Button variant="outlined" onClick={() => setAnchorDate(getIsoDate(new Date()))}>
            Today
          </Button>
          <Button variant="outlined" onClick={() => moveDate(1)}>
            Next day
          </Button>
          <Button variant="contained" onClick={() => router.push('/appointments/parent/history')}>
            Appointment history
          </Button>
        </>
      }
    >
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}
      <Alert severity="info" sx={{ mb: 3 }}>
        Booking requests still need clinic approval and should be submitted at least one hour before the slot starts.
      </Alert>

      <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'repeat(4, 1fr)' }} gap={2} mb={3}>
        <StatCard label="Open slots" value={filteredSchedules.length} helper="Published by clinic staff" />
        <StatCard label="Selected day" value={todaySlots.length} helper={formatDate(anchor.toISOString())} />
        <StatCard label="This week" value={weekDays.reduce((sum, day) => sum + getSchedulesForDay(filteredSchedules, day).length, 0)} helper="Slots across the weekly view" />
        <StatCard label="This month" value={filteredSchedules.filter((item) => isSameUtcMonth(new Date(item.work_date || ''), anchor)).length} helper="Slots inside the monthly calendar" />
      </Box>

      <Stack spacing={2.5}>
          <DashboardCard>
            <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '220px minmax(0, 1fr)' }} gap={2}>
              <TextField
                label="Anchor date"
                type="date"
                value={anchorDate}
                onChange={(event) => setAnchorDate(event.target.value)}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="Search schedules"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Specialist, role, time, status"
                fullWidth
              />
            </Box>
          </DashboardCard>

          <DashboardCard>
            <Typography variant="h5">Daily timetable</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              {formatDate(anchor.toISOString())}
            </Typography>

            <Box sx={{ mt: 2.25, overflowX: 'auto' }}>
              <Box
                sx={{
                  minWidth: 720,
                  display: 'grid',
                  gridTemplateColumns: '120px minmax(0, 1fr)',
                  border: '1px solid rgba(200, 205, 182, 0.28)',
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                {timetableHours.map((hour, index) => {
                  const hourSchedules = todaySlots.filter((schedule) => getHourLabel(schedule.start_time) === hour);
                  return (
                    <Box key={hour} sx={{ display: 'contents' }}>
                      <Box
                        sx={{
                          px: 2,
                          py: 2,
                          background: index % 2 === 0 ? 'rgba(248,246,239,0.92)' : 'rgba(255,255,255,0.7)',
                          borderBottom: '1px solid rgba(200, 205, 182, 0.22)',
                          fontWeight: 700,
                        }}
                      >
                        {hour}
                      </Box>
                      <Box
                        sx={{
                          px: 2,
                          py: 1.5,
                          background: index % 2 === 0 ? 'rgba(248,246,239,0.92)' : 'rgba(255,255,255,0.7)',
                          borderBottom: '1px solid rgba(200, 205, 182, 0.22)',
                        }}
                      >
                        {hourSchedules.length === 0 ? (
                          <Typography color="text.secondary">No slot</Typography>
                        ) : (
                          <Box display="flex" gap={1.25} flexWrap="wrap">
                            {hourSchedules.map((schedule) => (
                              <Button
                                key={schedule.schedule_id}
                                variant="outlined"
                                onClick={() => openDetails(schedule)}
                                sx={{ borderRadius: 3, minHeight: 42 }}
                              >
                                {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)} | {schedule.staff?.first_name || '-'} {schedule.staff?.last_name || ''}
                              </Button>
                            ))}
                          </Box>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </DashboardCard>

          <DashboardCard>
            <Typography variant="h5">Weekly table</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              Week of {formatDate(weekDays[0].toISOString())}
            </Typography>

            <Box sx={{ mt: 2.25, overflowX: 'auto' }}>
              <Box
                sx={{
                  minWidth: 980,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                  gap: 1.25,
                }}
              >
                {weekDays.map((day) => {
                  const daySchedules = getSchedulesForDay(filteredSchedules, day);
                  return (
                    <Box
                      key={day.toISOString()}
                      sx={{
                        minHeight: 280,
                        p: 1.75,
                        borderRadius: 4,
                        background: isSameUtcDay(day.toISOString(), new Date()) ? 'rgba(225, 237, 214, 0.55)' : 'rgba(255,255,255,0.62)',
                        border: '1px solid rgba(200, 205, 182, 0.26)',
                      }}
                    >
                      <Typography sx={{ fontWeight: 800 }}>
                        {day.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}
                      </Typography>
                      <Typography color="text.secondary" sx={{ mb: 1.25 }}>
                        {formatDate(day.toISOString())}
                      </Typography>

                      <Stack spacing={1}>
                        {daySchedules.length === 0 ? (
                          <Typography color="text.secondary">No slots</Typography>
                        ) : (
                          daySchedules.map((schedule) => (
                            <Box
                              key={schedule.schedule_id}
                              onClick={() => openDetails(schedule)}
                              sx={{
                                p: 1.25,
                                borderRadius: 3,
                                cursor: 'pointer',
                                background: 'rgba(248,246,239,0.96)',
                                border: '1px solid rgba(188, 197, 165, 0.34)',
                                '&:hover': {
                                  background: 'rgba(235, 241, 222, 0.96)',
                                },
                              }}
                            >
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                                {schedule.staff?.first_name || '-'} {schedule.staff?.last_name || ''}
                              </Typography>
                            </Box>
                          ))
                        )}
                      </Stack>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </DashboardCard>

          <DashboardCard>
            <Typography variant="h5">Monthly calendar</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              {anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
            </Typography>

            <Box
              sx={{
                mt: 2.25,
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                gap: 1.25,
              }}
            >
              {monthCells.map((day) => {
                const daySchedules = getSchedulesForDay(filteredSchedules, day);
                const inMonth = isSameUtcMonth(day, anchor);
                return (
                  <Box
                    key={day.toISOString()}
                    sx={{
                      minHeight: 148,
                      p: 1.5,
                      borderRadius: 4,
                      background: inMonth ? 'rgba(255,255,255,0.62)' : 'rgba(245,245,245,0.72)',
                      border: '1px solid rgba(200, 205, 182, 0.24)',
                    }}
                  >
                    <Typography sx={{ fontWeight: 800 }}>{day.getUTCDate()}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {daySchedules.length} slot{daySchedules.length === 1 ? '' : 's'}
                    </Typography>

                    <Stack spacing={0.75}>
                      {daySchedules.slice(0, 3).map((schedule) => (
                        <Chip
                          key={schedule.schedule_id}
                          label={`${formatTime(schedule.start_time)} ${schedule.staff?.first_name || '-'}`}
                          onClick={() => openDetails(schedule)}
                          sx={{ justifyContent: 'flex-start' }}
                        />
                      ))}
                      {daySchedules.length > 3 && (
                        <Button size="small" variant="text" onClick={() => setAnchorDate(getIsoDate(day))}>
                          View {daySchedules.length - 3} more
                        </Button>
                      )}
                    </Stack>
                  </Box>
                );
              })}
            </Box>
          </DashboardCard>
        </Stack>

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Slot details</DialogTitle>
        <DialogContent>
          <Stack spacing={2.25} sx={{ mt: 1 }}>
            <Box>
              <Typography sx={{ fontWeight: 700 }}>
                {selectedSchedule?.staff?.first_name || '-'} {selectedSchedule?.staff?.last_name || ''}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                {titleCase(selectedSchedule?.staff?.role)} | {formatDate(selectedSchedule?.work_date || null)}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                {formatTime(selectedSchedule?.start_time || null)} - {formatTime(selectedSchedule?.end_time || null)}
              </Typography>
            </Box>

            {bookingContext.children.length === 0 ? (
              <Alert severity="warning">
                No child profile is linked to this parent account yet. Please ask staff to connect your child profile first.
              </Alert>
            ) : (
              <TextField
                select
                label="Select child"
                value={selectedChildId}
                onChange={(event) => setSelectedChildId(event.target.value)}
                fullWidth
              >
                {bookingContext.children.map((child) => (
                  <MenuItem key={child.child_id} value={child.child_id}>
                    {child.first_name || '-'} {child.last_name || ''}
                  </MenuItem>
                ))}
              </TextField>
            )}

            <TextField
              select
              label="Room preference"
              value={selectedRoomId}
              onChange={(event) => setSelectedRoomId(event.target.value)}
              fullWidth
            >
              <MenuItem value="">No preference</MenuItem>
              {bookingContext.rooms.map((room) => (
                <MenuItem key={room.room_id} value={room.room_id}>
                  {room.room_name || `Room ${room.room_id}`}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
          <Button
            variant="contained"
            onClick={handleOpenConfirm}
            disabled={bookingContext.children.length === 0}
          >
            Book slot
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm booking</DialogTitle>
        <DialogContent>
          <Stack spacing={1.25} sx={{ mt: 1 }}>
            <Typography>
              Date: {formatDate(selectedSchedule?.work_date || null)}
            </Typography>
            <Typography>
              Time: {formatTime(selectedSchedule?.start_time || null)} - {formatTime(selectedSchedule?.end_time || null)}
            </Typography>
            <Typography>
              Specialist: {selectedSchedule?.staff?.first_name || '-'} {selectedSchedule?.staff?.last_name || ''}
            </Typography>
            <Typography>
              Child: {getChildLabel(bookingContext.children, selectedChildId)}
            </Typography>
            <Typography>
              Room: {getRoomLabel(bookingContext.rooms, selectedRoomId)}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)}>Back</Button>
          <Button variant="contained" onClick={handleConfirmBooking} disabled={submitting}>
            {submitting ? 'Confirming...' : 'Confirm booking'}
          </Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}

function getIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isSameUtcDay(value: string | null, compare: Date) {
  if (!value) return false;
  const date = new Date(value);
  return (
    date.getUTCFullYear() === compare.getUTCFullYear() &&
    date.getUTCMonth() === compare.getUTCMonth() &&
    date.getUTCDate() === compare.getUTCDate()
  );
}

function isSameUtcMonth(left: Date, right: Date) {
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth()
  );
}

function getWeekDays(anchorDate: Date) {
  const start = getUtcWeekStart(anchorDate);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + index);
    return day;
  });
}

function getMonthCells(anchorDate: Date) {
  const first = new Date(Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth(), 1));
  const start = getUtcWeekStart(first);
  return Array.from({ length: 35 }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + index);
    return day;
  });
}

function getUtcWeekStart(date: Date) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = value.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  value.setUTCDate(value.getUTCDate() + diff);
  return value;
}

function getSchedulesForDay(schedules: Schedule[], day: Date) {
  return schedules
    .filter((schedule) => isSameUtcDay(schedule.work_date, day))
    .sort((left, right) => String(left.start_time).localeCompare(String(right.start_time)));
}

function getHourLabel(value: string | null) {
  if (!value) return '';
  const time = formatTime(value);
  return time === '-' ? '' : `${time.slice(0, 2)}:00`;
}

function getChildLabel(children: Child[], childId: string) {
  const child = children.find((item) => String(item.child_id) === childId);
  return child ? `${child.first_name || '-'} ${child.last_name || ''}` : '-';
}

function getRoomLabel(rooms: Room[], roomId: string) {
  if (!roomId) return 'No preference';
  const room = rooms.find((item) => String(item.room_id) === roomId);
  return room?.room_name || `Room ${roomId}`;
}
