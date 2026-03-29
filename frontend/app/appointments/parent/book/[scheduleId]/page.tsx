'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { AppShell, DashboardCard, PageSkeleton } from '@/app/components/app-shell';
import { parentNav } from '@/app/components/navigation';
import api from '@/lib/api';
import type { Profile } from '@/lib/access';
import { formatDate, formatTime, titleCase } from '@/lib/format';

type Child = {
  child_id: number;
  first_name: string | null;
  last_name: string | null;
};

type Room = {
  room_id: number;
  room_name: string | null;
};

type ScheduleDetail = {
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

type BookingContext = {
  children: Child[];
  rooms: Room[];
};

export default function BookAppointmentPage() {
  const router = useRouter();
  const params = useParams<{ scheduleId: string }>();
  const scheduleId = Number(params.scheduleId);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [schedule, setSchedule] = useState<ScheduleDetail | null>(null);
  const [context, setContext] = useState<BookingContext>({ children: [], rooms: [] });
  const [selectedChildId, setSelectedChildId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');

      try {
        const [{ data: profileData }, { data: scheduleData }, { data: contextData }] =
          await Promise.all([
            api.get<Profile>('/auth/profile'),
            api.get<ScheduleDetail>(`/appointments/schedules/${scheduleId}`),
            api.get<BookingContext>('/appointments/booking-context'),
          ]);

        setProfile(profileData);
        setSchedule(scheduleData);
        setContext(contextData);

        if (contextData.children.length > 0) {
          setSelectedChildId(String(contextData.children[0].child_id));
        }
      } catch (err: any) {
        const message = err?.response?.data?.message || 'Unable to load booking data';
        setError(Array.isArray(message) ? message.join(', ') : message);
      } finally {
        setLoading(false);
      }
    };

    if (!Number.isNaN(scheduleId)) {
      fetchData();
    }
  }, [scheduleId]);

  const handleConfirmBooking = async () => {
    setSubmitting(true);
    setError('');

    try {
      await api.post('/appointments', {
        patient_id: selectedChildId ? Number(selectedChildId) : undefined,
        schedule_id: scheduleId,
        room_id: selectedRoomId ? Number(selectedRoomId) : undefined,
      });

      router.push('/appointments/parent/history');
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
      title="Confirm Booking"
      subtitle="Review the selected slot and assign the visit to the right child profile."
      navTitle="Guardian Care"
      navItems={parentNav()}
      badge="Parent"
      profileName={profile?.username}
      profileMeta="Booking confirmation"
      actions={
        <>
          <Button variant="outlined" onClick={() => router.back()}>
            Back
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmBooking}
            disabled={submitting || context.children.length === 0}
          >
            {submitting ? 'Booking...' : 'Confirm booking'}
          </Button>
        </>
      }
    >
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Box display="grid" gridTemplateColumns={{ xs: '1fr', xl: '1fr 0.95fr' }} gap={2.5}>
          <DashboardCard>
            <Typography variant="h5">Selected schedule</Typography>
            <Stack spacing={1.25} sx={{ mt: 2.25 }}>
              <Typography>
                Specialist: {schedule?.staff?.first_name || '-'} {schedule?.staff?.last_name || ''}
              </Typography>
              <Typography color="text.secondary">Role: {titleCase(schedule?.staff?.role)}</Typography>
              <Typography color="text.secondary">Date: {formatDate(schedule?.work_date || null)}</Typography>
              <Typography color="text.secondary">
                Time: {formatTime(schedule?.start_time || null)} - {formatTime(schedule?.end_time || null)}
              </Typography>
              <Typography color="text.secondary">Slot status: {titleCase(schedule?.slot_status)}</Typography>
            </Stack>
          </DashboardCard>

          <DashboardCard>
            <Typography variant="h5">Booking details</Typography>
            <Stack spacing={2.25} sx={{ mt: 2.25 }}>
              <Alert severity="info">
                ทุกการจองต้องได้รับการยืนยันจาก admin ก่อน และต้องจองล่วงหน้าอย่างน้อย 1 ชั่วโมง
              </Alert>

              {context.children.length === 0 ? (
                <Alert severity="warning">
                  ยังไม่พบข้อมูลเด็กในบัญชีนี้ กรุณาให้แอดมินช่วยผูกข้อมูลเด็กก่อน หรือสมัครใหม่ด้วยข้อมูลผู้ปกครองและเด็กให้ครบ
                </Alert>
              ) : (
                <TextField
                  select
                  label="Select child"
                  value={selectedChildId}
                  onChange={(event) => setSelectedChildId(event.target.value)}
                  helperText="Choose who will attend this appointment."
                  fullWidth
                >
                  {context.children.map((child) => (
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
              >
                <MenuItem value="">No preference</MenuItem>
                {context.rooms.map((room) => (
                  <MenuItem key={room.room_id} value={room.room_id}>
                    {room.room_name || `Room ${room.room_id}`}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </DashboardCard>
        </Box>
    </AppShell>
  );
}
