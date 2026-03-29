'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Chip,
  Link,
  TableCell,
  TableRow,
  TextField,
} from '@mui/material';
import { AppShell, PageSkeleton, StatCard } from '@/app/components/app-shell';
import { PaginatedTableCard } from '@/app/components/paginated-table-card';
import { SearchSettingsCard } from '@/app/components/search-settings-card';
import { staffNav } from '@/app/components/navigation';
import api from '@/lib/api';
import type { Profile } from '@/lib/access';
import { formatDate, formatMoney } from '@/lib/format';

type PendingPayment = {
  payment_id: number;
  invoice_id: number;
  amount: string;
  method: string;
  status: string;
  slip_image: string | null;
  payment_date: string;
  invoice_total: string | null;
  child_name: string | null;
  visit_date: string | null;
};

const pageSize = 8;

export default function StaffPaymentPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [{ data: profileData }, { data: paymentData }] = await Promise.all([
        api.get<Profile>('/auth/profile'),
        api.get<PendingPayment[]>('/payment/pending'),
      ]);
      setProfile(profileData);
      setPayments(paymentData);
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Unable to load pending payments';
      setError(Array.isArray(message) ? message.join(', ') : message);
      if (err?.response?.status === 401) router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const filteredPayments = useMemo(
    () =>
      payments.filter((payment) =>
        `${payment.child_name ?? ''} ${payment.invoice_id} ${payment.method} ${payment.status} ${payment.payment_id}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [payments, query],
  );

  const pagedPayments = filteredPayments.slice((page - 1) * pageSize, page * pageSize);

  const handleVerify = async (paymentId: number, action: 'confirmed' | 'rejected') => {
    const label = action === 'confirmed' ? 'confirm' : 'reject';
    if (!window.confirm(`Are you sure you want to ${label} this payment?`)) return;

    setProcessing(paymentId);
    try {
      await api.patch(`/payment/${paymentId}/verify`, { action });
      await fetchData();
    } catch (err: any) {
      const message = err?.response?.data?.message || `Unable to ${label} payment`;
      window.alert(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <AppShell
      title="Payment Verification"
      subtitle="Keep slip review compact at the top, then verify each submitted payment from the table below."
      navTitle="Guardian Care"
      navItems={staffNav(profile)}
      badge="Staff"
      profileName={profile?.username}
      profileMeta="Payment management"
      actions={
        <Button variant="outlined" onClick={() => router.push('/dashboard/staff')}>
          Dashboard
        </Button>
      }
    >
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'repeat(3, 1fr)' }} gap={2} mb={3}>
        <StatCard label="Pending payments" value={payments.length} helper="Rows waiting for staff review" />
        <StatCard
          label="Pending amount"
          value={formatMoney(payments.reduce((sum, payment) => sum + Number(payment.amount), 0))}
          helper="Combined amount from unverified slips"
        />
        <StatCard
          label="With slip"
          value={payments.filter((payment) => Boolean(payment.slip_image)).length}
          helper="Rows that already include uploaded evidence"
        />
      </Box>

      <>
          <SearchSettingsCard description="Search by child, invoice, payment method, or payment id before verifying the row you need.">
            <Box
              display="grid"
              gridTemplateColumns={{ xs: '1fr', md: 'minmax(0, 380px)' }}
              gap={2}
            >
              <TextField
                label="Search payments"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Child name, invoice id, method, payment id"
                fullWidth
              />
            </Box>
          </SearchSettingsCard>

          <Box sx={{ mt: 2.5 }}>
            <PaginatedTableCard
              title="Pending payment table"
              subtitle="Open the slip only when needed, then confirm or reject directly from the same row."
              page={page}
              pageCount={Math.max(1, Math.ceil(filteredPayments.length / pageSize))}
              onPageChange={setPage}
              empty={filteredPayments.length === 0}
              emptyLabel="No pending payments match the current search."
              header={
                <TableRow>
                  <TableCell>Payment ID</TableCell>
                  <TableCell>Child</TableCell>
                  <TableCell>Invoice</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell align="right">Invoice total</TableCell>
                  <TableCell>Payment date</TableCell>
                  <TableCell>Slip</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              }
              body={
                <>
                  {pagedPayments.map((payment) => (
                    <TableRow key={payment.payment_id} hover>
                      <TableCell>#{payment.payment_id}</TableCell>
                      <TableCell>{payment.child_name || '-'}</TableCell>
                      <TableCell>
                        <Box>
                          #{payment.invoice_id}
                          {payment.visit_date ? ` | Visit ${formatDate(payment.visit_date)}` : ''}
                        </Box>
                      </TableCell>
                      <TableCell align="right">{formatMoney(Number(payment.amount))}</TableCell>
                      <TableCell align="right">{formatMoney(Number(payment.invoice_total ?? 0))}</TableCell>
                      <TableCell>{formatDate(payment.payment_date)}</TableCell>
                      <TableCell>
                        {payment.slip_image ? (
                          <Link href={payment.slip_image} target="_blank" rel="noreferrer" underline="hover">
                            Open slip
                          </Link>
                        ) : (
                          <Chip label="No slip" size="small" color="warning" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Box display="flex" gap={1} flexWrap="wrap">
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            disabled={processing === payment.payment_id}
                            onClick={() => handleVerify(payment.payment_id, 'confirmed')}
                          >
                            Confirm
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            disabled={processing === payment.payment_id}
                            onClick={() => handleVerify(payment.payment_id, 'rejected')}
                          >
                            Reject
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              }
            />
          </Box>
        </>
    </AppShell>
  );
}
