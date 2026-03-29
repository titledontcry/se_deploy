"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import type { AxiosError } from "axios";
import { AppShell, DashboardCard, PageSkeleton } from "@/app/components/app-shell";
import { staffNav } from "@/app/components/navigation";
import api from "@/lib/api";
import { hasRole, type Profile } from "@/lib/access";

type FormState = {
  username: string;
  password: string;
  confirmPassword: string;
  userType: "parent" | "staff";
  firstName: string;
  lastName: string;
  phone: string;
  roleName: "doctor" | "nurse" | "psychologist" | "admin";
};

const staffRoleOptions: Array<FormState["roleName"]> = ["doctor", "nurse", "psychologist", "admin"];

const emptyForm: FormState = {
  username: "",
  password: "",
  confirmPassword: "",
  userType: "parent",
  firstName: "",
  lastName: "",
  phone: "",
  roleName: "nurse",
};

type ApiErrorResponse = {
  message?: string | string[];
};

export default function StaffCreateUserPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get<Profile>("/auth/profile");
        if (data.user_type !== "staff") {
          router.push("/login");
          return;
        }
        setProfile(data);
      } catch (err: unknown) {
        const error = err as AxiosError<ApiErrorResponse>;
        if (error.response?.status === 401) {
          localStorage.removeItem("access_token");
          router.push("/login");
          return;
        }
        const message = error.response?.data?.message;
        setError(Array.isArray(message) ? message.join(", ") : (message ?? "Unable to load profile"));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  const canCreateStaff = useMemo(() => hasRole(profile, ["admin"]), [profile]);

  const userTypeOptions = useMemo(
    () =>
      canCreateStaff
        ? [
            { value: "parent", label: "Parent" },
            { value: "staff", label: "Staff" },
          ]
        : [{ value: "parent", label: "Parent" }],
    [canCreateStaff],
  );

  const handleChange =
    (field: keyof Pick<FormState, "username" | "password" | "confirmPassword" | "firstName" | "lastName" | "phone">) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (form.userType === "staff" && !canCreateStaff) {
      setError("Only admin can create staff accounts");
      return;
    }

    setSaving(true);
    try {
      const { data } = await api.post("/users/staff/create-user", {
        username: form.username,
        password: form.password,
        userType: form.userType,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.userType === "parent" ? form.phone : undefined,
        roleName: form.userType === "staff" ? form.roleName : undefined,
      });

      setSuccess(`${data.username} created as ${data.assignedRole || data.user_type}`);
      setForm({
        ...emptyForm,
        userType: canCreateStaff ? form.userType : "parent",
      });
    } catch (err: unknown) {
      const error = err as AxiosError<ApiErrorResponse>;
      const message = error.response?.data?.message || "Unable to create user right now";
      setError(Array.isArray(message) ? message.join(", ") : message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <AppShell
      title="Create User"
      subtitle="Staff can open parent accounts, while admin can provision new staff members and assign role entry points."
      navTitle="Clinic Ops"
      navItems={staffNav(profile)}
      badge="Staff"
      profileName={profile?.username}
      profileMeta="User provisioning"
      actions={
        <Button variant="outlined" onClick={() => router.push("/dashboard/staff")}>
          Back to overview
        </Button>
      }
    >
      <DashboardCard>
        {error && <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2.5 }}>{success}</Alert>}

        <Box component="form" onSubmit={handleSubmit}>
          <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(2, 1fr)" }} gap={2}>
            <TextField
              select
              label="User type"
              value={form.userType}
              onChange={(event) => setForm((prev) => ({ ...prev, userType: event.target.value as FormState["userType"] }))}
              fullWidth
            >
              {userTypeOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            {form.userType === "staff" && (
              <TextField
                select
                label="Staff role"
                value={form.roleName}
                onChange={(event) => setForm((prev) => ({ ...prev, roleName: event.target.value as FormState["roleName"] }))}
                fullWidth
              >
                {staffRoleOptions.map((role) => (
                  <MenuItem key={role} value={role}>
                    {role}
                  </MenuItem>
                ))}
              </TextField>
            )}

            <TextField label="Username" value={form.username} onChange={handleChange("username")} fullWidth required />
            <TextField label="Password" type="password" value={form.password} onChange={handleChange("password")} fullWidth required />
            <TextField label="Confirm password" type="password" value={form.confirmPassword} onChange={handleChange("confirmPassword")} fullWidth required />
            <TextField label="Phone" value={form.phone} onChange={handleChange("phone")} fullWidth disabled={form.userType !== "parent"} />
            <TextField label="First name" value={form.firstName} onChange={handleChange("firstName")} fullWidth />
            <TextField label="Last name" value={form.lastName} onChange={handleChange("lastName")} fullWidth />
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 3 }}>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? "Creating..." : "Create user"}
            </Button>
            <Button variant="outlined" onClick={() => router.push("/dashboard/staff")}>
              Cancel
            </Button>
          </Stack>
        </Box>
      </DashboardCard>
    </AppShell>
  );
}
