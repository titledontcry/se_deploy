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
import { AppShell, PageSkeleton, StatCard } from "@/app/components/app-shell";
import { staffNav } from "@/app/components/navigation";
import { PaginatedTableCard } from "@/app/components/paginated-table-card";
import { SearchSettingsCard } from "@/app/components/search-settings-card";
import api from "@/lib/api";
import { hasRole, type Profile } from "@/lib/access";
import { formatDate, formatMoney, titleCase } from "@/lib/format";

type ApiErrorResponse = {
  message?: string | string[];
};

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

type ParentOption = {
  parent_id: number;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  users: {
    username: string;
  };
};

type ChildOption = {
  child_id: number;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  _count: {
    child_parent: number;
  };
};

type LinkContext = {
  parents: ParentOption[];
  children: ChildOption[];
};

type LinkedParent = {
  parent_id: number;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  users: {
    username: string;
  };
  child_parent: Array<{
    child: {
      child_id: number;
      first_name: string | null;
      last_name: string | null;
      birth_date: string | null;
    } | null;
  }>;
};

type DrugItem = {
  drug_id: number;
  name: string | null;
  dose: string | null;
  unit_price: string | number | null;
};

type SectionKey = "users" | "family_links" | "drugs";

type LinkRow = {
  parentId: number;
  parentName: string;
  username: string;
  phone: string;
  childId: number;
  childName: string;
  birthDate: string | null;
};

const pageSize = 10;

