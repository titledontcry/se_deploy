"use client";

import type { AxiosError } from "axios";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import { AppShell, DashboardCard, PageSkeleton, StatCard } from "@/app/components/app-shell";
import { staffNav } from "@/app/components/navigation";
import api from "@/lib/api";
import type { Profile } from "@/lib/access";
import { formatDate, titleCase } from "@/lib/format";

type ResultSummary = {
  child_assessment_id: number;
  total_score: number | null;
  assessed_at: string;
  interpreted_text: string | null;
  child: {
    first_name: string | null;
    last_name: string | null;
  } | null;
  assessment: {
    name: string | null;
  } | null;
  band: {
    severity_level: string;
  } | null;
};

type StaffAssessmentDashboard = {
  summary: {
    totalTemplates: number;
    totalResults: number;
    totalChildrenAssessed: number;
  };
  recentResults: ResultSummary[];
};

type ApiErrorResponse = {
  message?: string | string[];
};

export default function RecentSubmissionsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dashboard, setDashboard] = useState<StaffAssessmentDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [{ data: profileData }, { data: dashboardData }] = await Promise.all([
        api.get<Profile>("/auth/profile"),
        api.get<StaffAssessmentDashboard>("/assessment/dashboard"),
      ]);
      setProfile(profileData);
      setDashboard(dashboardData);
    } catch (err: unknown) {
      const e = err as AxiosError<ApiErrorResponse>;
      if (e.response?.status === 401) {
        localStorage.removeItem("access_token");
        router.push("/login");
        return;
      }
      const message = (e.response?.data?.message);
      setError(Array.isArray(message) ? message.join(", ") : (message ?? "Unable to load submissions"));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <PageSkeleton />;

  return (
    <AppShell
      title="Recent submissions"
      subtitle="View all recent child assessment submissions across all templates."
      navTitle="Clinic Ops"
      navItems={staffNav(profile)}
      badge="Staff"
      profileName={profile?.username}
      profileMeta="Assessment operations"
      actions={
        <>
          <Button variant="outlined" onClick={() => router.push("/assessments/staff")}>
            New template
          </Button>
          <Button variant="outlined" onClick={() => router.push("/assessments/staff/templates")}>
            Template library
          </Button>
          <Button variant="contained" onClick={() => router.push("/dashboard/staff")}>
            Staff overview
          </Button>
        </>
      }
    >
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(3, 1fr)" }} gap={2} mb={3}>
        <StatCard label="Total results" value={dashboard?.summary.totalResults ?? 0} />
        <StatCard label="Children assessed" value={dashboard?.summary.totalChildrenAssessed ?? 0} />
        <StatCard label="Templates" value={dashboard?.summary.totalTemplates ?? 0} />
      </Box>

      <DashboardCard>
        <Typography variant="h5">All submissions</Typography>
        <Stack spacing={1.5} sx={{ mt: 2.25 }}>
          {dashboard?.recentResults.map((result) => (
            <Box
              key={result.child_assessment_id}
              sx={{
                p: 2,
                borderRadius: 4,
                background: "rgba(255,255,255,0.56)",
                border: "1px solid rgba(122, 156, 156, 0.14)",
              }}
            >
              <Typography sx={{ fontWeight: 700 }}>
                {result.child?.first_name || "-"} {result.child?.last_name || ""}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                {result.assessment?.name || "-"} | {formatDate(result.assessed_at, "en-US")}
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap" sx={{ mt: 1.25 }}>
                <Chip label={`Score ${result.total_score ?? 0}`} />
                {result.band?.severity_level && (
                  <Chip label={titleCase(result.band.severity_level)} color="primary" />
                )}
              </Box>
            </Box>
          ))}
          {dashboard?.recentResults.length === 0 && (
            <Typography color="text.secondary">No submitted assessments yet.</Typography>
          )}
        </Stack>
      </DashboardCard>
    </AppShell>
  );
}
