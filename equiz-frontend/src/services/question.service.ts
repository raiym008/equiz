import { api } from './api';
import type {
  AnswerCheckResponse,
  FlashcardStudyItem,
  PublicFlashcardItem,
} from '../types';

export const questionService = {
  getDeckFlashcards: (
    deckId: string,
    signal?: AbortSignal
  ): Promise<FlashcardStudyItem[]> =>
    api.get<FlashcardStudyItem[]>(`/decks/${deckId}/flashcards`, { signal }),

  markFlashcard: (
    deckId: string,
    cardId: string,
    status: 'known' | 'review',
    signal?: AbortSignal
  ): Promise<void> =>
    api.post<void>(
      `/decks/${deckId}/flashcards/${cardId}/mark`,
      { status },
      { signal }
    ),

  resetFlashcards: (deckId: string, signal?: AbortSignal): Promise<void> =>
    api.post<void>(`/decks/${deckId}/flashcards/reset`, undefined, { signal }),

  getPublicFlashcards: (
    shareCode: string,
    signal?: AbortSignal
  ): Promise<PublicFlashcardItem[]> =>
    api.get<PublicFlashcardItem[]>(`/public/quizzes/${shareCode}/flashcards`, {
      signal,
    }),

  checkPublicAnswer: (
    attemptId: string,
    token: string,
    itemId: string,
    selectedKeys: string[],
    signal?: AbortSignal
  ): Promise<AnswerCheckResponse> =>
    api.post<AnswerCheckResponse>(
      `/public/attempts/${attemptId}/check`,
      { item_id: itemId, selected_keys: selectedKeys },
      {
        headers: { 'X-Attempt-Token': token },
        signal,
      }
    ),
};
