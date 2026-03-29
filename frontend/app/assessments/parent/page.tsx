"use client";

import type { AxiosError } from "axios";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { AppShell, DashboardCard, PageSkeleton, StatCard } from "@/app/components/app-shell";
import { parentNav } from "@/app/components/navigation";
import api from "@/lib/api";
import type { Profile } from "@/lib/access";
import { formatDate, titleCase } from "@/lib/format";

type ParentContext = {
  children: Array<{
    child_id: number;
    first_name: string | null;
    last_name: string | null;
    birth_date: string | null;
  }>;
  templates: Array<{
    assessment_id: number;
    name: string | null;
    questionCount: number;
    resultCount: number;
  }>;
};

type AssessmentResult = {
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
    recommendation_text: string | null;
  } | null;
  answers?: Array<{
    answer_id: number;
    question: {
      question_id: number;
      question_text: string | null;
    } | null;
    choice: {
      choice_id: number;
      choice_text: string | null;
    } | null;
  }>;
};

type ParentDashboard = {
  summary: {
    totalChildren: number;
    totalTemplates: number;
    totalResults: number;
  };
  recentResults: AssessmentResult[];
};

type TemplateDetail = {
  assessment_id: number;
  name: string | null;
  questions: Array<{
    question_id: number;
    question_text: string;
    choices: Array<{
      choice_id: number;
      choice_text: string;
      score: number | null;
    }>;
  }>;
};

type ApiErrorResponse = {
  message?: string | string[];
};

