'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import {
  AutoAwesomeRounded,
  AssignmentTurnedInRounded,
  CalendarMonthRounded,
  DashboardRounded,
  Groups2Rounded,
  ManageAccountsRounded,
  PersonRounded,
  QueryStatsRounded,
} from '@mui/icons-material';
import type { SxProps, Theme } from '@mui/material/styles';

export type NavItem = {
  label: string;
  href: string;
};

type AppShellProps = {
  title: string;
  subtitle: string;
  navTitle: string;
  navItems: NavItem[];
  profileName?: string;
  profileMeta?: string;
  badge?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function AppShell({
  title,
  subtitle,
  navTitle,
  navItems,
  profileName,
  profileMeta,
  badge,
  actions,
  children,
}: AppShellProps) {
  const pathname = usePathname();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        px: { xs: 1, md: 1.25 },
        py: { xs: 1, md: 1.25 },
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(circle at 0% 0%, rgba(164, 188, 140, 0.24), transparent 28%), radial-gradient(circle at 100% 0%, rgba(206, 220, 181, 0.22), transparent 25%), radial-gradient(circle at 100% 100%, rgba(219, 198, 152, 0.2), transparent 24%)',
        },
      }}
    >
      <Box
        sx={{
          maxWidth: 1760,
          mx: 'auto',
          position: 'relative',
          minHeight: { lg: 'calc(100vh - 20px)' },
          p: { xs: 1, lg: 1.1 },
          borderRadius: { xs: '30px', lg: '28px' },
          background: 'linear-gradient(180deg, rgba(10, 14, 11, 0.98) 0%, rgba(20, 28, 22, 0.98) 100%)',
          border: '1px solid rgba(84, 106, 84, 0.18)',
          boxShadow: '0 28px 64px rgba(21, 28, 22, 0.3)',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '276px minmax(0, 1fr)' },
          gap: { xs: 1, lg: 0.9 },
          alignItems: 'stretch',
        }}
      >
        <Box
          sx={{
            p: { xs: 2, md: 2.25 },
            position: { lg: 'sticky' },
            top: { lg: 10 },
            minHeight: { lg: 'calc(100vh - 22px)' },
            display: 'flex',
            flexDirection: 'column',
            color: '#edf1e6',
            borderRadius: { xs: '24px', lg: '22px' },
            background: 'transparent',
          }}
        >
          <Box
            sx={{
              px: 1,
              py: 1.25,
              borderRadius: '22px',
              background:
                'linear-gradient(135deg, rgba(93, 121, 94, 0.48) 0%, rgba(134, 153, 102, 0.38) 100%)',
              border: '1px solid rgba(132, 153, 116, 0.24)',
            }}
          >
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '16px',
                  display: 'grid',
                  placeItems: 'center',
                  background:
                    'linear-gradient(135deg, #73966f 0%, #9eb37f 55%, #d6c28f 100%)',
                  color: '#f8f4e8',
                  boxShadow: '0 14px 30px rgba(122, 151, 110, 0.22)',
                }}
              >
                <AutoAwesomeRounded fontSize="small" />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.03em' }}>
                  {navTitle}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  ADHD clinic workspace
                </Typography>
              </Box>
            </Stack>
          </Box>

          <Stack spacing={1} sx={{ mt: 3, flex: 1 }}>
            {navItems.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(`${item.href}/`));

              return (
                <Button
                  key={item.href}
                  component={Link}
                  href={item.href}
                  fullWidth
                  startIcon={navIcon(item.label)}
                  sx={{
                    justifyContent: 'flex-start',
                    px: 1.75,
                    py: 1.3,
                    borderRadius: '16px',
                    color: active ? '#f8f4e8' : 'rgba(228, 235, 224, 0.72)',
                    background: active
                      ? 'linear-gradient(135deg, #5f8f68 0%, #7ea177 100%)'
                      : 'rgba(255, 255, 255, 0.02)',
                    border: active
                      ? '1px solid rgba(128, 163, 122, 0.88)'
                      : '1px solid rgba(255, 255, 255, 0.04)',
                    boxShadow: active
                      ? '0 14px 28px rgba(95, 143, 104, 0.28)'
                      : 'none',
                    '&:hover': {
                      background: active
                        ? 'linear-gradient(135deg, #5f8f68 0%, #7ea177 100%)'
                        : 'rgba(255, 255, 255, 0.06)',
                    },
                    '& .MuiButton-startIcon': {
                      color: active ? '#f3efdf' : 'rgba(214, 223, 209, 0.74)',
                    },
                  }}
                >
                  {item.label}
                </Button>
              );
            })}
          </Stack>

          <Divider sx={{ my: 2.25, borderColor: 'rgba(120, 140, 116, 0.18)' }} />

          <Box
            sx={{
              p: 2,
              borderRadius: '20px',
              background:
                'linear-gradient(135deg, rgba(51, 66, 53, 0.88) 0%, rgba(75, 91, 65, 0.84) 100%)',
              border: '1px solid rgba(103, 126, 99, 0.18)',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 800, color: '#d9dfc9' }}>
              Quiet mode design
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.75, color: 'rgba(225, 232, 219, 0.7)' }}>
              Clear sidebar hierarchy, softer contrast, and lightweight highlights for daily use.
            </Typography>
          </Box>
        </Box>

        <Paper
          sx={{
            ...shellPanelSx,
            position: 'relative',
            overflow: 'hidden',
            minHeight: { lg: 'calc(100vh - 20px)' },
            borderRadius: { xs: '26px', lg: '24px' },
            background:
              'linear-gradient(180deg, rgba(252, 250, 244, 0.99) 0%, rgba(246, 243, 235, 0.99) 100%)',
            border: '1px solid rgba(197, 202, 177, 0.18)',
            boxShadow: '0 18px 40px rgba(0, 0, 0, 0.08)',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: '-20% auto auto -10%',
              width: 280,
              height: 280,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(207, 217, 188, 0.18), transparent 70%)',
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              inset: 0,
              borderRadius: { xs: '26px', lg: '24px' },
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.55)',
              pointerEvents: 'none',
            },
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 2,
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              mb: 3.5,
              position: 'relative',
              zIndex: 1,
            }}
          >
            <Box>
              <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap">
                {badge && (
                  <Chip
                    label={badge}
                    sx={{
                      background: 'rgba(171, 194, 149, 0.22)',
                      color: '#4f7750',
                    }}
                  />
                )}
                <Typography variant="body2" color="primary.main" sx={{ fontWeight: 800 }}>
                  Workspace overview
                </Typography>
              </Stack>
              <Typography
                variant="h3"
                sx={{
                  mt: 1,
                  maxWidth: 780,
                  fontSize: { xs: '2rem', md: '3rem' },
                  lineHeight: 0.98,
                }}
              >
                {title}
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ mt: 1, maxWidth: 760 }}
              >
                {subtitle}
              </Typography>
            </Box>

            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
              sx={{
                ml: 'auto',
                p: 1.25,
                borderRadius: '20px',
                background: 'rgba(255, 253, 247, 0.72)',
                border: '1px solid rgba(228, 225, 212, 0.9)',
              }}
            >
              <Box sx={{ textAlign: 'right', minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {profileName || 'Clinic user'}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {profileMeta || 'Secure session'}
                </Typography>
              </Box>
              <Avatar
                sx={{
                  width: 46,
                  height: 46,
                  background:
                    'linear-gradient(135deg, #618f68 0%, #8cab7f 60%, #d7c188 100%)',
                  color: '#f8f4e8',
                  fontWeight: 700,
                  boxShadow: '0 12px 24px rgba(95, 143, 104, 0.22)',
                }}
              >
                {(profileName || 'U').slice(0, 1).toUpperCase()}
              </Avatar>
            </Stack>
          </Box>

          {actions && (
            <Box
              sx={{
                display: 'flex',
                gap: 1.25,
                flexWrap: 'wrap',
                mb: 3.25,
                position: 'relative',
                zIndex: 1,
              }}
            >
              {actions}
            </Box>
          )}

          <Box sx={{ position: 'relative', zIndex: 1 }}>{children}</Box>
        </Paper>
      </Box>
    </Box>
  );
}

