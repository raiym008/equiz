import type {
  DeckCreatePayload,
  DeckOut,
  DeckSummary,
  StudyItemDraft,
} from '../types';
import { env } from "../config/env";

export const api = {
  get: (endpoint: string) =>
    fetch(`${env.API_BASE_URL}${endpoint}`),

  post: (endpoint: string, data: unknown) =>
    fetch(`${env.API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }),
};

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `Қате: ${res.status}`;
    try {
      const err = await res.json();
      if (err?.detail) {
        detail = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export async function parseDocxFile(file: File): Promise<StudyItemDraft[]> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${env}/decks/parse`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse<StudyItemDraft[]>(res);
}

export async function listDecks(): Promise<DeckSummary[]> {
  const res = await fetch(`${env}/decks`);
  return handleResponse<DeckSummary[]>(res);
}

export async function getDeck(deckId: string): Promise<DeckOut> {
  const res = await fetch(`${env}/decks/${deckId}`);
  return handleResponse<DeckOut>(res);
}

export async function createDeck(payload: DeckCreatePayload): Promise<DeckOut> {
  const res = await fetch(`${env}/decks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<DeckOut>(res);
}

export async function updateDeck(
  deckId: string,
  payload: DeckCreatePayload
): Promise<DeckOut> {
  const res = await fetch(`${env}/decks/${deckId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<DeckOut>(res);
}

export async function deleteDeck(deckId: string): Promise<void> {
  const res = await fetch(`${env}/decks/${deckId}`, {
    method: 'DELETE',
  });
  await handleResponse<{ message: string }>(res);
}