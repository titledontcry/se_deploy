"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  TableCell,
  TableRow,
  TextField,
} from "@mui/material";
import type { AxiosError } from "axios";
import { AppShell, PageSkeleton, StatCard } from "@/app/components/app-shell";
import { staffNav } from "@/app/components/navigation";
import { PaginatedTableCard } from "@/app/components/paginated-table-card";
import { SearchSettingsCard } from "@/app/components/search-settings-card";
import api from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { Profile } from "@/lib/access";

type DrugItem = {
  drug_id: number;
  name: string | null;
  dose: string | null;
  unit_price: string | number | null;
};

type ApiErrorResponse = {
  message?: string | string[];
};

export default function AdminDrugsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [drugs, setDrugs] = useState<DrugItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    name: "",
    dose: "",
    unit_price: "",
  });

  const load = useCallback(async () => {
    try {
      const [{ data: profileData }, { data: drugData }] = await Promise.all([
        api.get<Profile>("/auth/profile"),
        api.get<DrugItem[]>("/drug"),
      ]);
      setProfile(profileData);
      setDrugs(drugData);
    } catch (err: unknown) {
      const error = err as AxiosError<ApiErrorResponse>;
      if (error.response?.status === 401) {
        localStorage.removeItem("access_token");
        router.push("/login");
        return;
      }
      const message = error.response?.data?.message;
      setError(
        Array.isArray(message)
          ? message.join(", ")
          : (message ?? "Unable to load drug catalog"),
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredDrugs = useMemo(
    () =>
      drugs.filter((item) =>
        `${item.name ?? ""} ${item.dose ?? ""}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [drugs, query],
  );
  const pageSize = 10;
  const pagedDrugs = useMemo(
    () => filteredDrugs.slice((page - 1) * pageSize, page * pageSize),
    [filteredDrugs, page],
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.post("/drug", {
        name: form.name,
        dose: form.dose || undefined,
        unit_price: Number(form.unit_price),
      });
      setForm({ name: "", dose: "", unit_price: "" });
      setSuccess("Drug added to catalog");
      await load();
    } catch (err: unknown) {
      const error = err as AxiosError<ApiErrorResponse>;
      const message = error.response?.data?.message;
      setError(Array.isArray(message) ? message.join(", ") : (message ?? "Unable to add drug"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <AppShell
      title="Drug Catalog"
      subtitle="Keep pricing manageable with a compact add form above and a searchable table below."
      navTitle="Clinic Ops"
      navItems={staffNav(profile)}
      badge="Admin"
      profileName={profile?.username}
      profileMeta="Drug pricing"
      actions={
        <Button variant="outlined" onClick={() => router.push("/reports/staff")}>
          Open reports
        </Button>
      }
    >
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(3, 1fr)" }} gap={2} mb={3}>
        <StatCard label="Total drugs" value={drugs.length} />
        <StatCard label="Priced items" value={drugs.filter((item) => Number(item.unit_price ?? 0) > 0).length} />
        <StatCard
          label="Average price"
          value={drugs.length > 0 ? formatMoney(drugs.reduce((sum, item) => sum + Number(item.unit_price ?? 0), 0) / drugs.length) : formatMoney(0)}
        />
      </Box>

      <SearchSettingsCard title="Catalog controls" description="Add new drugs here, then search the catalog in the same workspace.">
        <Box display="grid" gridTemplateColumns={{ xs: "1fr", xl: "1.15fr 0.85fr" }} gap={1.5}>
          <TextField
            label="Search drugs"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Drug name or dose"
          />
          <Box component="form" onSubmit={handleSubmit} display="grid" gridTemplateColumns={{ xs: "1fr", sm: "1fr 1fr 140px auto" }} gap={1}>
            <TextField label="Drug name" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required />
            <TextField label="Dose / size" value={form.dose} onChange={(event) => setForm((prev) => ({ ...prev, dose: event.target.value }))} />
            <TextField label="Price" type="number" value={form.unit_price} onChange={(event) => setForm((prev) => ({ ...prev, unit_price: event.target.value }))} inputProps={{ min: 0, step: "0.01" }} required />
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? "Saving..." : "Add"}
            </Button>
          </Box>
        </Box>
      </SearchSettingsCard>

      <Box sx={{ mt: 2.5 }}>
        <PaginatedTableCard
          title="Drug table"
          subtitle="The catalog stays compact even when the number of medicines grows."
          page={page}
          pageCount={Math.ceil(filteredDrugs.length / pageSize)}
          onPageChange={setPage}
          empty={filteredDrugs.length === 0}
          header={
            <TableRow>
              <TableCell>Drug</TableCell>
              <TableCell>Dose</TableCell>
              <TableCell align="right">Price</TableCell>
            </TableRow>
          }
          body={
            <>
              {pagedDrugs.map((drug) => (
                <TableRow key={drug.drug_id} hover>
                  <TableCell>{drug.name || "-"}</TableCell>
                  <TableCell>{drug.dose || "-"}</TableCell>
                  <TableCell align="right">{formatMoney(Number(drug.unit_price ?? 0))}</TableCell>
                </TableRow>
              ))}
            </>
          }
        />
      </Box>
    </AppShell>
  );
}