export function DashboardCard({
  children,
  sx,
}: {
  children: React.ReactNode;
  sx?: SxProps<Theme>;
}) {
  return <Paper sx={[cardSx, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>{children}</Paper>;
}

export function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <DashboardCard>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h4" sx={{ mt: 1.25, fontSize: { xs: '1.9rem', md: '2.15rem' } }}>
        {value}
      </Typography>
      {helper && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          {helper}
        </Typography>
      )}
    </DashboardCard>
  );
}

export const shellPanelSx: SxProps<Theme> = {
  p: { xs: 2, md: 2.75 },
  borderRadius: '32px',
  background:
    'linear-gradient(180deg, rgba(247, 243, 231, 0.88) 0%, rgba(236, 233, 217, 0.92) 100%)',
  border: '1px solid rgba(251, 247, 237, 0.78)',
  backdropFilter: 'blur(24px)',
  boxShadow: '0 24px 60px rgba(108, 125, 90, 0.14)',
};

export const cardSx: SxProps<Theme> = {
  p: { xs: 2.25, md: 2.5 },
  borderRadius: '24px',
  background:
    'linear-gradient(180deg, rgba(253, 251, 245, 0.96) 0%, rgba(247, 244, 236, 0.96) 100%)',
  border: '1px solid rgba(200, 205, 182, 0.22)',
  boxShadow: '0 16px 32px rgba(108, 125, 90, 0.08)',
};

