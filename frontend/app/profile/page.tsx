'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Avatar,
  Chip,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  LogoutRounded,
  PersonRounded,
  LocalHospitalRounded,

  CalendarMonthRounded,
} from '@mui/icons-material';
import api from '@/lib/api';

interface UserProfile {
  user_id: number;
  username: string;
  user_type: string;
  is_active: boolean;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    api
      .get('/auth/profile')
      .then(({ data }) => setProfile(data))
      .catch(() => {
        localStorage.removeItem('access_token');
        router.push('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    router.push('/login');
  };

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0A0E1A',
        }}
      >
        <CircularProgress sx={{ color: '#7C4DFF' }} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(ellipse at 50% 30%, rgba(124,77,255,0.12) 0%, transparent 50%), #0A0E1A',
        px: 2,
      }}
    >
      <Card
        sx={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1 }}
      >
        <CardContent sx={{ p: 4 }}>
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Avatar
              sx={{
                width: 80,
                height: 80,
                mx: 'auto',
                mb: 2,
                background: 'linear-gradient(135deg, #7C4DFF, #448AFF)',
                boxShadow: '0 8px 24px rgba(124,77,255,0.4)',
              }}
            >
              <PersonRounded sx={{ fontSize: 40 }} />
            </Avatar>
            <Typography variant="h5" sx={{ color: '#E8EAED', mb: 0.5 }}>
              {profile?.username}
            </Typography>
            <Chip
              icon={<LocalHospitalRounded sx={{ fontSize: 16 }} />}
              label={
                profile?.user_type === 'staff' ? 'เจ้าหน้าที่' : 'ผู้ปกครอง'
              }
              sx={{
                background:
                  profile?.user_type === 'staff'
                    ? 'linear-gradient(135deg, rgba(124,77,255,0.2), rgba(68,138,255,0.2))'
                    : 'linear-gradient(135deg, rgba(0,188,212,0.2), rgba(105,240,174,0.2))',
                color: profile?.user_type === 'staff' ? '#B47CFF' : '#62EFFF',
                border: `1px solid ${profile?.user_type === 'staff' ? 'rgba(124,77,255,0.3)' : 'rgba(0,188,212,0.3)'}`,
                fontWeight: 600,
              }}
            />
          </Box>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 2.5 }} />

          {/* Details */}
          <Box sx={{ mb: 3 }}>
            <DetailRow label="User ID" value={`#${profile?.user_id}`} />
            <DetailRow label="ชื่อผู้ใช้" value={profile?.username || ''} />
            <DetailRow
              label="ประเภท"
              value={
                profile?.user_type === 'staff' ? 'เจ้าหน้าที่' : 'ผู้ปกครอง'
              }
            />
            <DetailRow
              label="สถานะ"
              value={profile?.is_active ? '✅ ใช้งานอยู่' : '❌ ปิดใช้งาน'}
            />
          </Box>

          {/* 👇 เพิ่มปุ่มจัดการนัดหมาย (สีเขียว) ตรงนี้ 👇 */}
          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={() => {
              if (profile?.user_type === 'parent') {
                router.push('/appointments/parent'); // ไปหน้าของผู้ปกครอง
              } else {
                router.push('/appointments/staff'); // ไปหน้าของเจ้าหน้าที่ (ถ้ามี)
              }
            }}
            startIcon={<CalendarMonthRounded />}
            sx={{
              py: 1.5,
              mb: 2, // เว้นระยะห่างจากปุ่มออกจากระบบด้านล่าง
              background: 'linear-gradient(135deg, #00C853 0%, #00E676 100%)', // โทนสีเขียว
              boxShadow: '0 4px 20px rgba(0,200,83,0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #00E676 0%, #69F0AE 100%)',
                boxShadow: '0 6px 28px rgba(0,200,83,0.45)',
              },
            }}
          >
            จัดการนัดหมาย
          </Button>
          {/* 👆 สิ้นสุดปุ่มใหม่ 👆 */}
          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={handleLogout}
            startIcon={<LogoutRounded />}
            sx={{
              py: 1.5,
              background: 'linear-gradient(135deg, #FF5252 0%, #FF1744 100%)',
              boxShadow: '0 4px 20px rgba(255,82,82,0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #FF6E6E 0%, #FF4444 100%)',
                boxShadow: '0 6px 28px rgba(255,82,82,0.45)',
              },
            }}
          >
            ออกจากระบบ
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        py: 1.2,
        px: 1.5,
        borderRadius: 2,
        '&:hover': { backgroundColor: 'rgba(255,255,255,0.03)' },
      }}
    >
      <Typography variant="body2" sx={{ color: '#9AA0A6' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ color: '#E8EAED', fontWeight: 500 }}>
        {value}
      </Typography>
    </Box>
  );
}
