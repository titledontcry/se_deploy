"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { AppShell, DashboardCard, PageSkeleton, StatCard } from "@/app/components/app-shell";
import { parentNav } from "@/app/components/navigation";
import api from "@/lib/api";
import type { Profile } from "@/lib/access";
import { formatDate, formatMoney } from "@/lib/format";

type VisitRecord = {
  visit_id: number;
  visit_date: string | null;
  diagnoses: Array<{ diagnose_id: number; diagnosis_text: string | null }>;
  treatment_plans: Array<{ plan_id: number; plan_detail: string | null }>;
  appointment: {
    patient: {
      first_name: string | null;
      last_name: string | null;
    } | null;
    schedule: {
      staff: {
        first_name: string | null;
        last_name: string | null;
        role: string | null;
      } | null;
    } | null;
  } | null;
  prescriptions: Array<{
    prescription_id: number;
    items: Array<{
      prescription_item_id: number;
      quantity: number | null;
      drug: {
        name: string | null;
        dose: string | null;
        unit_price: string | number | null;
      } | null;
    }>;
  }>;
  invoices: Array<{
    invoice_id: number;
    total_amount: string | number | null;
    items: Array<{
      invoice_item_id: number;
      item_type: string;
      description: string;
      qty: number;
      unit_price: string | number | null;
      amount: string | number | null;
    }>;
  }>;
};

export default function ParentVisitDetailPage() {
  const params = useParams<{ visitId: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [visit, setVisit] = useState<VisitRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [{ data: profileData }, { data: visitData }] = await Promise.all([
          api.get<Profile>("/auth/profile"),
          api.get<VisitRecord>(`/visit/${params.visitId}`),
        ]);
        setProfile(profileData);
        setVisit(visitData);
      } catch (err: any) {
        if (err?.response?.status === 401) {
          localStorage.removeItem("access_token");
          router.push("/login");
          return;
        }
        const message = err?.response?.data?.message || "Unable to load visit record";
        setError(Array.isArray(message) ? message.join(", ") : message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [params.visitId, router]);

  const prescriptionItems = useMemo(
    () => visit?.prescriptions.flatMap((prescription) => prescription.items) ?? [],
    [visit],
  );
  const invoice = visit?.invoices[0] ?? null;

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <AppShell
      title="Visit Details"
      subtitle="Review the full visit, prescription, and invoice from one dedicated detail page."
      navTitle="Guardian Care"
      navItems={parentNav()}
      badge="Visit"
      profileName={profile?.username}
      profileMeta="Visit detail"
      actions={
        <>
          <Button variant="outlined" onClick={() => router.push("/visits/parent")}>
            Back to visit table
          </Button>
          <Button variant="contained" onClick={() => router.push("/payment/parent")}>
            Open payments
          </Button>
        </>
      }
    >
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {!visit ? null : (
        <>
          <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(4, 1fr)" }} gap={2} mb={3}>
            <StatCard label="Visit ID" value={`#${visit.visit_id}`} />
            <StatCard label="Visit date" value={formatDate(visit.visit_date)} />
            <StatCard label="Prescription lines" value={prescriptionItems.length} />
            <StatCard label="Invoice total" value={formatMoney(invoice?.total_amount ?? 0)} />
          </Box>

          <DashboardCard>
            <Typography variant="h5">
              {visit.appointment?.patient?.first_name || "-"} {visit.appointment?.patient?.last_name || ""}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              Specialist: {visit.appointment?.schedule?.staff?.first_name || "-"} {visit.appointment?.schedule?.staff?.last_name || ""}
            </Typography>

            <Divider sx={{ my: 2.25 }} />

            <Typography variant="h6">Prescription / ใบสั่งยา</Typography>
            <Stack spacing={1} sx={{ mt: 1.5 }}>
              {prescriptionItems.length > 0 ? (
                prescriptionItems.map((item) => (
                  <Box
                    key={item.prescription_item_id}
                    sx={{
                      p: 1.5,
                      borderRadius: 3,
                      background: "rgba(255,255,255,0.58)",
                      border: "1px solid rgba(122, 156, 156, 0.12)",
                    }}
                  >
                    <Typography sx={{ fontWeight: 700 }}>
                      {item.drug?.name || "Medication"}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                      Dose: {item.drug?.dose || "-"}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.25 }}>
                      Quantity: {item.quantity ?? 1}
                    </Typography>
                  </Box>
                ))
              ) : (
                <Typography color="text.secondary">No prescription</Typography>
              )}
            </Stack>

            <Divider sx={{ my: 2.25 }} />

            <Box display="grid" gridTemplateColumns={{ xs: "1fr", xl: "repeat(2, 1fr)" }} gap={2}>
              <Box>
                <Typography sx={{ fontWeight: 700 }}>Diagnosis</Typography>
                <Stack spacing={0.75} sx={{ mt: 1.25 }}>
                  {visit.diagnoses.length > 0 ? (
                    visit.diagnoses.map((item) => (
                      <Typography key={item.diagnose_id} color="text.secondary">
                        {item.diagnosis_text || "-"}
                      </Typography>
                    ))
                  ) : (
                    <Typography color="text.secondary">No diagnosis note</Typography>
                  )}
                </Stack>
              </Box>

              <Box>
                <Typography sx={{ fontWeight: 700 }}>Treatment plan</Typography>
                <Stack spacing={0.75} sx={{ mt: 1.25 }}>
                  {visit.treatment_plans.length > 0 ? (
                    visit.treatment_plans.map((item) => (
                      <Typography key={item.plan_id} color="text.secondary">
                        {item.plan_detail || "-"}
                      </Typography>
                    ))
                  ) : (
                    <Typography color="text.secondary">No treatment plan</Typography>
                  )}
                </Stack>
              </Box>
            </Box>

            <Divider sx={{ my: 2.25 }} />

            <Typography sx={{ fontWeight: 700 }}>Billing details</Typography>
            <Stack spacing={1.25} sx={{ mt: 1.5 }}>
              {invoice?.items?.length ? (
                invoice.items.map((item) => (
                  <Box
                    key={item.invoice_item_id}
                    display="flex"
                    justifyContent="space-between"
                    gap={2}
                    flexWrap="wrap"
                    sx={{
                      p: 2,
                      borderRadius: 4,
                      background: "rgba(255,255,255,0.56)",
                      border: "1px solid rgba(122, 156, 156, 0.14)",
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontWeight: 700 }}>{item.description}</Typography>
                      <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                        {item.item_type} | Qty {item.qty} x {formatMoney(item.unit_price)}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontWeight: 700 }}>{formatMoney(item.amount)}</Typography>
                  </Box>
                ))
              ) : (
                <Typography color="text.secondary">No invoice items yet</Typography>
              )}
            </Stack>
          </DashboardCard>
        </>
      )}
    </AppShell>
  );
}
