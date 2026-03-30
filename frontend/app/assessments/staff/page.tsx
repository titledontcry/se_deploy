"use client";

import type { AxiosError } from "axios";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { AppShell, DashboardCard, PageSkeleton, StatCard } from "@/app/components/app-shell";
import { staffNav } from "@/app/components/navigation";
import api from "@/lib/api";
import type { Profile } from "@/lib/access";
import { titleCase } from "@/lib/format";

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

type TemplateDetail = TemplateSummary & {
  scoreBands: Array<{
    band_id?: number;
    min_score: number;
    max_score: number;
    severity_level: "normal" | "mild" | "moderate" | "severe";
    interpretation_text: string;
    recommendation_text: string | null;
  }>;
  questions: Array<{
    question_id?: number;
    question_text: string;
    choices: Array<{
      choice_id?: number;
      choice_text: string;
      score: number;
    }>;
  }>;
};

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
  templates: TemplateSummary[];
  recentResults: ResultSummary[];
};

type TemplateFormState = {
  name: string;
  questions: Array<{
    question_text: string;
    choices: Array<{
      choice_text: string;
      score: number;
    }>;
  }>;
  scoreBands: Array<{
    min_score: number;
    max_score: number;
    severity_level: "normal" | "mild" | "moderate" | "severe";
    interpretation_text: string;
    recommendation_text: string;
  }>;
};

type ApiErrorResponse = {
  message?: string | string[];
};

const severityOptions: Array<
  TemplateFormState["scoreBands"][number]["severity_level"]
> = ["normal", "mild", "moderate", "severe"];

function createEmptyTemplate(): TemplateFormState {
  return {
    name: "",
    questions: [
      {
        question_text: "",
        choices: [
          { choice_text: "Never", score: 0 },
          { choice_text: "Sometimes", score: 1 },
        ],
      },
    ],
    scoreBands: [
      {
        min_score: 0,
        max_score: 2,
        severity_level: "normal",
        interpretation_text: "",
        recommendation_text: "",
      },
    ],
  };
}

