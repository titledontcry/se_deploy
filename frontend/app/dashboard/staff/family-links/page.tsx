"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AxiosError } from "axios";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TableCell,
  TableRow,
  TextField,
} from "@mui/material";
import { AppShell, PageSkeleton, StatCard } from "@/app/components/app-shell";
import { staffNav } from "@/app/components/navigation";
import { PaginatedTableCard } from "@/app/components/paginated-table-card";
import { SearchSettingsCard } from "@/app/components/search-settings-card";
import api from "@/lib/api";
import { formatDate } from "@/lib/format";
import { hasRole, type Profile } from "@/lib/access";

type ApiErrorResponse = {
  message?: string | string[];
};

type ParentOption = {
  parent_id: number;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  users: {
    user_id: number;
    username: string;
  };
  _count: {
    child_parent: number;
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
    user_id: number;
    username: string;
  };
  child_parent: Array<{
    child: {
      child_id: number;
      first_name: string | null;
      last_name: string | null;
      birth_date: string | null;
      deleted_at: string | null;
    } | null;
  }>;
};

type LinkRow = {
  parentId: number;
  parentName: string;
  username: string;
  phone: string;
  childId: number;
  childName: string;
  birthDate: string | null;
};

const linkManagerRoles = ["admin", "nurse", "doctor"];
const pageSize = 8;

