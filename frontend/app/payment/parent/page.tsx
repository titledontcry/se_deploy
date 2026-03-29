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
  TableCell,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { AppShell, PageSkeleton, StatCard } from '@/app/components/app-shell';
import { PaginatedTableCard } from '@/app/components/paginated-table-card';
import { SearchSettingsCard } from '@/app/components/search-settings-card';
import { parentNav } from '@/app/components/navigation';
import { ReceiptDialog, type ReceiptData } from '@/app/components/receipt-dialog';
import api from '@/lib/api';
import type { Profile } from '@/lib/access';
import { formatDate, formatMoney } from '@/lib/format';

type Payment = {
  payment_id: number;
  invoice_id: number;
  visit_id: number | null;
  amount: string;
  method: string;
  status: string;
  slip_image: string | null;
  payment_date: string;
  invoice_total: string | null;
  child_name: string | null;
};

type Invoice = {
  invoice_id: number;
  visit_id: number | null;
  total_amount: string | null;
  status: string;
};

const pageSize = 8;

export default function ParentPaymentPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [unpaidInvoices, setUnpaidInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [invoicePage, setInvoicePage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);

  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [omiseQrUrl, setOmiseQrUrl] = useState<string | null>(null);
  const [omiseChargeId, setOmiseChargeId] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [{ data: profileData }, { data: paymentData }] = await Promise.all([
        api.get<Profile>('/auth/profile'),
        api.get<Payment[]>('/payment/my-payments'),
      ]);
      setProfile(profileData);
      setPayments(paymentData);

      try {
        const { data: appointments } = await api.get<any[]>('/appointments');
        const invoicePromises = appointments
          .filter((appointment) => appointment.status === 'completed')
          .map(async (appointment) => {
            try {
              const { data: visit } = await api.get<any>(`/visit/appointment/${appointment.appointment_id}`);
              const { data: invoice } = await api.get<any>(`/invoice/visit/${visit.visit_id}`);
              return invoice;
            } catch {
              return null;
            }
          });
        const invoices = (await Promise.all(invoicePromises)).filter(Boolean);
        const unpaid = invoices.filter((invoice: any) => invoice && (!invoice.status || invoice.status === 'unpaid'));
        setUnpaidInvoices(unpaid);
      } catch {
        setUnpaidInvoices([]);
      }
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Unable to load payments';
      setError(Array.isArray(message) ? message.join(', ') : message);
      if (err?.response?.status === 401) router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const filteredInvoices = useMemo(
    () =>
      unpaidInvoices.filter((invoice) =>
        `${invoice.invoice_id} ${invoice.visit_id ?? ''} ${invoice.total_amount ?? ''} ${invoice.status ?? ''}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [query, unpaidInvoices],
  );

  const filteredPayments = useMemo(
    () =>
      payments.filter((payment) => {
        const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
        const haystack = `${payment.payment_id} ${payment.invoice_id} ${payment.child_name ?? ''} ${payment.method} ${payment.status}`
          .toLowerCase();
        return matchesStatus && haystack.includes(query.toLowerCase());
      }),
    [payments, query, statusFilter],
  );

  const pagedInvoices = filteredInvoices.slice((invoicePage - 1) * pageSize, invoicePage * pageSize);
  const pagedPayments = filteredPayments.slice((paymentPage - 1) * pageSize, paymentPage * pageSize);

  const handleOpenPay = (invoice: Invoice) => {
    setSelectedInvoice(invoice);

    setOmiseQrUrl(null);
    setOmiseChargeId(null);
    setPayDialogOpen(true);
  };

  const handleGenerateQr = async () => {
    if (!selectedInvoice) return;
    setSubmitting(true);
    try {
      const { data } = await api.post('/payment/omise-charge', {
        invoiceId: selectedInvoice.invoice_id,
      });
      setOmiseQrUrl(data.qr_code_uri);
      setOmiseChargeId(data.charge_id);
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Unable to generate QR';
      window.alert(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClosePayDialog = async () => {
    setPayDialogOpen(false);
    if (omiseChargeId && selectedInvoice) {
      try {
        const { data: chargeData } = await api.get<{ status: string }>(`/payment/charge-status/${omiseChargeId}`);
        if (chargeData.status === 'successful') {
          await fetchData();

          // fetch invoice + visit data สำหรับใบเสร็จ
          try {
            const { data: invoiceData } = await api.get<any>(`/invoice/visit/${selectedInvoice.visit_id}`);
            const { data: visitData } = await api.get<any>(`/visit/${selectedInvoice.visit_id}`);
            const { data: paymentData } = await api.get<any>(`/payment/invoice/${selectedInvoice.invoice_id}`);

            const latestPayment = paymentData.payments?.[0];
            const child = visitData?.appointment?.patient;
            const doctor = visitData?.appointment?.schedule?.staff;

            setReceiptData({
              payment_id: latestPayment?.payment_id ?? 0,
              payment_date: latestPayment?.payment_date ?? new Date().toISOString(),
              invoice_id: invoiceData.invoice_id,
              total_amount: Number(invoiceData.total_amount ?? 0),
              child_name: child ? `${child.first_name} ${child.last_name}` : '-',
              visit_date: visitData?.visit_date ?? null,
              doctor_name: doctor ? `${doctor.first_name} ${doctor.last_name}` : null,
              items: (invoiceData.items ?? []).map((item: any) => ({
                description: item.description,
                qty: item.qty,
                unit_price: Number(item.unit_price ?? 0),
                amount: Number(item.amount ?? 0),
              })),
            });
            setReceiptOpen(true);
          } catch {
            setPaymentSuccess(true);
          }
        }
      } catch {
        // ไม่แสดง error ถ้าเช็ค status ไม่ได้
      }
    }
  };

  const handleViewReceipt = async (payment: Payment) => {
    if (!payment.visit_id) return;
    try {
      const [{ data: invoiceData }, { data: visitData }] = await Promise.all([
        api.get<any>(`/invoice/visit/${payment.visit_id}`),
        api.get<any>(`/visit/${payment.visit_id}`),
      ]);
      const child = visitData?.appointment?.patient;
      const doctor = visitData?.appointment?.schedule?.staff;
      setReceiptData({
        payment_id: payment.payment_id,
        payment_date: payment.payment_date,
        invoice_id: invoiceData.invoice_id,
        total_amount: Number(invoiceData.total_amount ?? 0),
        child_name: child ? `${child.first_name} ${child.last_name}` : (payment.child_name ?? '-'),
        visit_date: visitData?.visit_date ?? null,
        doctor_name: doctor ? `${doctor.first_name} ${doctor.last_name}` : null,
        items: (invoiceData.items ?? []).map((item: any) => ({
          description: item.description,
          qty: item.qty,
          unit_price: Number(item.unit_price ?? 0),
          amount: Number(item.amount ?? 0),
        })),
      });
      setReceiptOpen(true);
    } catch {
      window.alert('ไม่สามารถโหลดใบเสร็จได้');
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'success';
      case 'rejected':
        return 'error';
      default:
        return 'warning';
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'Confirmed';
      case 'rejected':
        return 'Rejected';
      default:
        return 'Pending';
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <AppShell
      title="Payments"
      subtitle="Keep unpaid invoices and payment history in clean table sections so parents can find each billing row quickly."
      navTitle="Guardian Care"
      navItems={parentNav()}
      badge="Parent"
      profileName={profile?.username}
      profileMeta="Payment records"
      actions={
        <>
          <Button variant="outlined" onClick={() => router.push('/dashboard/parent')}>
            Dashboard
          </Button>
          <Button variant="contained" onClick={() => router.push('/visits/parent')}>
            Visit records
          </Button>
        </>
      }
    >
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'repeat(4, 1fr)' }} gap={2} mb={3}>
        <StatCard label="Unpaid invoices" value={unpaidInvoices.length} helper="Invoices ready for payment" />
        <StatCard label="Total payments" value={payments.length} helper="Submitted payment rows" />
        <StatCard label="Confirmed" value={payments.filter((payment) => payment.status === 'confirmed').length} helper="Verified by staff" />
        <StatCard label="Pending" value={payments.filter((payment) => payment.status === 'pending').length} helper="Waiting for approval" />
      </Box>

      <>
          <SearchSettingsCard description="Use the filters once, then review unpaid invoices and payment history from the tables below.">
            <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'minmax(0, 1.5fr) 220px' }} gap={2}>
              <TextField
                label="Search invoices or payments"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setInvoicePage(1);
                  setPaymentPage(1);
                }}
                placeholder="Invoice id, child name, method, payment id"
                fullWidth
              />
              <TextField
                select
                label="Payment status"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPaymentPage(1);
                }}
                fullWidth
              >
                <MenuItem value="all">All statuses</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="confirmed">Confirmed</MenuItem>
                <MenuItem value="rejected">Rejected</MenuItem>
              </TextField>
            </Box>
          </SearchSettingsCard>

          <Box sx={{ mt: 2.5 }}>
            <PaginatedTableCard
              title="Unpaid invoice table"
              subtitle="Use Pay now to open the payment dialog only for the invoice you selected."
              page={invoicePage}
              pageCount={Math.max(1, Math.ceil(filteredInvoices.length / pageSize))}
              onPageChange={setInvoicePage}
              empty={filteredInvoices.length === 0}
              emptyLabel="No unpaid invoices match the current search."
              header={
                <TableRow>
                  <TableCell>Invoice</TableCell>
                  <TableCell>Visit</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              }
              body={
                <>
                  {pagedInvoices.map((invoice) => (
                    <TableRow key={invoice.invoice_id} hover>
                      <TableCell>#{invoice.invoice_id}</TableCell>
                      <TableCell>{invoice.visit_id ? `#${invoice.visit_id}` : '-'}</TableCell>
                      <TableCell align="right">{formatMoney(Number(invoice.total_amount ?? 0))}</TableCell>
                      <TableCell>
                        <Chip label={invoice.status || 'unpaid'} size="small" color="warning" />
                      </TableCell>
                      <TableCell>
                        <Button size="small" variant="contained" onClick={() => handleOpenPay(invoice)}>
                          Pay now
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              }
            />
          </Box>

          <Box sx={{ mt: 2.5 }}>
            <PaginatedTableCard
              title="Payment history table"
              subtitle="Track each submitted payment without stacking long cards down the page."
              page={paymentPage}
              pageCount={Math.max(1, Math.ceil(filteredPayments.length / pageSize))}
              onPageChange={setPaymentPage}
              empty={filteredPayments.length === 0}
              emptyLabel="No payments match the current filters."
              header={
                <TableRow>
                  <TableCell>Payment ID</TableCell>
                  <TableCell>Child</TableCell>
                  <TableCell>Invoice</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Method</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Submitted</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              }
              body={
                <>
                  {pagedPayments.map((payment) => (
                    <TableRow key={payment.payment_id} hover>
                      <TableCell>#{payment.payment_id}</TableCell>
                      <TableCell>{payment.child_name || '-'}</TableCell>
                      <TableCell>#{payment.invoice_id}</TableCell>
                      <TableCell align="right">{formatMoney(Number(payment.amount))}</TableCell>
                      <TableCell>{payment.method}</TableCell>
                      <TableCell>
                        <Chip label={statusLabel(payment.status)} size="small" color={statusColor(payment.status)} />
                      </TableCell>
                      <TableCell>{formatDate(payment.payment_date)}</TableCell>
                      <TableCell>
                        {payment.status === 'confirmed' && payment.visit_id ? (
                          <Button size="small" variant="outlined" onClick={() => handleViewReceipt(payment)}>
                            ดูใบเสร็จ
                          </Button>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              }
            />
          </Box>
        </>

      <Dialog open={payDialogOpen} onClose={handleClosePayDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Payment - Invoice #{selectedInvoice?.invoice_id}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1.5 }}>
            <Typography variant="h4" textAlign="center">
              {formatMoney(Number(selectedInvoice?.total_amount ?? 0))}
            </Typography>

            <Box textAlign="center" sx={{ mt: 3 }}>
              <Typography variant="body2" color="text.secondary" mb={1}>
                {omiseQrUrl ? 'Scan QR Code to pay via PromptPay' : 'Click "Generate QR" to get a PromptPay QR code'}
              </Typography>
              {omiseQrUrl ? (
                <Box
                  component="img"
                  src={omiseQrUrl}
                  alt="PromptPay QR Code"
                  sx={{ maxWidth: 250, width: '100%', mx: 'auto', borderRadius: 2 }}
                />
              ) : (
                <Box sx={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
                  <Typography variant="body2" color="text.secondary">QR will appear here</Typography>
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClosePayDialog}>Close</Button>
          {!omiseQrUrl && (
            <Button variant="contained" onClick={handleGenerateQr} disabled={submitting}>
              {submitting ? 'Generating...' : 'Generate QR'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={paymentSuccess} onClose={() => setPaymentSuccess(false)} maxWidth="xs" fullWidth>
        <DialogContent>
          <Box textAlign="center" sx={{ py: 3 }}>
            <Typography variant="h2" mb={1}>✓</Typography>
            <Typography variant="h6" fontWeight={600} mb={1}>ชำระเงินเสร็จแล้ว</Typography>
            <Typography variant="body2" color="text.secondary">
              การชำระเงินของคุณได้รับการยืนยันแล้ว
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
          <Button onClick={() => setPaymentSuccess(false)}>ปิด</Button>
          <Button variant="contained" onClick={() => { setPaymentSuccess(false); setReceiptOpen(true); }}>ดูใบเสร็จ</Button>
        </DialogActions>
      </Dialog>

      <ReceiptDialog
        open={receiptOpen}
        data={receiptData}
        onClose={() => setReceiptOpen(false)}
      />
    </AppShell>
  );
}
