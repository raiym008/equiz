export interface McqPayload {
  question: string;
  options: Record<string, string>;
  correct_keys: string[];
  is_multi?: boolean;
  explanation?: string;
}

export interface FlashcardPayload {
  front: string;
  back: string;
}

export interface McqDraft {
  id?: string;
  order_index?: number;
  points?: number;
  item_type: 'mcq';
  payload: McqPayload;
}

export interface FlashcardDraft {
  id?: string;
  order_index?: number;
  points?: number;
  item_type: 'flashcard';
  payload: FlashcardPayload;
}

export type StudyItemDraft = McqDraft | FlashcardDraft;

export interface DeckSettings {
  time_limit_sec: number | null;
}

export interface DeckCreatePayload {
  title: string;
  description?: string | null;
  is_active?: boolean;
  settings?: DeckSettings;
  items: StudyItemDraft[];
}

export interface DeckOut {
  id: string;
  share_code: string;
  title: string;
  description: string | null;
  is_active: boolean;
  settings?: DeckSettings;
  items: StudyItemDraft[];
  created_at: string;
}

export interface DeckSummary {
  id: string;
  share_code: string;
  title: string;
  description: string | null;
  is_active: boolean;
  item_count: number;
  mcq_count: number;
  flashcard_count: number;
  attempt_count: number;
  created_at: string;
}

export interface SharedQuizInfo {
  share_code: string;
  title: string;
  description: string | null;
  question_count: number;
  time_limit_sec: number | null;
  is_active: boolean;
}

export interface McqPublicPayload {
  question: string;
  options: Record<string, string>;
  is_multi: boolean;
}

export interface QuizItemPublic {
  id: string;
  order_index: number;
  points: number;
  payload: McqPublicPayload;
}

export interface QuizSessionOut {
  attempt_id: string;
  session_token?: string | null;
  participant_name: string;
  status: 'in_progress' | 'completed';
  deck_id: string;
  title: string;
  settings: {
    time_limit_sec: number | null;
  };
  started_at: string;
  remaining_seconds: number | null;
  items: QuizItemPublic[];
}

export interface FlashcardStudyItem {
  id: string;
  front: string;
  back: string;
  status: 'new' | 'known' | 'review';
}

export interface PublicFlashcardItem {
  id: string;
  question: string;
  answer: string;
}

export interface AnswerCheckResponse {
  item_id?: string;
  is_correct?: boolean;
  correct_keys: string[];
}

export interface QuizAnswerItem {
  item_id: string;
  selected_keys: string[];
}

export interface QuizSubmitPayload {
  answers: QuizAnswerItem[];
}

export interface QuizQuestionResult {
  item_id: string;
  question: string;
  options: Record<string, string>;
  selected_keys: string[];
  correct_keys: string[];
  points_earned: number;
  max_points: number;
  is_correct: boolean;
}

export interface QuizAttemptOut {
  id: string;
  attempt_id: string;
  participant_name: string;
  status: 'in_progress' | 'completed';
  is_late: boolean;
  deck_id: string;
  deck_title: string;
  score: number | null;
  max_score: number | null;
  created_at: string;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  details: QuizQuestionResult[];
}