export default function StaffManagementPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [staffData, setStaffData] = useState<StaffManagement | null>(null);
  const [linkContext, setLinkContext] = useState<LinkContext | null>(null);
  const [linkedParents, setLinkedParents] = useState<LinkedParent[]>([]);
  const [drugs, setDrugs] = useState<DrugItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [section, setSection] = useState<SectionKey>("users");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const { data: profileData } = await api.get<Profile>("/auth/profile");
        setProfile(profileData);

        const results = await Promise.allSettled([
          api.get<StaffManagement>("/users/admin/staff-management"),
          api.get<LinkContext>("/child-parent/context"),
          api.get<LinkedParent[]>("/child-parent"),
          api.get<DrugItem[]>("/drug"),
        ]);

        const [staffResult, contextResult, linksResult, drugsResult] = results;

        if (staffResult.status === "fulfilled") {
          setStaffData(staffResult.value.data);
        }
        if (contextResult.status === "fulfilled") {
          setLinkContext(contextResult.value.data);
        }
        if (linksResult.status === "fulfilled") {
          setLinkedParents(linksResult.value.data);
        }
        if (drugsResult.status === "fulfilled") {
          setDrugs(drugsResult.value.data);
        }

        if (
          staffResult.status === "rejected" &&
          contextResult.status === "rejected" &&
          linksResult.status === "rejected" &&
          drugsResult.status === "rejected"
        ) {
          setError("Unable to load management data");
        }
      } catch (err: unknown) {
        const error = err as AxiosError<ApiErrorResponse>;
        if (error.response?.status === 401) {
          localStorage.removeItem("access_token");
          router.push("/login");
          return;
        }
        const message = error.response?.data?.message;
        setError(Array.isArray(message) ? message.join(", ") : (message ?? "Unable to load management"));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [router]);

  const isAdmin = hasRole(profile, ["admin"]);

  const linkRows = useMemo<LinkRow[]>(
    () =>
      linkedParents.flatMap((parent) =>
        parent.child_parent.flatMap((item) => {
          const child = item.child;
          if (!child) return [];
          return [
            {
              parentId: parent.parent_id,
              parentName: `${parent.first_name || "-"} ${parent.last_name || ""}`.trim(),
              username: parent.users.username,
              phone: parent.phone || "-",
              childId: child.child_id,
              childName: `${child.first_name || "-"} ${child.last_name || ""}`.trim(),
              birthDate: child.birth_date,
            },
          ];
        }),
      ),
    [linkedParents],
  );

  const filteredUsers = useMemo(
    () =>
      (staffData?.users ?? []).filter((user) => {
        const matchesRole =
          roleFilter === "all" ||
          user.staff_profile?.role === roleFilter ||
          user.roles.includes(roleFilter);
        const haystack =
          `${user.username} ${user.user_type} ${user.staff_profile?.first_name ?? ""} ${user.staff_profile?.last_name ?? ""} ${user.roles.join(" ")}`
            .toLowerCase();
        return matchesRole && haystack.includes(query.toLowerCase());
      }),
    [query, roleFilter, staffData],
  );

  const filteredLinks = useMemo(
    () =>
      linkRows.filter((row) =>
        `${row.parentName} ${row.username} ${row.phone} ${row.childName} ${row.birthDate ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [linkRows, query],
  );

  const filteredDrugs = useMemo(
    () =>
      drugs.filter((drug) =>
        `${drug.name ?? ""} ${drug.dose ?? ""}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [drugs, query],
  );

  const activeCount =
    section === "users"
      ? filteredUsers.length
      : section === "family_links"
        ? filteredLinks.length
        : filteredDrugs.length;

  const pagedRows =
    section === "users"
      ? filteredUsers.slice((page - 1) * pageSize, page * pageSize)
      : section === "family_links"
        ? filteredLinks.slice((page - 1) * pageSize, page * pageSize)
        : filteredDrugs.slice((page - 1) * pageSize, page * pageSize);

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <AppShell
      title="Management"
      subtitle="Group staff-side setup pages into one category workspace, then switch the table type inside the page instead of loading the sidebar with many links."
      navTitle="Clinic Ops"
      navItems={staffNav(profile)}
      badge="Staff"
      profileName={profile?.username}
      profileMeta="Management workspace"
      actions={
        <>
          <Button variant="contained" onClick={() => router.push("/dashboard/staff/create-user")}>
            Create user
          </Button>
          <Button variant="outlined" onClick={() => router.push("/dashboard/staff/family-links")}>
            Open family links
          </Button>
          {isAdmin && (
            <Button variant="outlined" onClick={() => router.push("/dashboard/admin/drugs")}>
              Open drug catalog
            </Button>
          )}
        </>
      }
    >
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(4, 1fr)" }} gap={2} mb={3}>
        <StatCard label="Staff accounts" value={staffData?.users.length ?? 0} helper="Role and account records" />
        <StatCard label="Family links" value={linkRows.length} helper="Parent-child relationship rows" />
        <StatCard label="Children" value={linkContext?.children.length ?? 0} helper="Child records available to link" />
        <StatCard label="Drugs" value={drugs.length} helper="Catalog items with pricing" />
      </Box>

      <SearchSettingsCard description="Choose the management type first, then keep all filtering in this compact control bar.">
        <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "220px minmax(0, 1fr) 220px" }} gap={1.5}>
          <TextField
            select
            label="Type"
            value={section}
            onChange={(event) => {
              setSection(event.target.value as SectionKey);
              setPage(1);
            }}
          >
            <MenuItem value="users">Users & roles</MenuItem>
            <MenuItem value="family_links">Family links</MenuItem>
            <MenuItem value="drugs">Drug catalog</MenuItem>
          </TextField>
          <TextField
            label="Search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder={
              section === "users"
                ? "Username, name, role"
                : section === "family_links"
                  ? "Parent, child, phone"
                  : "Drug name or dose"
            }
          />
          {section === "users" ? (
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
              <MenuItem value="doctor">Doctor</MenuItem>
              <MenuItem value="nurse">Nurse</MenuItem>
              <MenuItem value="psychologist">Psychologist</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </TextField>
          ) : (
            <Box />
          )}
        </Box>
      </SearchSettingsCard>

      <Box sx={{ mt: 2.5 }}>
        <PaginatedTableCard
          title={
            section === "users"
              ? "User and role table"
              : section === "family_links"
                ? "Family link table"
                : "Drug catalog table"
          }
          subtitle={`Showing ${activeCount} row(s) in the current management section.`}
          page={page}
          pageCount={Math.max(1, Math.ceil(activeCount / pageSize))}
          onPageChange={setPage}
          empty={activeCount === 0}
          emptyLabel="No rows match the current search."
          header={
            <TableRow>
              {section === "users" && (
                <>
                  <TableCell>Username</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Roles</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Open</TableCell>
                </>
              )}
              {section === "family_links" && (
                <>
                  <TableCell>Parent</TableCell>
                  <TableCell>Username</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Child</TableCell>
                  <TableCell>Birth date</TableCell>
                  <TableCell>Open</TableCell>
                </>
              )}
              {section === "drugs" && (
                <>
                  <TableCell>Drug</TableCell>
                  <TableCell>Dose</TableCell>
                  <TableCell align="right">Price</TableCell>
                  <TableCell>Open</TableCell>
                </>
              )}
            </TableRow>
          }
          body={
            <>
              {section === "users" &&
                (pagedRows as typeof filteredUsers).map((user) => (
                  <TableRow key={user.user_id} hover>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>{user.staff_profile?.first_name || "-"} {user.staff_profile?.last_name || ""}</TableCell>
                    <TableCell>{user.roles.filter(Boolean).map((role) => titleCase(role)).join(", ") || "-"}</TableCell>
                    <TableCell>
                      {user.is_active ? "Active" : "Inactive"}
                      {user.staff_profile?.status ? ` / ${titleCase(user.staff_profile.status)}` : ""}
                    </TableCell>
                    <TableCell>
                      <Button size="small" variant="outlined" onClick={() => router.push("/dashboard/admin/staff")}>
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              {section === "family_links" &&
                (pagedRows as typeof filteredLinks).map((row) => (
                  <TableRow key={`${row.parentId}-${row.childId}`} hover>
                    <TableCell>{row.parentName}</TableCell>
                    <TableCell>@{row.username}</TableCell>
                    <TableCell>{row.phone}</TableCell>
                    <TableCell>{row.childName}</TableCell>
                    <TableCell>{formatDate(row.birthDate)}</TableCell>
                    <TableCell>
                      <Button size="small" variant="outlined" onClick={() => router.push("/dashboard/staff/family-links")}>
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              {section === "drugs" &&
                (pagedRows as typeof filteredDrugs).map((drug) => (
                  <TableRow key={drug.drug_id} hover>
                    <TableCell>{drug.name || "-"}</TableCell>
                    <TableCell>{drug.dose || "-"}</TableCell>
                    <TableCell align="right">{formatMoney(Number(drug.unit_price ?? 0))}</TableCell>
                    <TableCell>
                      <Button size="small" variant="outlined" onClick={() => router.push("/dashboard/admin/drugs")}>
                        Open
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