export default function StaffAssessmentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dashboard, setDashboard] = useState<StaffAssessmentDashboard | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TemplateFormState>(createEmptyTemplate());

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
        { data: dashboardData },
      ] = await Promise.all([
        api.get<Profile>("/auth/profile"),
        api.get<StaffAssessmentDashboard>("/assessment/dashboard"),
      ]);

      setProfile(profileData);
      setDashboard(dashboardData);
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
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (editId) void handleEdit(Number(editId));
  }, [searchParams]);

  const resetForm = () => {
    setEditingId(null);
    setForm(createEmptyTemplate());
  };

  const handleEdit = async (assessmentId: number) => {
    setError("");
    setSuccess("");

    try {
      const { data } = await api.get<TemplateDetail>(
        `/assessment/templates/${assessmentId}`,
      );
      setEditingId(assessmentId);
      setForm({
        name: data.name || "",
        questions: data.questions.map((question) => ({
          question_text: question.question_text,
          choices: question.choices.map((choice) => ({
            choice_text: choice.choice_text,
            score: Number(choice.score ?? 0),
          })),
        })),
        scoreBands: data.scoreBands.map((band) => ({
          min_score: band.min_score,
          max_score: band.max_score,
          severity_level: band.severity_level,
          interpretation_text: band.interpretation_text,
          recommendation_text: band.recommendation_text || "",
        })),
      });
    } catch (err: unknown) {
      setError(extractMessage(err, "Unable to load template"));
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (editingId) {
        await api.patch(`/assessment/templates/${editingId}`, form);
        setSuccess("Assessment template updated");
      } else {
        await api.post("/assessment/templates", form);
        setSuccess("Assessment template created");
      }

      resetForm();
      await load();
    } catch (err: unknown) {
      setError(extractMessage(err, "Unable to save assessment template"));
    } finally {
      setSaving(false);
    }
  };

  const updateQuestion = (questionIndex: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((question, index) =>
        index === questionIndex
          ? { ...question, question_text: value }
          : question,
      ),
    }));
  };

  const updateChoice = (
    questionIndex: number,
    choiceIndex: number,
    key: "choice_text" | "score",
    value: string,
  ) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((question, qIndex) =>
        qIndex === questionIndex
          ? {
              ...question,
              choices: question.choices.map((choice, cIndex) =>
                cIndex === choiceIndex
                  ? {
                      ...choice,
                      [key]: key === "score" ? Number(value) : value,
                    }
                  : choice,
              ),
            }
          : question,
      ),
    }));
  };

  const updateBand = (
    bandIndex: number,
    key:
      | "min_score"
      | "max_score"
      | "severity_level"
      | "interpretation_text"
      | "recommendation_text",
    value: string,
  ) => {
    setForm((prev) => ({
      ...prev,
      scoreBands: prev.scoreBands.map((band, index) =>
        index === bandIndex
          ? {
              ...band,
              [key]:
                key === "min_score" || key === "max_score"
                  ? Number(value)
                  : value,
            }
          : band,
      ),
    }));
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <AppShell
      title="Assessment Builder"
      subtitle="Design assessment templates, keep score bands explicit, and watch recent child submissions from the same workspace."
      navTitle="Clinic Ops"
      navItems={staffNav(profile)}
      badge="Staff"
      profileName={profile?.username}
      profileMeta="Assessment operations"
      actions={
        <>
          <Button
            variant="contained"
            onClick={() => router.push("/dashboard/staff")}
          >
            Staff overview
          </Button>
          <Button variant="outlined" onClick={resetForm}>
            New template
          </Button>
          <Button
            variant="outlined"
            onClick={() => router.push("/assessments/staff/templates")}
          >
            Template library
          </Button>
          <Button
            variant="outlined"
            onClick={() => router.push("/assessments/staff/submissions")}
          >
            Recent submissions
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
          label="Templates"
          value={dashboard?.summary.totalTemplates ?? 0}
        />
        <StatCard
          label="Results"
          value={dashboard?.summary.totalResults ?? 0}
        />
        <StatCard
          label="Children assessed"
          value={dashboard?.summary.totalChildrenAssessed ?? 0}
        />
      </Box>

      <DashboardCard>
          <Box
            display="flex"
            justifyContent="space-between"
            gap={2}
            flexWrap="wrap"
          >
            <Box>
              <Typography variant="h5">
                {editingId
                  ? `Edit template #${editingId}`
                  : "Create assessment template"}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                Keep questions and score bands in one payload so results stay
                consistent.
              </Typography>
            </Box>
            {editingId && (
              <Button variant="outlined" onClick={resetForm}>
                Cancel edit
              </Button>
            )}
          </Box>

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2.25 }}>
            <Stack spacing={2}>
              <TextField
                label="Assessment name"
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
                required
              />

              <Divider flexItem />

              <Typography variant="h6">Questions</Typography>
              {form.questions.map((question, questionIndex) => (
                <Box
                  key={`question-${questionIndex}`}
                  sx={{
                    p: 2,
                    borderRadius: 4,
                    background: "rgba(255,255,255,0.56)",
                    border: "1px solid rgba(122, 156, 156, 0.14)",
                  }}
                >
                  <Stack spacing={1.5}>
                    <TextField
                      label={`Question ${questionIndex + 1}`}
                      value={question.question_text}
                      onChange={(event) =>
                        updateQuestion(questionIndex, event.target.value)
                      }
                      required
                    />
                    {question.choices.map((choice, choiceIndex) => (
                      <Box
                        key={`choice-${questionIndex}-${choiceIndex}`}
                        display="grid"
                        gridTemplateColumns={{
                          xs: "1fr",
                          md: "minmax(0,1fr) 120px auto",
                        }}
                        gap={1.25}
                      >
                        <TextField
                          label={`Choice ${choiceIndex + 1}`}
                          value={choice.choice_text}
                          onChange={(event) =>
                            updateChoice(
                              questionIndex,
                              choiceIndex,
                              "choice_text",
                              event.target.value,
                            )
                          }
                          required
                        />
                        <TextField
                          label="Score"
                          type="number"
                          value={choice.score}
                          onChange={(event) =>
                            updateChoice(
                              questionIndex,
                              choiceIndex,
                              "score",
                              event.target.value,
                            )
                          }
                          required
                        />
                        <Button
                          variant="outlined"
                          color="error"
                          disabled={question.choices.length <= 2}
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              questions: prev.questions.map((item, index) =>
                                index === questionIndex
                                  ? {
                                      ...item,
                                      choices: item.choices.filter(
                                        (_, currentIndex) =>
                                          currentIndex !== choiceIndex,
                                      ),
                                    }
                                  : item,
                              ),
                            }))
                          }
                        >
                          Remove
                        </Button>
                      </Box>
                    ))}
                    <Box display="flex" gap={1.25} flexWrap="wrap">
                      <Button
                        variant="outlined"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            questions: prev.questions.map((item, index) =>
                              index === questionIndex
                                ? {
                                    ...item,
                                    choices: [
                                      ...item.choices,
                                      { choice_text: "", score: 0 },
                                    ],
                                  }
                                : item,
                            ),
                          }))
                        }
                      >
                        Add choice
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        disabled={form.questions.length <= 1}
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            questions: prev.questions.filter(
                              (_, index) => index !== questionIndex,
                            ),
                          }))
                        }
                      >
                        Remove question
                      </Button>
                    </Box>
                  </Stack>
                </Box>
              ))}

              <Button
                variant="outlined"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    questions: [
                      ...prev.questions,
                      {
                        question_text: "",
                        choices: [
                          { choice_text: "", score: 0 },
                          { choice_text: "", score: 1 },
                        ],
                      },
                    ],
                  }))
                }
              >
                Add question
              </Button>

              <Divider flexItem />

              <Typography variant="h6">Score bands</Typography>
              {form.scoreBands.map((band, bandIndex) => (
                <Box
                  key={`band-${bandIndex}`}
                  sx={{
                    p: 2,
                    borderRadius: 4,
                    background: "rgba(255,255,255,0.56)",
                    border: "1px solid rgba(122, 156, 156, 0.14)",
                  }}
                >
                  <Stack spacing={1.5}>
                    <Box
                      display="grid"
                      gridTemplateColumns={{ xs: "1fr", md: "repeat(3, 1fr)" }}
                      gap={1.25}
                    >
                      <TextField
                        label="Min score"
                        type="number"
                        value={band.min_score}
                        onChange={(event) =>
                          updateBand(bandIndex, "min_score", event.target.value)
                        }
                        required
                      />
                      <TextField
                        label="Max score"
                        type="number"
                        value={band.max_score}
                        onChange={(event) =>
                          updateBand(bandIndex, "max_score", event.target.value)
                        }
                        required
                      />
                      <TextField
                        select
                        label="Severity"
                        value={band.severity_level}
                        onChange={(event) =>
                          updateBand(
                            bandIndex,
                            "severity_level",
                            event.target.value,
                          )
                        }
                      >
                        {severityOptions.map((option) => (
                          <MenuItem key={option} value={option}>
                            {titleCase(option)}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Box>
                    <TextField
                      label="Interpretation"
                      value={band.interpretation_text}
                      onChange={(event) =>
                        updateBand(
                          bandIndex,
                          "interpretation_text",
                          event.target.value,
                        )
                      }
                      required
                    />
                    <TextField
                      label="Recommendation"
                      value={band.recommendation_text}
                      onChange={(event) =>
                        updateBand(
                          bandIndex,
                          "recommendation_text",
                          event.target.value,
                        )
                      }
                    />
                    <Button
                      variant="outlined"
                      color="error"
                      disabled={form.scoreBands.length <= 1}
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          scoreBands: prev.scoreBands.filter(
                            (_, index) => index !== bandIndex,
                          ),
                        }))
                      }
                    >
                      Remove band
                    </Button>
                  </Stack>
                </Box>
              ))}

              <Button
                variant="outlined"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    scoreBands: [
                      ...prev.scoreBands,
                      {
                        min_score: 0,
                        max_score: 0,
                        severity_level: "mild",
                        interpretation_text: "",
                        recommendation_text: "",
                      },
                    ],
                  }))
                }
              >
                Add score band
              </Button>

              <Button type="submit" variant="contained" disabled={saving}>
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update template"
                    : "Create template"}
              </Button>
            </Stack>
          </Box>
        </DashboardCard>
    </AppShell>
  );
}
