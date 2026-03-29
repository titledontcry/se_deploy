"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { AxiosError } from "axios";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { AppShell, DashboardCard, StatCard } from "@/app/components/app-shell";
import { staffNav } from "@/app/components/navigation";
import api from "@/lib/api";
import { formatDate, formatTime, titleCase } from "@/lib/format";
import { getEffectiveRoles, hasRole, type Profile } from "@/lib/access";

type ApiErrorResponse = {
  message?: string | string[];
};

type Appointment = {
  appointment_id: number;
  status: string | null;
  approval_status?: string | null;
  patient_id?: number | null;
  child: {
    child_id?: number;
    first_name: string | null;
    last_name: string | null;
  } | null;
  booked_by: {
    parent: Array<{
      first_name: string | null;
      last_name: string | null;
    }>;
  } | null;
  work_schedules: {
    work_date: string | null;
    start_time: string | null;
    end_time: string | null;
    staff: {
      first_name: string | null;
      last_name: string | null;
      role: string | null;
    } | null;
  } | null;
};

type DrugOption = {
  drug_id: number;
  name: string | null;
  dose: string | null;
  unit_price: string | number | null;
};

type VisitRecord = {
  visit_id: number;
  appointment_id: number | null;
  visit_date: string | null;
  vital_signs: {
    weight_kg: number | null;
    height_cm: number | null;
    bp_systolic: number | null;
    bp_diastolic: number | null;
    heart_rate: number | null;
    note: string | null;
  } | null;
  diagnoses: Array<{
    diagnose_id: number;
    diagnosis_text: string | null;
  }>;
  treatment_plans: Array<{
    plan_id: number;
    plan_detail: string | null;
  }>;
  appointment: {
    appointment_id: number;
    status: string | null;
    approval_status?: string | null;
    patient_id: number | null;
    patient: {
      child_id: number;
      first_name: string | null;
      last_name: string | null;
      birth_date: string | null;
    } | null;
    booked_by?: {
      user_id?: number;
      username?: string | null;
      parent?: Array<{
        first_name: string | null;
        last_name: string | null;
      }>;
    } | null;
    room: {
      room_name: string | null;
    } | null;
    schedule: {
      work_date: string | null;
      start_time: string | null;
      end_time: string | null;
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
      drug_id: number | null;
      quantity: number | null;
      drug: DrugOption | null;
    }>;
  }>;
  invoices: Array<{
    invoice_id: number;
    visit_id: number | null;
    total_amount: string | number | null;
    items: Array<{
      invoice_item_id: number;
      item_type: string;
      description: string;
      qty: number;
      unit_price: string | number | null;
      amount: string | number | null;
      prescription_item_id: number | null;
      drug_name: string | null;
      drug_dose: string | null;
    }>;
    payments: Array<{
      payment_id: number;
      amount: string | number | null;
      payment_date: string | null;
    }>;
  }>;
};

type VisitFormState = {
  appointment_id: string;
  visit_date: string;
  weight_kg: string;
  height_cm: string;
  bp_systolic: string;
  bp_diastolic: string;
  heart_rate: string;
  note: string;
  diagnoses: string;
  treatment_plans: string;
  service_items: Array<{
    id: string;
    description: string;
    qty: string;
    unit_price: string;
  }>;
};

type PrescriptionFormItem = {
  id: string;
  drug_id: string;
  quantity: string;
};

const emptyForm: VisitFormState = {
  appointment_id: "",
  visit_date: "",
  weight_kg: "",
  height_cm: "",
  bp_systolic: "",
  bp_diastolic: "",
  heart_rate: "",
  note: "",
  diagnoses: "",
  treatment_plans: "",
  service_items: [createServiceItem()],
};