export function PageSkeleton() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        px: { xs: 1, md: 1.25 },
        py: { xs: 1, md: 1.25 },
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(circle at 0% 0%, rgba(164, 188, 140, 0.24), transparent 28%), radial-gradient(circle at 100% 0%, rgba(206, 220, 181, 0.22), transparent 25%), radial-gradient(circle at 100% 100%, rgba(219, 198, 152, 0.2), transparent 24%)',
        },
      }}
    >
      <Box
        sx={{
          maxWidth: 1760,
          mx: 'auto',
          position: 'relative',
          minHeight: { lg: 'calc(100vh - 20px)' },
          p: { xs: 1, lg: 1.1 },
          borderRadius: { xs: '30px', lg: '28px' },
          background: 'linear-gradient(180deg, rgba(10, 14, 11, 0.98) 0%, rgba(20, 28, 22, 0.98) 100%)',
          border: '1px solid rgba(84, 106, 84, 0.18)',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '276px minmax(0, 1fr)' },
          gap: { xs: 1, lg: 0.9 },
        }}
      >
        {/* Sidebar skeleton */}
        <Box sx={{ p: { xs: 2, md: 2.25 }, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Skeleton variant="rounded" height={64} sx={{ borderRadius: '22px', bgcolor: 'rgba(255,255,255,0.06)' }} />
          <Stack spacing={1} sx={{ mt: 1.5 }}>
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} variant="rounded" height={46} sx={{ borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.04)' }} />
            ))}
          </Stack>
        </Box>
        {/* Content skeleton */}
        <Box
          sx={{
            p: { xs: 2, md: 3 },
            borderRadius: { xs: '24px', lg: '20px' },
            background: 'rgba(240, 242, 235, 0.97)',
          }}
        >
          <Skeleton variant="text" width="40%" height={40} sx={{ mb: 1 }} />
          <Skeleton variant="text" width="60%" height={24} sx={{ mb: 3 }} />
          <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'repeat(4, 1fr)' }} gap={2} mb={3}>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} variant="rounded" height={100} sx={{ borderRadius: '16px' }} />
            ))}
          </Box>
          <Skeleton variant="rounded" height={200} sx={{ borderRadius: '16px', mb: 2 }} />
          <Skeleton variant="rounded" height={200} sx={{ borderRadius: '16px' }} />
        </Box>
      </Box>
    </Box>
  );
}

function navIcon(label: string) {
  const normalized = label.toLowerCase();

  if (normalized.includes('dashboard') || normalized.includes('overview')) {
    return <DashboardRounded fontSize="small" />;
  }
  if (normalized.includes('appoint') || normalized.includes('calendar')) {
    return <CalendarMonthRounded fontSize="small" />;
  }
  if (normalized.includes('visit') || normalized.includes('record')) {
    return <AssignmentTurnedInRounded fontSize="small" />;
  }
  if (normalized.includes('assessment')) {
    return <AssignmentTurnedInRounded fontSize="small" />;
  }
  if (normalized.includes('history') || normalized.includes('statistics')) {
    return <QueryStatsRounded fontSize="small" />;
  }
  if (normalized.includes('staff') || normalized.includes('team') || normalized.includes('role')) {
    return <Groups2Rounded fontSize="small" />;
  }
  if (normalized.includes('profile')) {
    return <PersonRounded fontSize="small" />;
  }
  if (normalized.includes('create') || normalized.includes('manage')) {
    return <ManageAccountsRounded fontSize="small" />;
  }

  return <DashboardRounded fontSize="small" />;
}
