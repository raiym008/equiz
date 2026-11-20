import { api } from './api';
import type { QuizAttemptOut, QuizSubmitPayload } from '../types';

export const resultService = {
  submitDeckQuiz: (
    deckId: string,
    payload: QuizSubmitPayload,
    signal?: AbortSignal
  ): Promise<QuizAttemptOut> =>
    api.post<QuizAttemptOut>(`/decks/${deckId}/quiz/submit`, payload, { signal }),

  submitPublicAttempt: (
    attemptId: string,
    token: string,
    payload: QuizSubmitPayload,
    signal?: AbortSignal
  ): Promise<QuizAttemptOut> =>
    api.post<QuizAttemptOut>(`/public/attempts/${attemptId}/submit`, payload, {
      headers: { 'X-Attempt-Token': token },
      signal,
    }),

  listResults: (signal?: AbortSignal): Promise<QuizAttemptOut[]> =>
    api.get<QuizAttemptOut[]>('/results', { signal }),

  getResult: (resultId: string, signal?: AbortSignal): Promise<QuizAttemptOut> =>
    api.get<QuizAttemptOut>(`/results/${resultId}`, { signal }),

  getDeckResults: (deckId: string, signal?: AbortSignal): Promise<QuizAttemptOut[]> =>
    api.get<QuizAttemptOut[]>(`/decks/${deckId}/results`, { signal }),
};