"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  MenuItem,
  TableCell,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import type { AxiosError } from "axios";
import { AppShell, DashboardCard, PageSkeleton, StatCard } from "@/app/components/app-shell";
import { staffNav } from "@/app/components/navigation";
import { PaginatedTableCard } from "@/app/components/paginated-table-card";
import { SearchSettingsCard } from "@/app/components/search-settings-card";
import api from "@/lib/api";
import { hasRole, type Profile } from "@/lib/access";
import { formatDate, formatMoney, formatTime, titleCase } from "@/lib/format";

type ApiErrorResponse = {
  message?: string | string[];
};

type ReportsPayload = {
  staff: Array<{
    staff_id: number;
    username: string;
    first_name: string | null;
    last_name: string | null;
    role: string | null;
    status: string | null;
    is_active: boolean;
  }>;
  parents: Array<{
    parent_id: number;
    username: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    is_active: boolean;
    children: Array<{
      child_id: number;
      first_name: string | null;
      last_name: string | null;
      birth_date: string | null;
    }>;
  }>;
  drugs: Array<{
    drug_id: number;
    name: string | null;
    dose: string | null;
    unit_price: string | number | null;
  }>;
  appointments: Array<{
    appointment_id: number;
    status: string | null;
    approval_status: string | null;
    created_at: string | null;
    patient: {
      child_id: number;
      first_name: string | null;
      last_name: string | null;
    } | null;
    parent: {
      parent_id: number;
      first_name: string | null;
      last_name: string | null;
    } | null;
    room: {
      room_id: number;
      room_name: string | null;
    } | null;
    schedule: {
      schedule_id: number;
      work_date: string | null;
      start_time: string | null;
      end_time: string | null;
      slot_status: string | null;
      staff: {
        staff_id: number;
        first_name: string | null;
        last_name: string | null;
        role: string | null;
      } | null;
    } | null;
  }>;
  visits: Array<{
    visit_id: number;
    visit_date: string | null;
    appointment_id: number | null;
    patient: {
      child_id: number;
      first_name: string | null;
      last_name: string | null;
    } | null;
    parent: {
      parent_id: number;
      first_name: string | null;
      last_name: string | null;
    } | null;
    staff: {
      staff_id: number;
      first_name: string | null;
      last_name: string | null;
      role: string | null;
    } | null;
    prescription_items: Array<{
      prescription_id: number;
      prescription_item_id: number;
      quantity: number | null;
      drug_name: string | null;
      drug_dose: string | null;
    }>;
    prescription_count: number;
    latest_invoice: {
      invoice_id: number;
      total_amount: string | number | null;
      status: string | null;
      item_count: number;
      payment_count: number;
    } | null;
  }>;
};

type SectionKey =
  | "staff"
  | "parents"
  | "drugs"
  | "prescriptions"
  | "appointments"
  | "visits"
  | "invoices";

const sectionOptions: Array<{ value: SectionKey; label: string }> = [
  { value: "staff", label: "Staff" },
  { value: "parents", label: "Parents" },
  { value: "drugs", label: "Drugs" },
  { value: "prescriptions", label: "Prescriptions" },
  { value: "appointments", label: "Appointments" },
  { value: "visits", label: "Visits" },
  { value: "invoices", label: "Invoices" },
];

