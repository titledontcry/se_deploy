"use client";

import { useEffect, useMemo, useState } from "react";
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
import { parentNav } from "@/app/components/navigation";
import { PaginatedTableCard } from "@/app/components/paginated-table-card";
import { SearchSettingsCard } from "@/app/components/search-settings-card";
import api from "@/lib/api";
import type { Profile } from "@/lib/access";
import { formatDate, formatMoney } from "@/lib/format";

type VisitRecord = {
  visit_id: number;
  visit_date: string | null;
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
      } | null;
    }>;
  }>;
  invoices: Array<{
    invoice_id: number;
    total_amount: string | number | null;
  }>;
};

export default function ParentVisitsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const load = async () => {
      try {
        const [{ data: profileData }, { data: visitData }] = await Promise.all([
          api.get<Profile>("/auth/profile"),
          api.get<VisitRecord[]>("/visit"),
        ]);
        setProfile(profileData);
        setVisits(visitData);
      } catch (err: any) {
        if (err?.response?.status === 401) {
          localStorage.removeItem("access_token");
          router.push("/login");
          return;
        }
        const message = err?.response?.data?.message || "Unable to load visit records";
        setError(Array.isArray(message) ? message.join(", ") : message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  const totalOutstanding = useMemo(
    () =>
      visits.reduce((sum, visit) => sum + Number(visit.invoices[0]?.total_amount ?? 0), 0),
    [visits],
  );
  const totalPrescriptionLines = useMemo(
    () =>
      visits.reduce(
        (sum, visit) =>
          sum + visit.prescriptions.flatMap((prescription) => prescription.items).length,
        0,
      ),
    [visits],
  );
  const filteredVisits = useMemo(
    () =>
      visits.filter((visit) =>
        `${visit.appointment?.patient?.first_name ?? ""} ${visit.appointment?.patient?.last_name ?? ""} ${visit.appointment?.schedule?.staff?.first_name ?? ""} ${visit.appointment?.schedule?.staff?.last_name ?? ""} ${visit.prescriptions.flatMap((prescription) => prescription.items).map((item) => `${item.drug?.name ?? ""} ${item.drug?.dose ?? ""}`).join(" ")}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [query, visits],
  );

  const pageSize = 10;
  const pagedVisits = useMemo(
    () => filteredVisits.slice((page - 1) * pageSize, page * pageSize),
    [filteredVisits, page],
  );

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <AppShell
      title="Visit Records"
      subtitle="A parent-friendly visit table. Open a row to view prescriptions, treatment notes, and invoices."
      navTitle="Guardian Care"
      navItems={parentNav()}
      badge="Parent"
      profileName={profile?.username}
      profileMeta="Medical and billing records"
      actions={
        <>
          <Button variant="outlined" onClick={() => router.push("/payment/parent")}>
            Open payments
          </Button>
          <Button variant="contained" onClick={() => router.push("/dashboard/parent")}>
            Dashboard
          </Button>
        </>
      }
    >
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(4, 1fr)" }} gap={2} mb={3}>
        <StatCard label="Visit records" value={visits.length} helper="Completed visits available to review" />
        <StatCard label="Prescriptions" value={totalPrescriptionLines} helper="Medication lines visible to parents" />
        <StatCard label="With invoices" value={visits.filter((visit) => visit.invoices.length > 0).length} helper="Visits with billing details" />
        <StatCard label="Visible total" value={formatMoney(totalOutstanding)} helper="Combined amount across invoices" />
      </Box>

      <SearchSettingsCard description="Search the visit table, then open the row you want to review in detail.">
        <TextField
          fullWidth
          label="Search visit records"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="Child, specialist, medication"
        />
      </SearchSettingsCard>

      <Box sx={{ mt: 2.5 }}>
        <PaginatedTableCard
          title="Visit table"
          subtitle="Prescription and invoice stay summarized here, with full details on the next screen."
          page={page}
          pageCount={Math.ceil(filteredVisits.length / pageSize)}
          onPageChange={setPage}
          empty={filteredVisits.length === 0}
          header={
            <TableRow>
              <TableCell>Visit ID</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Child</TableCell>
              <TableCell>Prescription</TableCell>
              <TableCell>Invoice</TableCell>
              <TableCell>Specialist</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          }
          body={
            <>
              {pagedVisits.map((visit) => (
                <TableRow key={visit.visit_id} hover>
                  <TableCell>#{visit.visit_id}</TableCell>
                  <TableCell>{formatDate(visit.visit_date)}</TableCell>
                  <TableCell>{visit.appointment?.patient?.first_name || "-"} {visit.appointment?.patient?.last_name || ""}</TableCell>
                  <TableCell>
                    {visit.prescriptions.length > 0
                      ? `${visit.prescriptions.flatMap((item) => item.items).length} item(s)`
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {visit.invoices[0]
                      ? `#${visit.invoices[0].invoice_id} • ${formatMoney(visit.invoices[0].total_amount)}`
                      : "-"}
                  </TableCell>
                  <TableCell>{visit.appointment?.schedule?.staff?.first_name || "-"} {visit.appointment?.schedule?.staff?.last_name || ""}</TableCell>
                  <TableCell>
                    <Button variant="contained" onClick={() => router.push(`/visits/parent/${visit.visit_id}`)}>
                      View
                    </Button>
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