export default function StaffFamilyLinksPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [parents, setParents] = useState<ParentOption[]>([]);
  const [children, setChildren] = useState<ChildOption[]>([]);
  const [linkedParents, setLinkedParents] = useState<LinkedParent[]>([]);
  const [selectedParentId, setSelectedParentId] = useState("");
  const [selectedChildId, setSelectedChildId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [childFirstName, setChildFirstName] = useState("");
  const [childLastName, setChildLastName] = useState("");
  const [childBirthDate, setChildBirthDate] = useState("");
  const [savingChild, setSavingChild] = useState(false);
  const [query, setQuery] = useState("");
  const [parentFilter, setParentFilter] = useState("all");
  const [childStateFilter, setChildStateFilter] = useState("all");
  const [linkPage, setLinkPage] = useState(1);
  const [childPage, setChildPage] = useState(1);
  const [createChildOpen, setCreateChildOpen] = useState(false);
  const [createLinkOpen, setCreateLinkOpen] = useState(false);

  const canManageLinks = useMemo(
    () => profile?.user_type === "staff" && hasRole(profile, linkManagerRoles),
    [profile],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [{ data: profileData }, { data: contextData }, { data: linksData }] = await Promise.all([
        api.get<Profile>("/auth/profile"),
        api.get<LinkContext>("/child-parent/context"),
        api.get<LinkedParent[]>("/child-parent"),
      ]);

      setProfile(profileData);
      setParents(contextData.parents);
      setChildren(contextData.children);
      setLinkedParents(linksData);
    } catch (err: unknown) {
      const error = err as AxiosError<ApiErrorResponse>;
      if (error.response?.status === 401) {
        localStorage.removeItem("access_token");
        router.push("/login");
        return;
      }

      const message = error.response?.data?.message;
      setError(Array.isArray(message) ? message.join(", ") : (message ?? "Unable to load family links"));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateLink = async (event?: React.SyntheticEvent) => {
    event?.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedParentId || !selectedChildId) {
      setError("Select both a parent and a child");
      return;
    }

    setSaving(true);
    try {
      await api.post("/child-parent", {
        parent_id: Number(selectedParentId),
        child_id: Number(selectedChildId),
      });

      setSelectedParentId("");
      setSelectedChildId("");
      setCreateLinkOpen(false);
      setSuccess("Child linked to parent");
      await loadData();
    } catch (err: unknown) {
      const error = err as AxiosError<ApiErrorResponse>;
      const message = error.response?.data?.message;
      setError(Array.isArray(message) ? message.join(", ") : (message ?? "Unable to link child"));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateChild = async (event?: React.SyntheticEvent) => {
    event?.preventDefault();
    setError("");
    setSuccess("");
    setSavingChild(true);
    try {
      await api.post("/child", {
        first_name: childFirstName,
        last_name: childLastName,
        birth_date: childBirthDate || undefined,
      });
      setChildFirstName("");
      setChildLastName("");
      setChildBirthDate("");
      setCreateChildOpen(false);
      setSuccess("Child record created");
      await loadData();
    } catch (err: unknown) {
      const error = err as AxiosError<ApiErrorResponse>;
      const message = error.response?.data?.message;
      setError(Array.isArray(message) ? message.join(", ") : (message ?? "Unable to create child"));
    } finally {
      setSavingChild(false);
    }
  };

  const handleUnlink = async (parentId: number, childId: number) => {
    if (!window.confirm("Remove this child from the selected parent?")) {
      return;
    }

    setError("");
    setSuccess("");
    try {
      await api.delete(`/child-parent/${childId}`, {
        params: {
          parentId,
        },
      });

      setSuccess("Relationship removed");
      await loadData();
    } catch (err: unknown) {
      const error = err as AxiosError<ApiErrorResponse>;
      const message = error.response?.data?.message;
      setError(Array.isArray(message) ? message.join(", ") : (message ?? "Unable to remove link"));
    }
  };

  const linkRows = useMemo<LinkRow[]>(
    () =>
      linkedParents.flatMap((parent) =>
        parent.child_parent.flatMap((item) => {
          const child = item.child;
          if (!child) {
            return [];
          }

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

  const filteredLinkRows = useMemo(
    () =>
      linkRows.filter((row) => {
        const matchesParent = parentFilter === "all" || String(row.parentId) === parentFilter;
        const haystack = `${row.parentName} ${row.username} ${row.phone} ${row.childName} ${row.birthDate ?? ""}`
          .toLowerCase();
        return matchesParent && haystack.includes(query.toLowerCase());
      }),
    [linkRows, parentFilter, query],
  );

  const filteredChildren = useMemo(
    () =>
      children.filter((child) => {
        const linkCount = child._count.child_parent;
        const matchesState =
          childStateFilter === "all" ||
          (childStateFilter === "linked" && linkCount > 0) ||
          (childStateFilter === "unlinked" && linkCount === 0);
        const haystack = `${child.first_name ?? ""} ${child.last_name ?? ""} ${child.birth_date ?? ""}`
          .toLowerCase();
        return matchesState && haystack.includes(query.toLowerCase());
      }),
    [childStateFilter, children, query],
  );

  const pagedLinks = filteredLinkRows.slice((linkPage - 1) * pageSize, linkPage * pageSize);
  const pagedChildren = filteredChildren.slice((childPage - 1) * pageSize, childPage * pageSize);

  if (loading) {
    return <PageSkeleton />;
  }

  if (!canManageLinks) {
    return (
      <AppShell
        title="Family Links"
        subtitle="Link child records to parent accounts from a single staff workspace."
        navTitle="Clinic Ops"
        navItems={staffNav(profile)}
        badge="Staff"
        profileName={profile?.username}
        profileMeta="Relationship manager"
        actions={
          <Button variant="outlined" onClick={() => router.push("/dashboard/staff")}>
            Back to overview
          </Button>
        }
      >
        <Alert severity="warning">Only admin, nurse, and doctor roles can manage child-parent links.</Alert>
      </AppShell>
    );
  }

  const linkedChildrenCount = linkRows.length;
  const unlinkedChildrenCount = children.filter((child) => child._count.child_parent === 0).length;

  return (
    <AppShell
      title="Family Links"
      subtitle="Keep relationship management compact at the top, then review link rows and child records from structured tables."
      navTitle="Clinic Ops"
      navItems={staffNav(profile)}
      badge="Staff"
      profileName={profile?.username}
      profileMeta="Relationship manager"
      actions={
        <>
          <Button variant="contained" onClick={() => setCreateLinkOpen(true)}>
            Create link
          </Button>
          <Button variant="outlined" onClick={() => setCreateChildOpen(true)}>
            Add child
          </Button>
          <Button variant="outlined" onClick={() => router.push("/dashboard/staff/create-user")}>
            Create user
          </Button>
          <Button variant="outlined" onClick={() => router.push("/dashboard/staff")}>
            Staff overview
          </Button>
        </>
      }
    >
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(4, 1fr)" }} gap={2.5} mb={2.5}>
        <StatCard label="Parents" value={parents.length} helper="Active parent profiles" />
        <StatCard label="Children" value={children.length} helper="Child records available to link" />
        <StatCard label="Links" value={linkedChildrenCount} helper="Current relationship rows" />
        <StatCard label="Unlinked children" value={unlinkedChildrenCount} helper="Children still waiting for parent access" />
      </Box>

      <SearchSettingsCard description="Use one compact search panel for both relationship tables below.">
        <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "minmax(0, 1.4fr) 280px 220px" }} gap={2}>
          <TextField
            label="Search parent or child"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLinkPage(1);
              setChildPage(1);
            }}
            placeholder="Parent name, username, phone, child name"
            fullWidth
          />
          <TextField
            select
            label="Parent account"
            value={parentFilter}
            onChange={(event) => {
              setParentFilter(event.target.value);
              setLinkPage(1);
            }}
            fullWidth
          >
            <MenuItem value="all">All parents</MenuItem>
            {parents.map((parent) => (
              <MenuItem key={parent.parent_id} value={String(parent.parent_id)}>
                {`${parent.first_name || "-"} ${parent.last_name || ""}`.trim()}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Child state"
            value={childStateFilter}
            onChange={(event) => {
              setChildStateFilter(event.target.value);
              setChildPage(1);
            }}
            fullWidth
          >
            <MenuItem value="all">All children</MenuItem>
            <MenuItem value="linked">Linked</MenuItem>
            <MenuItem value="unlinked">Unlinked</MenuItem>
          </TextField>
        </Box>
      </SearchSettingsCard>

      <Box sx={{ mt: 2.5 }}>
        <PaginatedTableCard
          title="Family link table"
          subtitle="Each row represents one parent-child relationship."
          page={linkPage}
          pageCount={Math.max(1, Math.ceil(filteredLinkRows.length / pageSize))}
          onPageChange={setLinkPage}
          empty={filteredLinkRows.length === 0}
          emptyLabel="No relationship rows match the current filters."
          header={
            <TableRow>
              <TableCell>Parent</TableCell>
              <TableCell>Username</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Child</TableCell>
              <TableCell>Birth date</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          }
          body={
            <>
              {pagedLinks.map((row) => (
                <TableRow key={`${row.parentId}-${row.childId}`} hover>
                  <TableCell>{row.parentName}</TableCell>
                  <TableCell>@{row.username}</TableCell>
                  <TableCell>{row.phone}</TableCell>
                  <TableCell>{row.childName}</TableCell>
                  <TableCell>{formatDate(row.birthDate)}</TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={() => handleUnlink(row.parentId, row.childId)}
                    >
                      Unlink
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
          title="Child record table"
          subtitle="Use Quick link to open the linking dialog with the child preselected."
          page={childPage}
          pageCount={Math.max(1, Math.ceil(filteredChildren.length / pageSize))}
          onPageChange={setChildPage}
          empty={filteredChildren.length === 0}
          emptyLabel="No child records match the current filters."
          header={
            <TableRow>
              <TableCell>Child</TableCell>
              <TableCell>Birth date</TableCell>
              <TableCell>Links</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          }
          body={
            <>
              {pagedChildren.map((child) => (
                <TableRow key={child.child_id} hover>
                  <TableCell>{`${child.first_name || "-"} ${child.last_name || ""}`.trim()}</TableCell>
                  <TableCell>{formatDate(child.birth_date)}</TableCell>
                  <TableCell>{child._count.child_parent}</TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => {
                        setSelectedChildId(String(child.child_id));
                        setCreateLinkOpen(true);
                      }}
                    >
                      Quick link
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </>
          }
        />
      </Box>

      <Dialog open={createChildOpen} onClose={() => setCreateChildOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add child</DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleCreateChild} sx={{ mt: 1.5 }}>
            <Box display="grid" gap={2}>
              <TextField
                label="First name"
                value={childFirstName}
                onChange={(event) => setChildFirstName(event.target.value)}
                required
                fullWidth
              />
              <TextField
                label="Last name"
                value={childLastName}
                onChange={(event) => setChildLastName(event.target.value)}
                required
                fullWidth
              />
              <TextField
                label="Birth date"
                type="date"
                value={childBirthDate}
                onChange={(event) => setChildBirthDate(event.target.value)}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateChildOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateChild} disabled={savingChild}>
            {savingChild ? "Saving..." : "Save child"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createLinkOpen} onClose={() => setCreateLinkOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create link</DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleCreateLink} sx={{ mt: 1.5 }}>
            <Box display="grid" gap={2}>
              <TextField
                select
                label="Parent account"
                value={selectedParentId}
                onChange={(event) => setSelectedParentId(event.target.value)}
                required
                fullWidth
              >
                {parents.map((parent) => (
                  <MenuItem key={parent.parent_id} value={String(parent.parent_id)}>
                    {`${parent.first_name || "-"} ${parent.last_name || ""}`.trim()} | @{parent.users.username}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Child record"
                value={selectedChildId}
                onChange={(event) => setSelectedChildId(event.target.value)}
                required
                fullWidth
              >
                {children.map((child) => (
                  <MenuItem key={child.child_id} value={String(child.child_id)}>
                    {`${child.first_name || "-"} ${child.last_name || ""}`.trim()} | Birth date {formatDate(child.birth_date)}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateLinkOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateLink} disabled={saving}>
            {saving ? "Linking..." : "Save link"}
          </Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