export default function ParentAssessmentsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [context, setContext] = useState<ParentContext | null>(null);
  const [dashboard, setDashboard] = useState<ParentDashboard | null>(null);
  const [results, setResults] = useState<AssessmentResult[]>([]);
  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedChildId, setSelectedChildId] = useState("");
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const extractMessage = (err: unknown, fallback: string) => {
    const error = err as AxiosError<ApiErrorResponse>;
    const message = error.response?.data?.message;
    return Array.isArray(message) ? message.join(", ") : (message ?? fallback);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        { data: profileData },
        { data: contextData },
        { data: dashboardData },
        { data: resultData },
      ] = await Promise.all([
        api.get<Profile>("/auth/profile"),
        api.get<ParentContext>("/assessment/parent/context"),
        api.get<ParentDashboard>("/assessment/dashboard"),
        api.get<AssessmentResult[]>("/assessment/results"),
      ]);

      setProfile(profileData);
      setContext(contextData);
      setDashboard(dashboardData);
      setResults(resultData);

      if (!selectedChildId && contextData.children[0]) {
        setSelectedChildId(String(contextData.children[0].child_id));
      }

      if (!selectedAssessmentId && contextData.templates[0]) {
        setSelectedAssessmentId(String(contextData.templates[0].assessment_id));
      }
    } catch (err: unknown) {
      const error = err as AxiosError<ApiErrorResponse>;
      if (error.response?.status === 401) {
        localStorage.removeItem("access_token");
        router.push("/login");
        return;
      }
      setError(extractMessage(err, "Unable to load assessments"));
    } finally {
      setLoading(false);
    }
  }, [router, selectedAssessmentId, selectedChildId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const fetchTemplate = async () => {
      if (!selectedAssessmentId) {
        setTemplate(null);
        setAnswers({});
        return;
      }

      setTemplateLoading(true);
      setError("");
      setSuccess("");

      try {
        const { data } = await api.get<TemplateDetail>(
          `/assessment/templates/${selectedAssessmentId}`,
        );
        setTemplate(data);
        setAnswers({});
      } catch (err: unknown) {
        setError(extractMessage(err, "Unable to load assessment template"));
      } finally {
        setTemplateLoading(false);
      }
    };

    void fetchTemplate();
  }, [selectedAssessmentId]);

  const isReadyToSubmit = useMemo(() => {
    if (!template) {
      return false;
    }

    return template.questions.every(
      (question) => answers[question.question_id] !== undefined,
    );
  }, [answers, template]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!selectedChildId) {
      setError("Please select a child profile.");
      return;
    }

    if (!selectedAssessmentId || !template) {
      setError("Please select an assessment template.");
      return;
    }

    if (!isReadyToSubmit) {
      setError("Please answer every question before submitting.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await api.post("/assessment/submit", {
        child_id: Number(selectedChildId),
        assessment_id: Number(selectedAssessmentId),
        answers: template.questions.map((question) => ({
          question_id: question.question_id,
          choice_id: answers[question.question_id],
        })),
      });
      setSuccess("Assessment submitted");
      setAnswers({});
      await load();
    } catch (err: unknown) {
      setError(extractMessage(err, "Unable to submit assessment"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <AppShell
      title="Child Assessments"
      subtitle="Choose a child profile, answer a structured screening set, and keep the interpreted history visible in one family workspace."
      navTitle="Guardian Care"
      navItems={parentNav()}
      badge="Parent"
      profileName={profile?.username}
      profileMeta="Assessment workspace"
      actions={
        <>
          <Button
            variant="contained"
            onClick={() => router.push("/dashboard/parent")}
          >
            Parent overview
          </Button>
          <Button
            variant="outlined"
            onClick={() => router.push("/appointments/parent")}
          >
            Book appointment
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

      <Box
        display="grid"
        gridTemplateColumns={{ xs: "1fr", md: "repeat(3, 1fr)" }}
        gap={2}
        mb={3}
      >
        <StatCard
          label="Children"
          value={dashboard?.summary.totalChildren ?? 0}
        />
        <StatCard
          label="Templates"
          value={dashboard?.summary.totalTemplates ?? 0}
        />
        <StatCard
          label="Results"
          value={dashboard?.summary.totalResults ?? 0}
        />
      </Box>

      <Box
        display="grid"
        gridTemplateColumns={{ xs: "1fr", xl: "1.1fr 0.9fr" }}
        gap={2.5}
      >
        <DashboardCard>
          <Typography variant="h5">Take an assessment</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>
            Parents answer the checklist without seeing raw scoring. The system summarizes whether follow-up booking is recommended.
          </Typography>

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2.25 }}>
            <Stack spacing={2}>
              <TextField
                select
                label="Child"
                value={selectedChildId}
                onChange={(event) => setSelectedChildId(event.target.value)}
              >
                {context?.children.map((child) => (
                  <MenuItem key={child.child_id} value={String(child.child_id)}>
                    {child.first_name || "-"} {child.last_name || ""}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Assessment"
                value={selectedAssessmentId}
                onChange={(event) =>
                  setSelectedAssessmentId(event.target.value)
                }
              >
                {context?.templates.map((item) => (
                  <MenuItem
                    key={item.assessment_id}
                    value={String(item.assessment_id)}
                  >
                    {item.name || "-"} ({item.questionCount} questions)
                  </MenuItem>
                ))}
              </TextField>

              {templateLoading ? (
                <Stack spacing={1.5}>
                  <Skeleton variant="rounded" height={80} sx={{ borderRadius: 2 }} />
                  <Skeleton variant="rounded" height={80} sx={{ borderRadius: 2 }} />
                  <Skeleton variant="rounded" height={80} sx={{ borderRadius: 2 }} />
                </Stack>
              ) : (
                template?.questions.map((question, index) => (
                  <FormControl
                    key={question.question_id}
                    sx={{
                      p: 2,
                      borderRadius: 4,
                      background: "rgba(255,255,255,0.56)",
                      border: "1px solid rgba(122, 156, 156, 0.14)",
                    }}
                  >
                    <FormLabel sx={{ color: "text.primary", fontWeight: 700 }}>
                      {index + 1}. {question.question_text}
                    </FormLabel>
                    <RadioGroup
                      value={
                        answers[question.question_id] !== undefined
                          ? String(answers[question.question_id])
                          : ""
                      }
                      onChange={(event) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [question.question_id]: Number(event.target.value),
                        }))
                      }
                    >
                      {question.choices.map((choice) => (
                        <FormControlLabel
                          key={choice.choice_id}
                          value={String(choice.choice_id)}
                          control={<Radio />}
                          label={choice.choice_text}
                        />
                      ))}
                    </RadioGroup>
                  </FormControl>
                ))
              )}

              <Button
                type="submit"
                variant="contained"
                disabled={!isReadyToSubmit || submitting || templateLoading}
              >
                {submitting ? "Submitting..." : "Submit assessment"}
              </Button>
            </Stack>
          </Box>
        </DashboardCard>

        <Stack spacing={2.5}>
          <DashboardCard>
            <Typography variant="h5">Recent interpreted results</Typography>
            <Stack spacing={1.5} sx={{ mt: 2.25 }}>
              {results.map((result) => (
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
                    {result.child?.first_name || "-"}{" "}
                    {result.child?.last_name || ""}
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                    {result.assessment?.name || "-"} |{" "}
                    {formatDate(result.assessed_at, "en-US")}
                  </Typography>
                  <Box display="flex" gap={1} flexWrap="wrap" sx={{ mt: 1.25 }}>
                    {result.band?.severity_level && (
                      <Chip
                        label={titleCase(result.band.severity_level)}
                        color="primary"
                      />
                    )}
                    <Chip
                      label={
                        result.band?.severity_level &&
                        ["mild", "moderate", "severe"].includes(result.band.severity_level)
                          ? "Booking recommended"
                          : "Monitor first"
                      }
                      color={
                        result.band?.severity_level &&
                        ["moderate", "severe"].includes(result.band.severity_level)
                          ? "warning"
                          : "default"
                      }
                    />
                  </Box>
                  {result.interpreted_text && (
                    <Typography color="text.secondary" sx={{ mt: 1.25 }}>
                      {result.interpreted_text}
                    </Typography>
                  )}
                  {result.band?.recommendation_text && (
                    <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                      Recommendation: {result.band.recommendation_text}
                    </Typography>
                  )}
                  {result.answers && result.answers.length > 0 && (
                    <Stack spacing={1} sx={{ mt: 1.5 }}>
                      {result.answers.map((answer, index) => (
                        <Box
                          key={answer.answer_id}
                          sx={{
                            p: 1.5,
                            borderRadius: 3,
                            background: "rgba(255,255,255,0.45)",
                            border: "1px solid rgba(122, 156, 156, 0.12)",
                          }}
                        >
                          <Typography sx={{ fontWeight: 700 }}>
                            {index + 1}. {answer.question?.question_text || "-"}
                          </Typography>
                          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                            Selected answer: {answer.choice?.choice_text || "-"}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  )}
                  <Button
                    variant="outlined"
                    sx={{ mt: 1.5 }}
                    onClick={() => router.push("/appointments/parent")}
                  >
                    Book appointment
                  </Button>
                </Box>
              ))}
              {results.length === 0 && (
                <Typography color="text.secondary">
                  No assessment results yet.
                </Typography>
              )}
            </Stack>
          </DashboardCard>

          <DashboardCard>
            <Typography variant="h5">Latest family activity</Typography>
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
                    {result.assessment?.name || "-"}
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                    {result.child?.first_name || "-"}{" "}
                    {result.child?.last_name || ""}
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                    {formatDate(result.assessed_at, "en-US")}
                  </Typography>
                </Box>
              ))}
              {dashboard?.recentResults.length === 0 && (
                <Typography color="text.secondary">No activity yet.</Typography>
              )}
            </Stack>
          </DashboardCard>
        </Stack>
      </Box>
    </AppShell>
  );
}
