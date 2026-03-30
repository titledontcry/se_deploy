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

type TemplateSummary = {
  assessment_id: number;
  name: string | null;
  questionCount: number;
  resultCount: number;
  creator: {
    first_name: string | null;
    last_name: string | null;
    role: string | null;
  } | null;
};

type ApiErrorResponse = {
  message?: string | string[];
};

export default function TemplateLibraryPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const extractMessage = (err: unknown, fallback: string) => {
    const e = err as AxiosError<ApiErrorResponse>;
    const message = e.response?.data?.message;
    return Array.isArray(message) ? message.join(", ") : (message ?? fallback);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [{ data: profileData }, { data: templateData }] = await Promise.all([
        api.get<Profile>("/auth/profile"),
        api.get<TemplateSummary[]>("/assessment/templates"),
      ]);
      setProfile(profileData);
      setTemplates(templateData);
    } catch (err: unknown) {
      const e = err as AxiosError<ApiErrorResponse>;
      if (e.response?.status === 401) {
        localStorage.removeItem("access_token");
        router.push("/login");
        return;
      }
      setError(extractMessage(err, "Unable to load templates"));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async (assessmentId: number) => {
    if (!window.confirm("Delete this assessment template?")) return;
    try {
      await api.delete(`/assessment/templates/${assessmentId}`);
      setSuccess("Assessment template deleted");
      await load();
    } catch (err: unknown) {
      setError(extractMessage(err, "Unable to delete assessment template"));
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <AppShell
      title="Template library"
      subtitle="View and manage all assessment templates. Locked templates have existing submissions."
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
          <Button variant="outlined" onClick={() => router.push("/assessments/staff/submissions")}>
            Recent submissions
          </Button>
          <Button variant="contained" onClick={() => router.push("/dashboard/staff")}>
            Staff overview
          </Button>
        </>
      }
    >
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}

      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "repeat(2, 1fr)" }} gap={2} mb={3}>
        <StatCard label="Templates" value={templates.length} />
        <StatCard label="With submissions" value={templates.filter((t) => t.resultCount > 0).length} />
      </Box>

      <DashboardCard>
        <Typography variant="h5">All templates</Typography>
        <Stack spacing={1.5} sx={{ mt: 2.25 }}>
          {templates.map((template) => (
            <Box
              key={template.assessment_id}
              sx={{
                p: 2,
                borderRadius: 4,
                background: "rgba(255,255,255,0.56)",
                border: "1px solid rgba(122, 156, 156, 0.14)",
              }}
            >
              <Typography sx={{ fontWeight: 700 }}>{template.name || "-"}</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                {template.questionCount} questions | {template.resultCount} results
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                Owner: {template.creator?.first_name || "-"} {template.creator?.last_name || ""}
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap" sx={{ mt: 1.5 }}>
                <Button
                  variant="outlined"
                  disabled={template.resultCount > 0}
                  onClick={() => router.push(`/assessments/staff?edit=${template.assessment_id}`)}
                >
                  Edit
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  disabled={template.resultCount > 0}
                  onClick={() => handleDelete(template.assessment_id)}
                >
                  Delete
                </Button>
                {template.resultCount > 0 && (
                  <Chip size="small" label="Locked after submissions" />
                )}
              </Box>
            </Box>
          ))}
          {templates.length === 0 && (
            <Typography color="text.secondary">No assessment templates yet.</Typography>
          )}
        </Stack>
      </DashboardCard>
    </AppShell>
  );
}