export default function StaffVisitsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedAppointmentId = searchParams.get("appointmentId") ?? "";
  const [profile, setProfile] = useState<Profile | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [drugs, setDrugs] = useState<DrugOption[]>([]);
  const [selectedVisitId, setSelectedVisitId] = useState<number | null>(null);
  const [form, setForm] = useState<VisitFormState>(emptyForm);
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionFormItem[]>([
    createPrescriptionItem(),
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [appointmentQuery, setAppointmentQuery] = useState("");
  const [visitQuery, setVisitQuery] = useState("");
  const [appointmentPage, setAppointmentPage] = useState(1);
  const [visitPage, setVisitPage] = useState(1);

  const canManageVisits = hasRole(profile, ["admin", "nurse", "doctor", "psychologist"]);
  const canManageTreatmentPricing = hasRole(profile, ["admin"]);
  const pageSize = 4;

  const visitMap = useMemo(
    () =>
      new Map(
        visits
          .filter((item) => item.appointment_id !== null)
          .map((item) => [item.appointment_id as number, item]),
      ),
    [visits],
  );

  const availableAppointments = useMemo(
    () =>
      appointments.filter(
        (appointment) =>
          appointment.status !== "cancelled" &&
          appointment.approval_status === "approved" &&
          (!visitMap.has(appointment.appointment_id) ||
            visitMap.get(appointment.appointment_id)?.visit_id === selectedVisitId),
      ),
    [appointments, visitMap, selectedVisitId],
  );

  const selectedVisit = useMemo(
    () => visits.find((item) => item.visit_id === selectedVisitId) ?? null,
    [visits, selectedVisitId],
  );

  const currentInvoice = selectedVisit?.invoices[0] ?? null;
  const filteredAppointments = useMemo(
    () =>
      appointments.filter((appointment) =>
        `${appointment.child?.first_name ?? ""} ${appointment.child?.last_name ?? ""} ${appointment.booked_by?.parent?.[0]?.first_name ?? ""} ${appointment.booked_by?.parent?.[0]?.last_name ?? ""} ${appointment.work_schedules?.staff?.first_name ?? ""} ${appointment.work_schedules?.staff?.last_name ?? ""} ${appointment.status ?? ""} ${appointment.approval_status ?? ""}`.toLowerCase().includes(appointmentQuery.toLowerCase()),
      ),
    [appointmentQuery, appointments],
  );
  const filteredVisits = useMemo(
    () =>
      [...visits]
        .filter((visit) =>
          `${visit.appointment?.patient?.first_name ?? ""} ${visit.appointment?.patient?.last_name ?? ""} ${visit.appointment?.booked_by?.parent?.[0]?.first_name ?? ""} ${visit.appointment?.booked_by?.parent?.[0]?.last_name ?? ""}`
            .toLowerCase()
            .includes(visitQuery.toLowerCase()),
        )
        .sort((left, right) => {
          const leftTime = left.visit_date ? new Date(left.visit_date).getTime() : 0;
          const rightTime = right.visit_date ? new Date(right.visit_date).getTime() : 0;
          return rightTime - leftTime;
        }),
    [visitQuery, visits],
  );
  const pagedAppointments = useMemo(
    () =>
      filteredAppointments.slice(
        (appointmentPage - 1) * pageSize,
        appointmentPage * pageSize,
      ),
    [appointmentPage, filteredAppointments],
  );
  const pagedVisits = useMemo(
    () => filteredVisits.slice((visitPage - 1) * pageSize, visitPage * pageSize),
    [filteredVisits, visitPage],
  );

  const selectedAppointment = useMemo(() => {
    const appointmentId = Number(form.appointment_id);
    const appointment = appointments.find((item) => item.appointment_id === appointmentId);

    if (appointment) {
      return appointment;
    }

    if (!selectedVisit?.appointment) {
      return null;
    }

    return {
      appointment_id: selectedVisit.appointment.appointment_id,
      status: selectedVisit.appointment.status,
      approval_status: selectedVisit.appointment.approval_status,
      patient_id: selectedVisit.appointment.patient_id,
      child: selectedVisit.appointment.patient,
      booked_by: selectedVisit.appointment.booked_by,
      work_schedules: selectedVisit.appointment.schedule,
    };
  }, [appointments, form.appointment_id, selectedVisit]);

  const selectVisit = useCallback((visit: VisitRecord) => {
    setSelectedVisitId(visit.visit_id);
    setSuccess("");
    setError("");
    setForm(toFormState(visit));
    setPrescriptionItems(toPrescriptionFormState(visit));
  }, []);

  const resetEditor = useCallback((appointmentId = requestedAppointmentId) => {
    setSelectedVisitId(null);
    setSuccess("");
    setError("");
    setForm({
      ...emptyForm,
      appointment_id: appointmentId || "",
      visit_date: localDateTimeString(),
    });
    setPrescriptionItems([createPrescriptionItem()]);
  }, [requestedAppointmentId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const [
          { data: profileData },
          { data: appointmentData },
          { data: visitData },
          { data: drugData },
        ] =
          await Promise.all([
            api.get<Profile>("/auth/profile"),
            api.get<Appointment[]>("/appointments"),
            api.get<VisitRecord[]>("/visit"),
            api.get<DrugOption[]>("/drug"),
          ]);

        setProfile(profileData);
        setAppointments(appointmentData);
        setVisits(visitData);
        setDrugs(drugData);

        const preselectedVisit = requestedAppointmentId
          ? visitData.find((item) => String(item.appointment_id) === requestedAppointmentId)
          : null;

        if (preselectedVisit) {
          selectVisit(preselectedVisit);
          return;
        }

        resetEditor(requestedAppointmentId);
      } catch (err: unknown) {
        const error = err as AxiosError<ApiErrorResponse>;

        if (error.response?.status === 401) {
          localStorage.removeItem("access_token");
          router.push("/login");
          return;
        }

        setError(normalizeError(error, "Unable to load visit records"));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [requestedAppointmentId, resetEditor, router, selectVisit]);

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePrescriptionChange = (
    index: number,
    key: "drug_id" | "quantity",
    value: string,
  ) => {
    setPrescriptionItems((prev) =>
      prev.map((item, currentIndex) =>
        currentIndex === index ? { ...item, [key]: value } : item,
      ),
    );
  };

  const addPrescriptionRow = () => {
    setPrescriptionItems((prev) => [...prev, createPrescriptionItem()]);
  };

  const removePrescriptionRow = (index: number) => {
    setPrescriptionItems((prev) => {
      if (prev.length === 1) {
        return [createPrescriptionItem()];
      }

      return prev.filter((_, currentIndex) => currentIndex !== index);
    });
  };

  const handleServiceItemChange = (
    index: number,
    key: "description" | "qty" | "unit_price",
    value: string,
  ) => {
    setForm((prev) => ({
      ...prev,
      service_items: prev.service_items.map((item, currentIndex) =>
        currentIndex === index ? { ...item, [key]: value } : item,
      ),
    }));
  };

  const addServiceItem = () => {
    setForm((prev) => ({
      ...prev,
      service_items: [...prev.service_items, createServiceItem()],
    }));
  };

  const removeServiceItem = (index: number) => {
    setForm((prev) => ({
      ...prev,
      service_items:
        prev.service_items.length === 1
          ? [createServiceItem()]
          : prev.service_items.filter((_, currentIndex) => currentIndex !== index),
    }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = buildPayload(form, prescriptionItems, canManageTreatmentPricing);

      if (selectedVisitId) {
        await api.patch(`/visit/${selectedVisitId}`, payload);
        setSuccess("Visit, medication, and invoice updated");
      } else {
        await api.post("/visit", payload);
        setSuccess("Visit, medication, and invoice created");
      }

      const { data: visitData } = await api.get<VisitRecord[]>("/visit");
      setVisits(visitData);

      const currentVisit =
        selectedVisitId
          ? visitData.find((item) => item.visit_id === selectedVisitId)
          : visitData.find((item) => item.appointment_id === payload.appointment_id);

      if (currentVisit) {
        selectVisit(currentVisit);
      }
    } catch (err: unknown) {
      const error = err as AxiosError<ApiErrorResponse>;
      setError(normalizeError(error, "Unable to save visit record"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box minHeight="100vh" display="grid" sx={{ placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <AppShell
      title="Visit Record Workspace"
      subtitle="ดู appointment ทั้งหมด, appointment ที่ผ่านมา, สร้าง visit record และสรุปบิลได้ในหน้าเดียว."
      navTitle="Clinic Ops"
      navItems={staffNav(profile)}
      badge="Visit"
      profileName={profile?.username}
      profileMeta={getEffectiveRoles(profile).join(", ") || "Clinic team"}
      actions={
        <>
          <Button variant="contained" onClick={() => resetEditor()}>
            New visit record
          </Button>
          <Button variant="outlined" onClick={() => router.push("/visits/staff/all-appointments")}>
            All appointments
          </Button>
          <Button variant="outlined" onClick={() => router.push("/visits/staff/past-appointments")}>
            Past appointments
          </Button>
          <Button variant="outlined" onClick={() => router.push("/appointments/staff")}>
            Appointment management
          </Button>
        </>
      }
    >
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(4, 1fr)" }} gap={2} mb={3}>
        <StatCard label="All appointments" value={appointments.length} helper="Rows in this workspace" />
        <StatCard label="Past appointments" value={visits.length} helper="Visit records already saved" />
        <StatCard label="Ready to create" value={availableAppointments.length} helper="Approved appointments" />
        <StatCard
          label="Medications"
          value={selectedVisit ? selectedVisit.prescriptions.flatMap((item) => item.items).length : 0}
          helper="Current visit prescription lines"
        />
      </Box>

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", xl: "1.18fr 0.82fr" }} gap={2.5}>
        <Stack spacing={2.5}>
          <DashboardCard>
            <Typography variant="h5">{selectedVisitId ? "Update visit record" : "Create visit record"}</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              ฟอร์มนี้ใช้สร้างหรือแก้ visit record โดยไม่ต้องสลับหน้าออกไปไหน
            </Typography>

            {!canManageVisits && (
              <Alert severity="info" sx={{ mt: 2.25 }}>
                Your role can review visit records but cannot edit them.
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2.25 }}>
              <Stack spacing={2}>
                <TextField
                  select
                  name="appointment_id"
                  label="Appointment"
                  value={form.appointment_id}
                  onChange={handleChange}
                  disabled={Boolean(selectedVisitId) || !canManageVisits || saving}
                  required
                >
                  {availableAppointments.map((appointment) => (
                    <MenuItem key={appointment.appointment_id} value={String(appointment.appointment_id)}>
                      #{appointment.appointment_id} - {appointment.child?.first_name || "-"} {appointment.child?.last_name || ""}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  name="visit_date"
                  label="Visit date and time"
                  type="datetime-local"
                  value={form.visit_date}
                  onChange={handleChange}
                  disabled={!canManageVisits || saving}
                  slotProps={{ inputLabel: { shrink: true } }}
                  required
                />

                {selectedAppointment && (
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 4,
                      background: "rgba(255,255,255,0.56)",
                      border: "1px solid rgba(122, 156, 156, 0.14)",
                    }}
                  >
                    <Typography sx={{ fontWeight: 700 }}>
                      {selectedAppointment.child?.first_name || "-"} {selectedAppointment.child?.last_name || ""}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                      Schedule: {formatDate(selectedAppointment.work_schedules?.work_date || null)} | {formatTime(selectedAppointment.work_schedules?.start_time || null)} - {formatTime(selectedAppointment.work_schedules?.end_time || null)}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                      Approval: {titleCase(selectedAppointment.approval_status || "pending")}
                    </Typography>
                  </Box>
                )}

                <Divider textAlign="left">Vital signs</Divider>

                <Box display="grid" gridTemplateColumns={{ xs: "1fr", sm: "repeat(2, 1fr)" }} gap={2}>
                  <TextField name="weight_kg" label="Weight (kg)" value={form.weight_kg} onChange={handleChange} disabled={!canManageVisits || saving} />
                  <TextField name="height_cm" label="Height (cm)" value={form.height_cm} onChange={handleChange} disabled={!canManageVisits || saving} />
                  <TextField name="bp_systolic" label="BP systolic" value={form.bp_systolic} onChange={handleChange} disabled={!canManageVisits || saving} />
                  <TextField name="bp_diastolic" label="BP diastolic" value={form.bp_diastolic} onChange={handleChange} disabled={!canManageVisits || saving} />
                  <TextField name="heart_rate" label="Heart rate" value={form.heart_rate} onChange={handleChange} disabled={!canManageVisits || saving} />
                </Box>

                <TextField
                  name="note"
                  label="Vital note"
                  value={form.note}
                  onChange={handleChange}
                  disabled={!canManageVisits || saving}
                  multiline
                  minRows={3}
                />

                <Divider textAlign="left">Clinical notes</Divider>

                <TextField
                  name="diagnoses"
                  label="Diagnoses"
                  value={form.diagnoses}
                  onChange={handleChange}
                  disabled={!canManageVisits || saving}
                  multiline
                  minRows={4}
                  helperText="One diagnosis per line"
                />

                <TextField
                  name="treatment_plans"
                  label="Treatment plans"
                  value={form.treatment_plans}
                  onChange={handleChange}
                  disabled={!canManageVisits || saving}
                  multiline
                  minRows={4}
                  helperText="One treatment plan per line"
                />

                <Divider textAlign="left">Medication order</Divider>

                <Stack spacing={1.5}>
                  {prescriptionItems.map((item, index) => (
                    <Box
                      key={item.id}
                      display="grid"
                      gridTemplateColumns={{ xs: "1fr", sm: "1.3fr 0.6fr auto" }}
                      gap={1.5}
                      alignItems="center"
                    >
                      <TextField
                        select
                        label="Drug"
                        value={item.drug_id}
                        onChange={(event) =>
                          handlePrescriptionChange(index, "drug_id", event.target.value)
                        }
                        disabled={!canManageVisits || saving || drugs.length === 0}
                      >
                        {drugs.map((drug) => (
                          <MenuItem key={drug.drug_id} value={drug.drug_id}>
                            {formatDrugLabel(drug)}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        label="Qty"
                        type="number"
                        value={item.quantity}
                        onChange={(event) =>
                          handlePrescriptionChange(index, "quantity", event.target.value)
                        }
                        disabled={!canManageVisits || saving}
                        inputProps={{ min: 1 }}
                      />
                      <IconButton
                        aria-label="Remove medication"
                        onClick={() => removePrescriptionRow(index)}
                        disabled={!canManageVisits || saving}
                      >
                        <DeleteOutlineRoundedIcon />
                      </IconButton>
                    </Box>
                  ))}
                  <Box display="flex" gap={1.25} flexWrap="wrap">
                    <Button
                      variant="outlined"
                      startIcon={<AddRoundedIcon />}
                      onClick={addPrescriptionRow}
                      disabled={!canManageVisits || saving || drugs.length === 0}
                    >
                      Add medication
                    </Button>
                    {drugs.length === 0 && (
                      <Typography color="text.secondary">
                        No drug catalog found. Add drugs first before prescribing.
                      </Typography>
                    )}
                  </Box>
                </Stack>

                <Divider textAlign="left">Treatment pricing</Divider>

                {!canManageTreatmentPricing && (
                  <Alert severity="info">
                    Only admins can set treatment prices. Other staff can still review the invoice.
                  </Alert>
                )}

                <Stack spacing={1.5}>
                  {form.service_items.map((item, index) => (
                    <Box
                      key={item.id}
                      display="grid"
                      gridTemplateColumns={{ xs: "1fr", md: "1.4fr 0.45fr 0.55fr auto" }}
                      gap={1.5}
                      alignItems="center"
                    >
                      <TextField
                        label="Treatment item"
                        value={item.description}
                        onChange={(event) =>
                          handleServiceItemChange(index, "description", event.target.value)
                        }
                        disabled={!canManageTreatmentPricing || saving}
                      />
                      <TextField
                        label="Qty"
                        type="number"
                        value={item.qty}
                        onChange={(event) =>
                          handleServiceItemChange(index, "qty", event.target.value)
                        }
                        disabled={!canManageTreatmentPricing || saving}
                        inputProps={{ min: 1 }}
                      />
                      <TextField
                        label="Unit price"
                        type="number"
                        value={item.unit_price}
                        onChange={(event) =>
                          handleServiceItemChange(index, "unit_price", event.target.value)
                        }
                        disabled={!canManageTreatmentPricing || saving}
                        inputProps={{ min: 0, step: "0.01" }}
                      />
                      <IconButton
                        aria-label="Remove treatment item"
                        onClick={() => removeServiceItem(index)}
                        disabled={!canManageTreatmentPricing || saving}
                      >
                        <DeleteOutlineRoundedIcon />
                      </IconButton>
                    </Box>
                  ))}
                  <Box display="flex" gap={1.25} flexWrap="wrap">
                    <Button
                      variant="outlined"
                      startIcon={<AddRoundedIcon />}
                      onClick={addServiceItem}
                      disabled={!canManageTreatmentPricing || saving}
                    >
                      Add treatment price
                    </Button>
                  </Box>
                </Stack>

                <Box display="flex" gap={1.25} flexWrap="wrap">
                  <Button type="submit" variant="contained" disabled={!canManageVisits || saving}>
                    {saving ? "Saving..." : selectedVisitId ? "Update record" : "Save record"}
                  </Button>
                  <Button variant="outlined" onClick={() => resetEditor()} disabled={saving}>
                    Clear form
                  </Button>
                </Box>
              </Stack>
            </Box>
          </DashboardCard>
        </Stack>

        <Stack spacing={2.5}>
          <DashboardCard>
            <Typography variant="h5">Invoice summary</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              ด้านขวาจะสรุปบิลของ visit ที่กำลังเปิดอยู่ตลอด เพื่อให้เช็กค่ารักษาและค่ายาได้ในหน้าเดียว
            </Typography>

            {selectedAppointment && (
              <Box
                sx={{
                  mt: 2.25,
                  p: 2,
                  borderRadius: 4,
                  background: "rgba(255,255,255,0.56)",
                  border: "1px solid rgba(122, 156, 156, 0.14)",
                }}
              >
                <Typography sx={{ fontWeight: 700 }}>
                  {selectedAppointment.child?.first_name || "-"} {selectedAppointment.child?.last_name || ""}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  {formatDate(selectedAppointment.work_schedules?.work_date || null)} | {formatTime(selectedAppointment.work_schedules?.start_time || null)} - {formatTime(selectedAppointment.work_schedules?.end_time || null)}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  Specialist: {selectedAppointment.work_schedules?.staff?.first_name || "-"} {selectedAppointment.work_schedules?.staff?.last_name || ""}
                </Typography>
              </Box>
            )}

            {!currentInvoice && (
              <Typography color="text.secondary" sx={{ mt: 2.25 }}>
                No invoice has been generated for this visit yet.
              </Typography>
            )}

            {currentInvoice && (
              <Stack spacing={1.5} sx={{ mt: 2.25 }}>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 4,
                    background: "rgba(255,255,255,0.56)",
                    border: "1px solid rgba(122, 156, 156, 0.14)",
                  }}
                >
                  <Typography sx={{ fontWeight: 700 }}>Invoice #{currentInvoice.invoice_id}</Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                    Total amount: {formatCurrency(currentInvoice.total_amount)}
                  </Typography>
                </Box>

                {currentInvoice.items.map((item) => (
                  <Box
                    key={item.invoice_item_id}
                    sx={{
                      p: 2,
                      borderRadius: 4,
                      background: "rgba(255,255,255,0.56)",
                      border: "1px solid rgba(122, 156, 156, 0.14)",
                    }}
                  >
                    <Box display="flex" justifyContent="space-between" gap={2} flexWrap="wrap">
                      <Box>
                        <Typography sx={{ fontWeight: 700 }}>{item.description}</Typography>
                        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                          Qty {item.qty} x {formatCurrency(item.unit_price)}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontWeight: 700 }}>{formatCurrency(item.amount)}</Typography>
                    </Box>
                  </Box>
                ))}

                {currentInvoice.payments.length > 0 && (
                  <>
                    <Divider textAlign="left">Payments</Divider>
                    {currentInvoice.payments.map((payment) => (
                      <Box key={payment.payment_id} display="flex" justifyContent="space-between" gap={2}>
                        <Typography color="text.secondary">
                          Payment #{payment.payment_id} - {formatDate(payment.payment_date)}
                        </Typography>
                        <Typography>{formatCurrency(payment.amount)}</Typography>
                      </Box>
                    ))}
                  </>
                )}
              </Stack>
            )}
          </DashboardCard>
        </Stack>
      </Box>
    </AppShell>
  );
}

function localDateTimeString() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

function normalizeError(error: AxiosError<ApiErrorResponse>, fallback: string) {
  const message = error.response?.data?.message;
  return Array.isArray(message) ? message.join(", ") : (message ?? fallback);
}

function toFormState(visit: VisitRecord): VisitFormState {
  return {
    appointment_id: String(visit.appointment_id ?? ""),
    visit_date: visit.visit_date ? visit.visit_date.slice(0, 16) : localDateTimeString(),
    weight_kg: visit.vital_signs?.weight_kg?.toString() ?? "",
    height_cm: visit.vital_signs?.height_cm?.toString() ?? "",
    bp_systolic: visit.vital_signs?.bp_systolic?.toString() ?? "",
    bp_diastolic: visit.vital_signs?.bp_diastolic?.toString() ?? "",
    heart_rate: visit.vital_signs?.heart_rate?.toString() ?? "",
    note: visit.vital_signs?.note ?? "",
    diagnoses: visit.diagnoses.map((item) => item.diagnosis_text).filter(Boolean).join("\n"),
    treatment_plans: visit.treatment_plans.map((item) => item.plan_detail).filter(Boolean).join("\n"),
    service_items: toServiceItemsFormState(visit),
  };
}

function toPrescriptionFormState(visit: VisitRecord): PrescriptionFormItem[] {
  const items = visit.prescriptions.flatMap((prescription) => prescription.items);

  if (items.length === 0) {
    return [createPrescriptionItem()];
  }

  return items.map((item) => ({
    id: `prescription-${item.prescription_item_id}`,
    drug_id: item.drug_id ? String(item.drug_id) : "",
    quantity: item.quantity ? String(item.quantity) : "1",
  }));
}

function buildPayload(
  form: VisitFormState,
  prescriptionItems: PrescriptionFormItem[],
  includeServiceItems: boolean,
) {
  return {
    appointment_id: Number(form.appointment_id),
    visit_date: new Date(form.visit_date).toISOString(),
    vital_signs: {
      ...(form.weight_kg ? { weight_kg: Number(form.weight_kg) } : {}),
      ...(form.height_cm ? { height_cm: Number(form.height_cm) } : {}),
      ...(form.bp_systolic ? { bp_systolic: Number(form.bp_systolic) } : {}),
      ...(form.bp_diastolic ? { bp_diastolic: Number(form.bp_diastolic) } : {}),
      ...(form.heart_rate ? { heart_rate: Number(form.heart_rate) } : {}),
      ...(form.note.trim() ? { note: form.note.trim() } : {}),
    },
    diagnoses: splitLines(form.diagnoses),
    treatment_plans: splitLines(form.treatment_plans),
    prescriptions: prescriptionItems
      .filter((item) => item.drug_id && item.quantity)
      .map((item) => ({
        drug_id: Number(item.drug_id),
        quantity: Number(item.quantity),
      })),
    ...(includeServiceItems
      ? {
          service_items: form.service_items
            .filter((item) => item.description.trim())
            .map((item) => ({
              description: item.description.trim(),
              qty: Number(item.qty || 1),
              unit_price: Number(item.unit_price || 0),
            })),
        }
      : {}),
  };
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function createPrescriptionItem(): PrescriptionFormItem {
  return {
    id: Math.random().toString(36).slice(2, 10),
    drug_id: "",
    quantity: "1",
  };
}

function createServiceItem() {
  return {
    id: Math.random().toString(36).slice(2, 10),
    description: "",
    qty: "1",
    unit_price: "",
  };
}

function toServiceItemsFormState(visit: VisitRecord) {
  const items = (visit.invoices[0]?.items ?? []).filter((item) => item.item_type === "service");

  if (items.length === 0) {
    return [createServiceItem()];
  }

  return items.map((item) => ({
    id: `service-${item.invoice_item_id}`,
    description: item.description ?? "",
    qty: String(item.qty ?? 1),
    unit_price: String(Number(item.unit_price ?? 0)),
  }));
}

function formatDrugLabel(drug: DrugOption) {
  const name = drug.name || "Unnamed drug";
  const dose = drug.dose ? ` (${drug.dose})` : "";
  return `${name}${dose} - ${formatCurrency(drug.unit_price)}`;
}

function formatCurrency(value: string | number | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric)
    ? new Intl.NumberFormat("th-TH", {
        style: "currency",
        currency: "THB",
        minimumFractionDigits: 2,
      }).format(numeric)
    : "฿0.00";
}
