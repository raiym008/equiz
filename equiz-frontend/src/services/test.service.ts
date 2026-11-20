import { api } from './api';
import type {
  DeckCreatePayload,
  DeckOut,
  DeckSummary,
  QuizSessionOut,
  SharedQuizInfo,
  StudyItemDraft,
} from '../types';

export const testService = {
  listDecks: (signal?: AbortSignal): Promise<DeckSummary[]> =>
    api.get<DeckSummary[]>('/decks', { signal }),

  getDeck: (deckId: string, signal?: AbortSignal): Promise<DeckOut> =>
    api.get<DeckOut>(`/decks/${deckId}`, { signal }),

  createDeck: (payload: DeckCreatePayload, signal?: AbortSignal): Promise<DeckOut> =>
    api.post<DeckOut>('/decks', payload, { signal }),

  updateDeck: (
    deckId: string,
    payload: DeckCreatePayload,
    signal?: AbortSignal
  ): Promise<DeckOut> =>
    api.put<DeckOut>(`/decks/${deckId}`, payload, { signal }),

  deleteDeck: async (deckId: string, signal?: AbortSignal): Promise<void> => {
    await api.delete<{ message: string }>(`/decks/${deckId}`, { signal });
  },

  parseDocxFile: (file: File, signal?: AbortSignal): Promise<StudyItemDraft[]> => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<StudyItemDraft[]>('/decks/parse', formData, { signal });
  },

  getQuizSession: (deckId: string, signal?: AbortSignal): Promise<QuizSessionOut> =>
    api.get<QuizSessionOut>(`/decks/${deckId}/quiz`, { signal }),

  getPublicQuizInfo: (shareCode: string, signal?: AbortSignal): Promise<SharedQuizInfo> =>
    api.get<SharedQuizInfo>(`/public/quizzes/${shareCode}`, { signal }),

  startPublicQuiz: (
    shareCode: string,
    participantName: string,
    signal?: AbortSignal
  ): Promise<QuizSessionOut> =>
    api.post<QuizSessionOut>(
      `/public/quizzes/${shareCode}/start`,
      { participant_name: participantName },
      { signal }
    ),

  resumePublicAttempt: (
    attemptId: string,
    token: string,
    signal?: AbortSignal
  ): Promise<QuizSessionOut> =>
    api.get<QuizSessionOut>(`/public/attempts/${attemptId}`, {
      headers: { 'X-Attempt-Token': token },
      signal,
    }),
};
