export interface User {
  id: string;
  clerkId: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface Course {
  id: string;
  userId: string;
  name: string;
  code: string;
  color?: string;
  createdAt: Date;
}

export interface Lecture {
  id: string;
  courseId: string;
  userId: string;
  title: string;
  durationSeconds: number;
  audioUrl?: string;
  slidesUrl?: string;
  transcript?: string;
  status: LectureStatus;
  recordedAt: Date;
  createdAt: Date;
}

export type LectureStatus =
  | "recording"
  | "processing"
  | "transcribing"
  | "generating"
  | "ready"
  | "error";

export interface CheatSheet {
  id: string;
  lectureId: string;
  userId: string;
  title: string;
  content: CheatSheetContent;
  driveUrl?: string;
  createdAt: Date;
}

export interface CheatSheetContent {
  sections: CheatSheetSection[];
  examTips: string[];
  formulas: string[];
}

export interface CheatSheetSection {
  heading: string;
  bullets: string[];
}

export interface Quiz {
  id: string;
  lectureId: string;
  userId: string;
  title: string;
  questions: QuizQuestion[];
  createdAt: Date;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  timestampSeconds?: number;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  answers: number[];
  score: number;
  completedAt: Date;
}

export interface StudySession {
  id: string;
  userId: string;
  lectureId: string;
  scheduledAt: Date;
  completedAt?: Date;
  type: "review" | "quiz" | "cheatsheet";
  calendarEventId?: string;
}

export interface ProcessingStatus {
  lectureId: string;
  stage: "transcribing" | "extracting" | "generating_cheatsheet" | "generating_quiz" | "syncing_drive" | "scheduling_calendar" | "done";
  progress: number;
  error?: string;
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
}
