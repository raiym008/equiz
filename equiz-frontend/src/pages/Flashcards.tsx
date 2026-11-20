import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { FlashcardStudyItem } from '../types';
import { questionService } from '../services/question.service';

const Flashcards: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [allCards, setAllCards] = useState<FlashcardStudyItem[]>([]);
  const [queue, setQueue] = useState<FlashcardStudyItem[]>([]);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadCards = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await questionService.getDeckFlashcards(id);
      setAllCards(data);
      setQueue(data.filter((c) => c.status !== 'known'));
      setIsFlipped(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Қате шықты');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const handleMark = useCallback(
    async (status: 'known' | 'review') => {
      if (!id || queue.length === 0 || busy) return;
      const current = queue[0];
      setBusy(true);
      try {
        await questionService.markFlashcard(id, current.id, status);

        setAllCards((prev) =>
          prev.map((c) => (c.id === current.id ? { ...c, status } : c))
        );

        setIsFlipped(false);
        setQueue((prev) => {
          const [, ...rest] = prev;
          return status === 'review' ? [...rest, { ...current, status }] : rest;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Сақтау қатесі');
      } finally {
        setBusy(false);
      }
    },
    [id, queue, busy]
  );

  const handleReset = async () => {
    if (!id) return;
    setBusy(true);
    try {
      await questionService.resetFlashcards(id);
      await loadCards();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Қайта бастау сәтсіз аяқталды');
    } finally {
      setBusy(false);
    }
  };

  // Пернетақтамен жылдам басқару (Space — аудару, 1/← — Қайталау, 2/→ — Білдім)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (queue.length === 0 || busy) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped((f) => !f);
      } else if (e.key === '1' || e.key === 'ArrowLeft') {
        handleMark('review');
      } else if (e.key === '2' || e.key === 'ArrowRight') {
        handleMark('known');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [queue.length, busy, handleMark]);

  if (loading) {
    return (
      <div className="eq-fc-page">
        <div className="eq-fc-center">Жүктелуде...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="eq-fc-page">
        <div className="eq-fc-center">
          <p style={{ color: '#dc2626', marginBottom: 16 }}>{error}</p>
          <button type="button" className="eq-fc-btn-primary" onClick={() => navigate('/')}>
            Басты бетке оралу
          </button>
        </div>
      </div>
    );
  }

  const totalCount = allCards.length;
  const knownCount = allCards.filter((c) => c.status === 'known').length;
  const progressPercent = totalCount > 0 ? Math.round((knownCount / totalCount) * 100) : 0;
  const currentCard = queue[0];

  return (
    <div className="eq-fc-page">
      <style>{`
        .eq-fc-page {
          min-height: 100vh;
          background: #f6f9fe;
          color: #0f172a;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 24px 16px 64px;
        }
        .eq-fc-wrap {
          max-width: 680px;
          margin: 0 auto;
        }
        .eq-fc-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 18px;
          gap: 12px;
        }
        .eq-fc-back {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 999px;
          padding: 8px 16px;
          font-size: 0.88rem;
          font-weight: 600;
          cursor: pointer;
          color: #1e293b;
        }
        .eq-fc-stats {
          font-size: 0.88rem;
          font-weight: 600;
          color: #475569;
        }
        .eq-fc-progress-track {
          width: 100%;
          height: 8px;
          background: #e2e8f0;
          border-radius: 999px;
          overflow: hidden;
          margin-bottom: 28px;
        }
        .eq-fc-progress-fill {
          height: 100%;
          background: #7c3aed;
          transition: width 0.3s ease;
        }
        .eq-fc-scene {
          perspective: 1000px;
          margin-bottom: 24px;
        }
        .eq-fc-card {
          position: relative;
          width: 100%;
          min-height: 300px;
          cursor: pointer;
          transform-style: preserve-3d;
          transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .eq-fc-card.is-flipped {
          transform: rotateY(180deg);
        }
        .eq-fc-face {
          position: absolute;
          inset: 0;
          backface-visibility: hidden;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 32px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
        }
        .eq-fc-face.back {
          transform: rotateY(180deg);
          background: #faf5ff;
          border-color: #d8b4fe;
        }
        .eq-fc-side-label {
          position: absolute;
          top: 18px;
          left: 22px;
          font-size: 0.78rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #94a3b8;
        }
        .eq-fc-face.back .eq-fc-side-label { color: #7c3aed; }
        .eq-fc-text {
          font-size: 1.35rem;
          font-weight: 700;
          line-height: 1.5;
          white-space: pre-line;
        }
        .eq-fc-hint {
          position: absolute;
          bottom: 16px;
          font-size: 0.8rem;
          color: #94a3b8;
        }
        .eq-fc-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .eq-fc-btn-review, .eq-fc-btn-known {
          padding: 14px 20px;
          border-radius: 12px;
          font-size: 0.98rem;
          font-weight: 700;
          cursor: pointer;
          border: 1.5px solid transparent;
          transition: transform 0.12s ease, opacity 0.15s ease;
        }
        .eq-fc-btn-review {
          background: #fff7ed;
          color: #c2410c;
          border-color: #fdba74;
        }
        .eq-fc-btn-review:hover:not(:disabled) { background: #ffedd5; }
        .eq-fc-btn-known {
          background: #ecfdf5;
          color: #047857;
          border-color: #6ee7b7;
        }
        .eq-fc-btn-known:hover:not(:disabled) { background: #d1fae5; }
        .eq-fc-btn-primary {
          background: #7c3aed;
          color: #ffffff;
          border: none;
          padding: 12px 24px;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .eq-fc-done-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 48px 28px;
          text-align: center;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
        }
        .eq-fc-center { text-align: center; padding: 60px 16px; color: #64748b; }
      `}</style>

      <div className="eq-fc-wrap">
        <div className="eq-fc-top">
          <button type="button" className="eq-fc-back" onClick={() => navigate('/')}>
            ← Басты бетке
          </button>
          <span className="eq-fc-stats">
            Меңгерілді: {knownCount} / {totalCount} · Қалғаны: {queue.length}
          </span>
        </div>

        <div className="eq-fc-progress-track">
          <div className="eq-fc-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>

        {totalCount === 0 ? (
          <div className="eq-fc-done-card">
            <h3>Бұл материалда карточкалар жоқ</h3>
            <p style={{ color: '#64748b', marginBottom: 20 }}>
              Редактор арқылы жаңа карточкалар қосыңыз.
            </p>
            <button type="button" className="eq-fc-btn-primary" onClick={() => navigate(`/edit/${id}`)}>
              Редакторға өту
            </button>
          </div>
        ) : !currentCard ? (
          <div className="eq-fc-done-card">
            <h2 style={{ margin: '0 0 8px 0' }}>Барлық карточкалар меңгерілді!</h2>
            <p style={{ color: '#64748b', marginBottom: 24 }}>
              {totalCount} карточканың барлығын «Білдім» деп белгіледіңіз.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="eq-fc-btn-primary" onClick={handleReset} disabled={busy}>
                Қайтадан оқу
              </button>
              <button type="button" className="eq-fc-back" onClick={() => navigate('/')}>
                Басты бетке оралу
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="eq-fc-scene">
              <div
                className={`eq-fc-card ${isFlipped ? 'is-flipped' : ''}`}
                onClick={() => setIsFlipped((f) => !f)}
              >
                <div className="eq-fc-face front">
                  <span className="eq-fc-side-label">Сұрақ / Термин</span>
                  <div className="eq-fc-text">{currentCard.front}</div>
                  <span className="eq-fc-hint">Жауабын көру үшін басыңыз (Space)</span>
                </div>
                <div className="eq-fc-face back">
                  <span className="eq-fc-side-label">Жауап / Анықтама</span>
                  <div className="eq-fc-text">{currentCard.back}</div>
                  <span className="eq-fc-hint">Алдыңғы бетке қайту үшін басыңыз</span>
                </div>
              </div>
            </div>

            <div className="eq-fc-actions">
              <button
                type="button"
                className="eq-fc-btn-review"
                disabled={busy}
                onClick={() => handleMark('review')}
              >
                ↺ Қайталау керек (←)
              </button>
              <button
                type="button"
                className="eq-fc-btn-known"
                disabled={busy}
                onClick={() => handleMark('known')}
              >
                ✓ Білдім (→)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Flashcards;