export default function StaffReportsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reports, setReports] = useState<ReportsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [section, setSection] = useState<SectionKey>("staff");
  const [staffRoleFilter, setStaffRoleFilter] = useState("all");
  const [staffIdFilter, setStaffIdFilter] = useState("all");
  const [parentIdFilter, setParentIdFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const load = async () => {
      try {
        const [{ data: profileData }, { data: reportData }] = await Promise.all([
          api.get<Profile>("/auth/profile"),
          api.get<ReportsPayload>("/users/staff/reports"),
        ]);
        setProfile(profileData);
        setReports(reportData);
      } catch (err: unknown) {
        const error = err as AxiosError<ApiErrorResponse>;
        if (error.response?.status === 401) {
          localStorage.removeItem("access_token");
          router.push("/login");
          return;
        }
        const message = error.response?.data?.message;
        setError(Array.isArray(message) ? message.join(", ") : (message ?? "Unable to load reports"));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  const prescriptionRows = useMemo(
    () =>
      (reports?.visits ?? []).flatMap((visit) =>
        visit.prescription_items.map((item) => ({
          visit_id: visit.visit_id,
          visit_date: visit.visit_date,
          patient: visit.patient,
          parent: visit.parent,
          staff: visit.staff,
          prescription_id: item.prescription_id,
          prescription_item_id: item.prescription_item_id,
          quantity: item.quantity,
          drug_name: item.drug_name,
          drug_dose: item.drug_dose,
        })),
      ),
    [reports],
  );

  const invoiceRows = useMemo(
    () =>
      (reports?.visits ?? [])
        .filter((visit) => visit.latest_invoice)
        .map((visit) => ({
          visit_id: visit.visit_id,
          visit_date: visit.visit_date,
          patient: visit.patient,
          parent: visit.parent,
          staff: visit.staff,
          invoice: visit.latest_invoice!,
        })),
    [reports],
  );

  const filteredStaff = useMemo(() => {
    return (reports?.staff ?? []).filter((item) => {
      const matchesRole = staffRoleFilter === "all" || item.role === staffRoleFilter;
      const matchesStaff = staffIdFilter === "all" || String(item.staff_id) === staffIdFilter;
      const haystack = `${item.username} ${item.first_name ?? ""} ${item.last_name ?? ""} ${item.role ?? ""}`.toLowerCase();
      const matchesQuery = haystack.includes(query.toLowerCase());
      return matchesRole && matchesStaff && matchesQuery;
    });
  }, [reports, query, staffIdFilter, staffRoleFilter]);

  const filteredParents = useMemo(() => {
    return (reports?.parents ?? []).filter((item) => {
      const matchesParent = parentIdFilter === "all" || String(item.parent_id) === parentIdFilter;
      const haystack = `${item.username} ${item.first_name ?? ""} ${item.last_name ?? ""} ${item.phone ?? ""} ${item.children.map((child) => `${child.first_name ?? ""} ${child.last_name ?? ""}`).join(" ")}`.toLowerCase();
      return matchesParent && haystack.includes(query.toLowerCase());
    });
  }, [reports, query, parentIdFilter]);

  const filteredDrugs = useMemo(
    () =>
      (reports?.drugs ?? []).filter((item) =>
        `${item.name ?? ""} ${item.dose ?? ""}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [reports, query],
  );

  const filteredAppointments = useMemo(() => {
    return (reports?.appointments ?? []).filter((item) => {
      const matchesStaff =
        staffIdFilter === "all" || String(item.schedule?.staff?.staff_id ?? "") === staffIdFilter;
      const matchesParent =
        parentIdFilter === "all" || String(item.parent?.parent_id ?? "") === parentIdFilter;
      const haystack = `${item.patient?.first_name ?? ""} ${item.patient?.last_name ?? ""} ${item.parent?.first_name ?? ""} ${item.parent?.last_name ?? ""} ${item.schedule?.staff?.first_name ?? ""} ${item.schedule?.staff?.last_name ?? ""} ${item.status ?? ""} ${item.approval_status ?? ""}`.toLowerCase();
      return matchesStaff && matchesParent && haystack.includes(query.toLowerCase());
    });
  }, [reports, query, parentIdFilter, staffIdFilter]);

  const filteredVisits = useMemo(() => {
    return (reports?.visits ?? []).filter((item) => {
      const matchesStaff =
        staffIdFilter === "all" || String(item.staff?.staff_id ?? "") === staffIdFilter;
      const matchesParent =
        parentIdFilter === "all" || String(item.parent?.parent_id ?? "") === parentIdFilter;
      const haystack = `${item.patient?.first_name ?? ""} ${item.patient?.last_name ?? ""} ${item.parent?.first_name ?? ""} ${item.parent?.last_name ?? ""} ${item.staff?.first_name ?? ""} ${item.staff?.last_name ?? ""}`.toLowerCase();
      return matchesStaff && matchesParent && haystack.includes(query.toLowerCase());
    });
  }, [reports, query, parentIdFilter, staffIdFilter]);

  const filteredPrescriptions = useMemo(() => {
    return prescriptionRows.filter((item) => {
      const matchesStaff =
        staffIdFilter === "all" || String(item.staff?.staff_id ?? "") === staffIdFilter;
      const matchesParent =
        parentIdFilter === "all" || String(item.parent?.parent_id ?? "") === parentIdFilter;
      const haystack = `${item.drug_name ?? ""} ${item.drug_dose ?? ""} ${item.patient?.first_name ?? ""} ${item.patient?.last_name ?? ""} ${item.parent?.first_name ?? ""} ${item.parent?.last_name ?? ""}`.toLowerCase();
      return matchesStaff && matchesParent && haystack.includes(query.toLowerCase());
    });
  }, [prescriptionRows, query, parentIdFilter, staffIdFilter]);

  const filteredInvoices = useMemo(() => {
    return invoiceRows.filter((item) => {
      const matchesStaff =
        staffIdFilter === "all" || String(item.staff?.staff_id ?? "") === staffIdFilter;
      const matchesParent =
        parentIdFilter === "all" || String(item.parent?.parent_id ?? "") === parentIdFilter;
      const haystack = `${item.patient?.first_name ?? ""} ${item.patient?.last_name ?? ""} ${item.parent?.first_name ?? ""} ${item.parent?.last_name ?? ""} ${item.invoice.status ?? ""}`.toLowerCase();
      return matchesStaff && matchesParent && haystack.includes(query.toLowerCase());
    });
  }, [invoiceRows, query, parentIdFilter, staffIdFilter]);

  const activeCount =
    section === "staff"
      ? filteredStaff.length
      : section === "parents"
        ? filteredParents.length
        : section === "drugs"
          ? filteredDrugs.length
          : section === "appointments"
            ? filteredAppointments.length
            : section === "visits"
              ? filteredVisits.length
              : section === "prescriptions"
                ? filteredPrescriptions.length
                : filteredInvoices.length;
  const pageSize = 10;

  if (loading) {
    return <PageSkeleton />;
  }

  const pagedRows =
    section === "staff"
      ? filteredStaff.slice((page - 1) * pageSize, page * pageSize)
      : section === "parents"
        ? filteredParents.slice((page - 1) * pageSize, page * pageSize)
        : section === "drugs"
          ? filteredDrugs.slice((page - 1) * pageSize, page * pageSize)
          : section === "appointments"
            ? filteredAppointments.slice((page - 1) * pageSize, page * pageSize)
            : section === "visits"
              ? filteredVisits.slice((page - 1) * pageSize, page * pageSize)
              : section === "prescriptions"
                ? filteredPrescriptions.slice((page - 1) * pageSize, page * pageSize)
                : filteredInvoices.slice((page - 1) * pageSize, page * pageSize);

  return (
    <AppShell
      title="Reports Center"
      subtitle="Choose a section from the cards above, then review the results in clean tables below."
      navTitle="Clinic Ops"
      navItems={staffNav(profile)}
      badge="Reports"
      profileName={profile?.username}
      profileMeta={hasRole(profile, ["admin"]) ? "Admin reporting access" : "Staff reporting access"}
      actions={
        <>
          <Button variant="outlined" onClick={() => router.push("/dashboard/staff")}>
            Staff overview
          </Button>
          <Button variant="contained" onClick={() => router.push("/visits/staff")}>
            Open visits
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
        <StatCard label="Staff" value={reports?.staff.length ?? 0} helper="All clinic staff" />
        <StatCard label="Parents" value={reports?.parents.length ?? 0} helper="Linked parent accounts" />
        <StatCard label="Prescriptions" value={prescriptionRows.length} helper="Medication lines across visits" />
        <StatCard label="Invoices" value={invoiceRows.length} helper="Visits with billing summaries" />
      </Box>

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", xl: "0.95fr 1.05fr" }} gap={2.5}>
        <SearchSettingsCard description="Keep every report on one page. Pick the section first, then narrow by person, role, or keyword.">
          <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "1fr 1fr" }} gap={1.5}>
            <TextField
              select
              label="Section"
              value={section}
              onChange={(event) => {
                setSection(event.target.value as SectionKey);
                setPage(1);
              }}
            >
              {sectionOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Search"
              value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search by name, username, drug, status, or role"
              />

            <TextField
              select
              label="Staff"
              value={staffIdFilter}
              onChange={(event) => {
                setStaffIdFilter(event.target.value);
                setPage(1);
              }}
            >
              <MenuItem value="all">All staff</MenuItem>
              {(reports?.staff ?? []).map((item) => (
                <MenuItem key={item.staff_id} value={String(item.staff_id)}>
                  {item.first_name || "-"} {item.last_name || ""} ({titleCase(item.role)})
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Staff role"
              value={staffRoleFilter}
              onChange={(event) => {
                setStaffRoleFilter(event.target.value);
                setPage(1);
              }}
              disabled={section !== "staff"}
            >
              <MenuItem value="all">All roles</MenuItem>
              {["admin", "doctor", "nurse", "psychologist"].map((role) => (
                <MenuItem key={role} value={role}>
                  {titleCase(role)}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Parent"
              value={parentIdFilter}
              onChange={(event) => {
                setParentIdFilter(event.target.value);
                setPage(1);
              }}
            >
              <MenuItem value="all">All parents</MenuItem>
              {(reports?.parents ?? []).map((item) => (
                <MenuItem key={item.parent_id} value={String(item.parent_id)}>
                  {item.first_name || "-"} {item.last_name || ""} ({item.username})
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </SearchSettingsCard>

        <DashboardCard>
          <Typography variant="h5">Current view</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>
            {sectionOptions.find((item) => item.value === section)?.label} table is active with {activeCount} matching row(s).
          </Typography>

          <Box
            sx={{
              mt: 2.25,
              p: 2.25,
              borderRadius: 5,
              background:
                "linear-gradient(135deg, rgba(221, 232, 207, 0.52) 0%, rgba(250, 247, 239, 0.76) 100%)",
              border: "1px solid rgba(171, 183, 145, 0.22)",
            }}
          >
            <Typography sx={{ fontWeight: 700 }}>
              {section === "staff" && "Staff directory with role filtering"}
              {section === "parents" && "Parent directory with child links"}
              {section === "drugs" && "Drug catalog with pricing"}
              {section === "prescriptions" && "Prescription lines grouped by visit context"}
              {section === "appointments" && "Appointments with parent, child, and clinician"}
              {section === "visits" && "Visit summaries with billing snapshot"}
              {section === "invoices" && "Invoice summaries for completed visits"}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              The upper card works like a compact search settings panel, and the table below updates immediately.
            </Typography>
          </Box>
        </DashboardCard>
      </Box>

      <Box sx={{ mt: 2.5 }}>
        <PaginatedTableCard
          title={`${sectionOptions.find((item) => item.value === section)?.label} table`}
          page={page}
          pageCount={Math.ceil(activeCount / pageSize)}
          onPageChange={setPage}
          empty={activeCount === 0}
          header={
            <TableRow>
                {section === "staff" && (
                  <>
                    <TableCell>Name</TableCell>
                    <TableCell>Username</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Status</TableCell>
                  </>
                )}
                {section === "parents" && (
                  <>
                    <TableCell>Name</TableCell>
                    <TableCell>Username</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Children</TableCell>
                  </>
                )}
                {section === "drugs" && (
                  <>
                    <TableCell>Drug</TableCell>
                    <TableCell>Dose</TableCell>
                    <TableCell align="right">Price</TableCell>
                  </>
                )}
                {section === "prescriptions" && (
                  <>
                    <TableCell>Visit</TableCell>
                    <TableCell>Child</TableCell>
                    <TableCell>Parent</TableCell>
                    <TableCell>Medication</TableCell>
                    <TableCell align="right">Qty</TableCell>
                  </>
                )}
                {section === "appointments" && (
                  <>
                    <TableCell>Appointment</TableCell>
                    <TableCell>Child</TableCell>
                    <TableCell>Parent</TableCell>
                    <TableCell>Staff</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Schedule</TableCell>
                  </>
                )}
                {section === "visits" && (
                  <>
                    <TableCell>Visit</TableCell>
                    <TableCell>Child</TableCell>
                    <TableCell>Parent</TableCell>
                    <TableCell>Staff</TableCell>
                    <TableCell align="right">Rx lines</TableCell>
                    <TableCell>Latest invoice</TableCell>
                  </>
                )}
                {section === "invoices" && (
                  <>
                    <TableCell>Invoice</TableCell>
                    <TableCell>Visit</TableCell>
                    <TableCell>Child</TableCell>
                    <TableCell>Parent</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Total</TableCell>
                  </>
                )}
            </TableRow>
          }
          body={
            <>
              {section === "staff" &&
                (pagedRows as typeof filteredStaff).map((item) => (
                  <TableRow key={item.staff_id} hover>
                    <TableCell>{item.first_name || "-"} {item.last_name || ""}</TableCell>
                    <TableCell>{item.username}</TableCell>
                    <TableCell>{titleCase(item.role)}</TableCell>
                    <TableCell>{item.is_active ? "Active" : "Inactive"} / {titleCase(item.status)}</TableCell>
                  </TableRow>
                ))}

              {section === "parents" &&
                (pagedRows as typeof filteredParents).map((item) => (
                  <TableRow key={item.parent_id} hover>
                    <TableCell>{item.first_name || "-"} {item.last_name || ""}</TableCell>
                    <TableCell>{item.username}</TableCell>
                    <TableCell>{item.phone || "-"}</TableCell>
                    <TableCell>{item.children.map((child) => `${child.first_name || "-"} ${child.last_name || ""}`).join(", ") || "-"}</TableCell>
                  </TableRow>
                ))}

              {section === "drugs" &&
                (pagedRows as typeof filteredDrugs).map((item) => (
                  <TableRow key={item.drug_id} hover>
                    <TableCell>{item.name || "-"}</TableCell>
                    <TableCell>{item.dose || "-"}</TableCell>
                    <TableCell align="right">{formatMoney(item.unit_price)}</TableCell>
                  </TableRow>
                ))}

              {section === "prescriptions" &&
                (pagedRows as typeof filteredPrescriptions).map((item) => (
                  <TableRow key={item.prescription_item_id} hover>
                    <TableCell>#{item.visit_id} / {formatDate(item.visit_date)}</TableCell>
                    <TableCell>{item.patient?.first_name || "-"} {item.patient?.last_name || ""}</TableCell>
                    <TableCell>{item.parent?.first_name || "-"} {item.parent?.last_name || ""}</TableCell>
                    <TableCell>{item.drug_name || "-"} {item.drug_dose ? `(${item.drug_dose})` : ""}</TableCell>
                    <TableCell align="right">{item.quantity ?? 0}</TableCell>
                  </TableRow>
                ))}

              {section === "appointments" &&
                (pagedRows as typeof filteredAppointments).map((item) => (
                  <TableRow key={item.appointment_id} hover>
                    <TableCell>#{item.appointment_id}</TableCell>
                    <TableCell>{item.patient?.first_name || "-"} {item.patient?.last_name || ""}</TableCell>
                    <TableCell>{item.parent?.first_name || "-"} {item.parent?.last_name || ""}</TableCell>
                    <TableCell>{item.schedule?.staff?.first_name || "-"} {item.schedule?.staff?.last_name || ""} {item.schedule?.staff?.role ? `(${titleCase(item.schedule.staff.role)})` : ""}</TableCell>
                    <TableCell>{titleCase(item.status)} / {titleCase(item.approval_status)}</TableCell>
                    <TableCell>{formatDate(item.schedule?.work_date || null)} {formatTime(item.schedule?.start_time || null)}-{formatTime(item.schedule?.end_time || null)}</TableCell>
                  </TableRow>
                ))}

              {section === "visits" &&
                (pagedRows as typeof filteredVisits).map((item) => (
                  <TableRow key={item.visit_id} hover>
                    <TableCell>#{item.visit_id} / {formatDate(item.visit_date)}</TableCell>
                    <TableCell>{item.patient?.first_name || "-"} {item.patient?.last_name || ""}</TableCell>
                    <TableCell>{item.parent?.first_name || "-"} {item.parent?.last_name || ""}</TableCell>
                    <TableCell>{item.staff?.first_name || "-"} {item.staff?.last_name || ""} {item.staff?.role ? `(${titleCase(item.staff.role)})` : ""}</TableCell>
                    <TableCell align="right">{item.prescription_count}</TableCell>
                    <TableCell>{item.latest_invoice ? `#${item.latest_invoice.invoice_id} • ${formatMoney(item.latest_invoice.total_amount)}` : "-"}</TableCell>
                  </TableRow>
                ))}

              {section === "invoices" &&
                (pagedRows as typeof filteredInvoices).map((item) => (
                  <TableRow key={item.invoice.invoice_id} hover>
                    <TableCell>#{item.invoice.invoice_id}</TableCell>
                    <TableCell>#{item.visit_id} / {formatDate(item.visit_date)}</TableCell>
                    <TableCell>{item.patient?.first_name || "-"} {item.patient?.last_name || ""}</TableCell>
                    <TableCell>{item.parent?.first_name || "-"} {item.parent?.last_name || ""}</TableCell>
                    <TableCell>{titleCase(item.invoice.status)}</TableCell>
                    <TableCell align="right">{formatMoney(item.invoice.total_amount)}</TableCell>
                  </TableRow>
                ))}

            </>
          }
        />
      </Box>
    </AppShell>
  );
}
