"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import { AppShell, DashboardCard, PageSkeleton } from "@/app/components/app-shell";
import { parentNav, staffNav } from "@/app/components/navigation";
import api from "@/lib/api";
import {
  getEffectiveRoles,
  getPrimaryStaffRoute,
  hasRole,
  type Profile,
} from "@/lib/access";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }

    api
      .get<Profile>("/auth/profile")
      .then(({ data }) => setProfile(data))
      .catch(() => {
        localStorage.removeItem("access_token");
        router.push("/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    router.push("/login");
  };

  if (loading) {
    return <PageSkeleton />;
  }

  const navItems = profile?.user_type === "parent" ? parentNav() : staffNav(profile);

  return (
    <AppShell
      title="Profile"
      subtitle="A focused account view with role context and direct navigation back into the right workspace."
      navTitle={profile?.user_type === "parent" ? "Guardian Care" : "Clinic Ops"}
      navItems={navItems}
      badge={profile?.user_type === "staff" ? "Staff" : "Parent"}
      profileName={profile?.username}
      profileMeta={profile?.user_type === "staff" ? getEffectiveRoles(profile).join(", ") || "Staff member" : "Family account"}
      actions={
        <>
          <Button variant="contained" onClick={() => router.push(getPrimaryStaffRoute(profile))}>
            Open main workspace
          </Button>
          {profile?.user_type === "staff" && hasRole(profile, ["admin"]) && (
            <Button variant="outlined" onClick={() => router.push("/dashboard/admin/staff")}>
              Manage staff roles
            </Button>
          )}
          <Button variant="outlined" color="error" onClick={handleLogout}>
            Logout
          </Button>
        </>
      }
    >
      <Box display="grid" gridTemplateColumns={{ xs: "1fr", xl: "0.95fr 1.05fr" }} gap={2.5}>
        <DashboardCard>
          <Typography variant="h5">Account details</Typography>
          <Stack spacing={1.5} sx={{ mt: 2.25 }}>
            <DetailRow label="User ID" value={`#${profile?.user_id}`} />
            <DetailRow label="Username" value={profile?.username || "-"} />
            <DetailRow label="Account type" value={profile?.user_type || "-"} />
            <DetailRow label="Status" value={profile?.is_active ? "Active" : "Inactive"} />
          </Stack>
        </DashboardCard>

        <DashboardCard>
          <Typography variant="h5">Role access</Typography>
          <Stack spacing={1.5} sx={{ mt: 2.25 }}>
            {profile?.user_type === "staff" ? (
              <>
                <Box display="flex" gap={1} flexWrap="wrap">
                  {getEffectiveRoles(profile).map((role) => (
                    <Chip key={role} label={role} />
                  ))}
                </Box>
                <Typography color="text.secondary">
                  Staff navigation adapts to all assigned roles, including admin access where available.
                </Typography>
              </>
            ) : (
              <>
                <Chip label="Parent" />
                <Typography color="text.secondary">
                  Parents land on a dashboard with booking shortcuts, upcoming visits, and history.
                </Typography>
              </>
            )}
          </Stack>
        </DashboardCard>
      </Box>
    </AppShell>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        gap: 2,
        py: 1.1,
        borderBottom: "1px solid rgba(122, 156, 156, 0.14)",
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={700}>
        {value}
      </Typography>
    </Box>
  );
}
