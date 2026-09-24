// The one place plans are defined. The landing page, /pricing and the in-app
// billing page all read from here — three separate copies had already drifted
// into advertising limits and features that no longer existed.
//
// Limits must match packages/api/src/services/usage.ts (LIMITS, MAX_RECORDING_MINUTES).

export type PaidPlanId = "student" | "semester" | "annual";
export type PlanId = "free" | PaidPlanId;

export interface Plan {
  id: PlanId;
  name: string;
  price: string;
  period: string;
  perMonth?: string;   // shown under multi-month plans
  billing: string;
  tagline: string;
  badge?: string;
  recommended?: boolean;
  limits: string[];
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "",
    billing: "No card needed",
    tagline: "Two lectures, start to finish.",
    limits: ["2 lectures", "20 questions", "Recordings up to 90 minutes"],
  },
  {
    id: "student",
    name: "Student",
    price: "$9.99",
    period: "/month",
    billing: "Billed monthly",
    tagline: "Your entire semester, remembered.",
    limits: ["20 hours of recording a month", "150 questions a month", "Recordings up to 3 hours"],
  },
  {
    id: "semester",
    name: "Semester",
    price: "$34.99",
    period: "/4 months",
    perMonth: "$8.75/month",
    billing: "Billed every 4 months",
    tagline: "Pay once per semester.",
    badge: "Save 12%",
    limits: ["20 hours of recording a month", "150 questions a month", "Recordings up to 3 hours"],
  },
  {
    id: "annual",
    name: "Annual",
    price: "$69.99",
    period: "/year",
    perMonth: "Just $5.83/month",
    billing: "Billed yearly",
    tagline: "Best value for the whole degree.",
    badge: "Save 42%",
    recommended: true,
    limits: ["20 hours of recording a month", "150 questions a month", "Recordings up to 3 hours"],
  },
];

export const PLAN_FEATURES = [
  "Lecture recording",
  "Live transcription",
  "Automatic structured notes",
  "Board & slide capture",
  "STEM & maths notation",
  "Course memory",
  "Ask about previous lectures",
  "Timestamp citations",
  "Flashcards",
  "Quizzes",
  "Photos of the board & your notes",
  "Search across the entire course",
];

export const PLAN_LABEL: Record<string, string> = Object.fromEntries(PLANS.map(p => [p.id, p.name]));
