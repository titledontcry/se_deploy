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
} from "@mui/material";
import type { AxiosError } from "axios";
import { AppShell, PageSkeleton } from "@/app/components/app-shell";
import { staffNav } from "@/app/components/navigation";
import { PaginatedTableCard } from "@/app/components/paginated-table-card";
import { SearchSettingsCard } from "@/app/components/search-settings-card";
import api from "@/lib/api";
import { titleCase } from "@/lib/format";
import type { Profile } from "@/lib/access";

type StaffManagement = {
  users: Array<{
    user_id: number;
    username: string;
    user_type: string;
    is_active: boolean;
    roles: Array<string | null>;
    staff_profile: {
      staff_id: number;
      first_name: string | null;
      last_name: string | null;
      role: string | null;
      status: string | null;
    } | null;
  }>;
};

type ApiErrorResponse = {
  message?: string | string[];
};

const roleOptions = ["doctor", "nurse", "psychologist", "admin"];

export default function AdminStaffPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [data, setData] = useState<StaffManagement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Record<number, string>>({});
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);

  const load = async () => {
    try {
      const [{ data: profileData }, { data: managementData }] = await Promise.all([
        api.get<Profile>("/auth/profile"),
        api.get<StaffManagement>("/users/admin/staff-management"),
      ]);
      setProfile(profileData);
      setData(managementData);
      setSelectedRoles(
        Object.fromEntries(
          managementData.users.map((user) => [
            user.user_id,
            user.staff_profile?.role || "nurse",
          ]),
        ),
      );
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
          : (message ?? "Unable to load staff management"),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [router]);

  const users = useMemo(() => data?.users ?? [], [data]);
  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        const matchesRole =
          roleFilter === "all" ||
          user.staff_profile?.role === roleFilter ||
          user.roles.includes(roleFilter);
        const haystack =
          `${user.username} ${user.user_type} ${user.staff_profile?.first_name ?? ""} ${user.staff_profile?.last_name ?? ""} ${user.roles.join(" ")}`.toLowerCase();
        return matchesRole && haystack.includes(query.toLowerCase());
      }),
    [query, roleFilter, users],
  );

  const pageSize = 8;
  const pagedUsers = useMemo(
    () => filteredUsers.slice((page - 1) * pageSize, page * pageSize),
    [filteredUsers, page],
  );

  const handleAssignRole = async (userId: number) => {
    setSavingUserId(userId);
    setError("");
    try {
      await api.patch(`/users/admin/${userId}/assign-role`, {
        roleName: selectedRoles[userId],
      });
      await load();
    } catch (err: unknown) {
      const error = err as AxiosError<ApiErrorResponse>;
      const message = error.response?.data?.message;
      setError(
        Array.isArray(message)
          ? message.join(", ")
          : (message ?? "Unable to assign role"),
      );
    } finally {
      setSavingUserId(null);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <AppShell
      title="Staff Role Management"
      subtitle="Assign operational roles from a searchable table instead of long stacked cards."
      navTitle="Clinic Ops"
      navItems={staffNav(profile)}
      badge="Admin"
      profileName={profile?.username}
      profileMeta="Admin control"
      actions={
        <>
          <Button variant="contained" onClick={() => router.push("/dashboard/staff/create-user")}>
            Create user
          </Button>
          <Button variant="outlined" onClick={() => router.push("/reports/staff")}>
            Open reports
          </Button>
        </>
      }
    >
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <SearchSettingsCard description="Use the controls here like a compact search panel, then manage roles from the table below.">
        <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "1fr 220px" }} gap={1.5}>
          <TextField
            label="Search staff"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Username, name, role"
          />
          <TextField
            select
            label="Role"
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value);
              setPage(1);
            }}
          >
            <MenuItem value="all">All roles</MenuItem>
            {roleOptions.map((role) => (
              <MenuItem key={role} value={role}>
                {titleCase(role)}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </SearchSettingsCard>

      <Box sx={{ mt: 2.5 }}>
        <PaginatedTableCard
          title="Staff directory"
          subtitle="Each row keeps the account summary and role assignment together."
          page={page}
          pageCount={Math.ceil(filteredUsers.length / pageSize)}
          onPageChange={setPage}
          empty={filteredUsers.length === 0}
          header={
            <TableRow>
              <TableCell>Username</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Type / Roles</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Assign role</TableCell>
            </TableRow>
          }
          body={
            <>
              {pagedUsers.map((user) => (
                <TableRow
                  key={user.user_id}
                  hover
                  sx={{
                    "& td": {
                      py: 2.25,
                      verticalAlign: "middle",
                    },
                  }}
                >
                  <TableCell sx={{ width: "18%" }}>{user.username}</TableCell>
                  <TableCell sx={{ width: "18%" }}>
                    {user.staff_profile?.first_name || "-"} {user.staff_profile?.last_name || ""}
                  </TableCell>
                  <TableCell sx={{ width: "20%" }}>
                    {titleCase(user.user_type)} / {user.roles.filter(Boolean).map((role) => titleCase(role)).join(", ") || "-"}
                  </TableCell>
                  <TableCell sx={{ width: "15%" }}>
                    {user.is_active ? "Active" : "Inactive"}
                    {user.staff_profile?.status ? ` / ${titleCase(user.staff_profile.status)}` : ""}
                  </TableCell>
                  <TableCell sx={{ width: "29%", minWidth: 280 }}>
                    <Box
                      display="grid"
                      gridTemplateColumns={{ xs: "1fr", md: "minmax(0, 1fr) 112px" }}
                      gap={1.25}
                      alignItems="center"
                    >
                      <TextField
                        select
                        size="small"
                        value={selectedRoles[user.user_id] || "nurse"}
                        onChange={(event) =>
                          setSelectedRoles((prev) => ({
                            ...prev,
                            [user.user_id]: event.target.value,
                          }))
                        }
                        fullWidth
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            minHeight: 44,
                            borderRadius: 3,
                            backgroundColor: "rgba(255,255,255,0.72)",
                          },
                        }}
                      >
                        {roleOptions.map((role) => (
                          <MenuItem key={role} value={role}>
                            {titleCase(role)}
                          </MenuItem>
                        ))}
                      </TextField>
                      <Button
                        variant="contained"
                        onClick={() => handleAssignRole(user.user_id)}
                        disabled={savingUserId === user.user_id}
                        fullWidth
                        sx={{
                          minHeight: 44,
                          borderRadius: 3,
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {savingUserId === user.user_id ? "Saving..." : "Assign"}
                      </Button>
                    </Box>
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
