import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { QuizAttemptOut, QuizSessionOut } from '../types';
import { api } from '../api/equizapi' 

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const Quiz: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<QuizSessionOut | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoSubmittedRef = useRef(false);

  const storageKey = id ? `equiz_end_at_${id}` : '';

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`${api}/decks/${id}/quiz`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Тест табылмады');
        }
        return res.json();
      })
      .then((data: QuizSessionOut) => {
        setSession(data);
        const limitSec = data.settings?.time_limit_sec;
        if (limitSec && limitSec > 0) {
          const savedEnd = Number(sessionStorage.getItem(`equiz_end_at_${id}`));
          const endAt =
            savedEnd && savedEnd > Date.now()
              ? savedEnd
              : Date.now() + limitSec * 1000;
          sessionStorage.setItem(`equiz_end_at_${id}`, String(endAt));
          setSecondsLeft(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Қате шықты'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = useCallback(async () => {
    if (!session || !id || autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    setSubmitting(true);
    setError(null);
    if (storageKey) sessionStorage.removeItem(storageKey);

    try {
      const payload = {
        answers: session.items.map((item) => ({
          item_id: item.id,
          selected_keys: answers[item.id] || [],
        })),
      };
      const res = await fetch(`${api}/decks/${id}/quiz/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Нәтижені жіберу сәтсіз аяқталды');
      }
      const attempt: QuizAttemptOut = await res.json();
      navigate(`/result/${attempt.id}`);
    } catch (err) {
      autoSubmittedRef.current = false;
      setError(err instanceof Error ? err.message : 'Сервермен байланыс жоқ');
      setSubmitting(false);
    }
  }, [session, id, answers, navigate, storageKey]);

  // Кері санақ таймері
  useEffect(() => {
    if (!session?.settings?.time_limit_sec || !storageKey) return;

    const tick = () => {
      const endAt = Number(sessionStorage.getItem(storageKey));
      if (!endAt) return;
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0 && !autoSubmittedRef.current) {
        handleSubmit();
      }
    };

    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [session, storageKey, handleSubmit]);

  const handleExit = () => {
    if (storageKey) sessionStorage.removeItem(storageKey);
    navigate('/');
  };

  const toggleOption = (itemId: string, key: string, isMulti: boolean) => {
    setAnswers((prev) => {
      const current = prev[itemId] || [];
      if (!isMulti) {
        return {
          ...prev,
          [itemId]: current.includes(key) ? [] : [key],
        };
      }
      const exists = current.includes(key);
      return {
        ...prev,
        [itemId]: exists ? current.filter((k) => k !== key) : [...current, key],
      };
    });
  };

  if (loading) {
    return (
      <div className="eq-quiz-page">
        <div className="eq-quiz-empty">Жүктелуде...</div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="eq-quiz-page">
        <div className="eq-quiz-card" style={{ textAlign: 'center', maxWidth: 480, margin: '60px auto' }}>
          <p style={{ color: '#dc2626', marginBottom: 16 }}>{error || 'Тест табылмады'}</p>
          <button type="button" className="eq-btn-primary" onClick={handleExit}>
            Басты бетке оралу
          </button>
        </div>
      </div>
    );
  }

  const currentItem = session.items[currentIdx];
  const selectedKeys = answers[currentItem.id] || [];
  const answeredCount = session.items.filter((i) => (answers[i.id] || []).length > 0).length;
  const progressPercent = Math.round(((currentIdx + 1) / session.items.length) * 100);
  const isLast = currentIdx === session.items.length - 1;
  const isDangerTime = secondsLeft !== null && secondsLeft <= 60;

  return (
    <div className="eq-quiz-page">
      <style>{`
        .eq-quiz-page {
          min-height: 100vh;
          background: #f6f9fe;
          color: #0f172a;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 24px 16px 64px;
        }
        .eq-quiz-wrap {
          max-width: 780px;
          margin: 0 auto;
        }
        .eq-quiz-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 18px;
          gap: 12px;
          flex-wrap: wrap;
        }
        .eq-back-btn {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 999px;
          padding: 8px 16px;
          font-size: 0.88rem;
          font-weight: 600;
          cursor: pointer;
          color: #1e293b;
        }
        .eq-back-btn:hover { background: #f8fafc; }
        .eq-quiz-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: #475569;
        }
        .eq-top-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .eq-timer-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 0.88rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .eq-timer-pill.danger {
          background: #fef2f2;
          color: #dc2626;
          border-color: #fecaca;
        }
        .eq-progress-track {
          width: 100%;
          height: 6px;
          background: #e2e8f0;
          border-radius: 999px;
          overflow: hidden;
          margin-bottom: 18px;
        }
        .eq-progress-fill {
          height: 100%;
          background: #2563eb;
          transition: width 0.25s ease;
        }
        .eq-quiz-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 26px;
          box-shadow: 0 4px 20px rgba(15, 23, 42, 0.04);
        }
        .eq-meta-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 16px;
        }
        .eq-step-badge {
          font-size: 0.85rem;
          font-weight: 700;
          color: #475569;
        }
        .eq-badges {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .eq-pill {
          font-size: 0.78rem;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 999px;
          background: #eff6ff;
          color: #1d4ed8;
        }
        .eq-pill.multi {
          background: #f3e8ff;
          color: #7c3aed;
        }
        .eq-q-text {
          font-size: 1.2rem;
          font-weight: 700;
          line-height: 1.5;
          margin: 0 0 22px 0;
          white-space: pre-line;
        }
        .eq-options {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .eq-opt-btn {
          display: flex;
          align-items: center;
          gap: 14px;
          width: 100%;
          padding: 14px 16px;
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          text-align: left;
          font-size: 0.98rem;
          color: #0f172a;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .eq-opt-btn:hover { border-color: #cbd5e1; background: #f8fafc; }
        .eq-opt-btn.selected {
          border-color: #2563eb;
          background: #eff6ff;
          font-weight: 500;
        }
        .eq-keycap {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 30px;
          height: 30px;
          border-radius: 8px;
          background: #f1f5f9;
          color: #475569;
          font-weight: 700;
          font-size: 0.85rem;
          border: 1px solid #e2e8f0;
        }
        .eq-opt-btn.selected .eq-keycap {
          background: #2563eb;
          color: #ffffff;
          border-color: #2563eb;
        }
        .eq-nav-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 24px;
          gap: 12px;
        }
        .eq-btn-secondary {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #0f172a;
          padding: 10px 18px;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
        }
        .eq-btn-secondary:disabled { opacity: 0.4; cursor: not-allowed; }
        .eq-btn-primary {
          background: #2563eb;
          color: #ffffff;
          border: none;
          padding: 11px 22px;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
        }
        .eq-btn-primary:hover:not(:disabled) { background: #1d4ed8; }
        .eq-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .eq-dots-nav {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 18px;
          justify-content: center;
        }
        .eq-dot {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          font-size: 0.8rem;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
        }
        .eq-dot.current { border-color: #2563eb; color: #2563eb; background: #eff6ff; }
        .eq-dot.done { background: #2563eb; color: #ffffff; border-color: #2563eb; }
        .eq-quiz-empty { text-align: center; padding: 60px; color: #64748b; }
      `}</style>

      <div className="eq-quiz-wrap">
        <div className="eq-quiz-top">
          <button type="button" className="eq-back-btn" onClick={handleExit}>
            ← Шығу
          </button>
          <span className="eq-quiz-title">{session.title}</span>
          <div className="eq-top-right">
            {secondsLeft !== null && (
              <span className={`eq-timer-pill ${isDangerTime ? 'danger' : ''}`}>
                ⏱ {formatTimer(secondsLeft)}
              </span>
            )}
            <span className="eq-step-badge">
              {answeredCount}/{session.items.length}
            </span>
          </div>
        </div>

        <div className="eq-progress-track">
          <div className="eq-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>

        {error && (
          <div style={{ background: '#fef2f2', color: '#dc2626', padding: 12, borderRadius: 10, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <div className="eq-quiz-card">
          <div className="eq-meta-row">
            <span className="eq-step-badge">
              Сұрақ {currentIdx + 1} / {session.items.length}
            </span>
            <div className="eq-badges">
              {currentItem.payload.is_multi && (
                <span className="eq-pill multi">Бірнеше дұрыс жауап</span>
              )}
              <span className="eq-pill">{currentItem.points} ұпай</span>
            </div>
          </div>

          <h2 className="eq-q-text">{currentItem.payload.question}</h2>

          <div className="eq-options">
            {Object.entries(currentItem.payload.options).map(([letter, text]) => {
              const isSelected = selectedKeys.includes(letter);
              return (
                <button
                  key={letter}
                  type="button"
                  className={`eq-opt-btn ${isSelected ? 'selected' : ''}`}
                  onClick={() =>
                    toggleOption(currentItem.id, letter, currentItem.payload.is_multi)
                  }
                >
                  <span className="eq-keycap">{letter}</span>
                  <span>{text}</span>
                </button>
              );
            })}
          </div>

          <div className="eq-nav-row">
            <button
              type="button"
              className="eq-btn-secondary"
              disabled={currentIdx === 0}
              onClick={() => setCurrentIdx((i) => i - 1)}
            >
              ← Алдыңғы
            </button>

            {isLast ? (
              <button
                type="button"
                className="eq-btn-primary"
                disabled={submitting}
                onClick={handleSubmit}
              >
                {submitting ? 'Тексерілуде...' : 'Тестті аяқтау'}
              </button>
            ) : (
              <button
                type="button"
                className="eq-btn-primary"
                onClick={() => setCurrentIdx((i) => i + 1)}
              >
                Келесі →
              </button>
            )}
          </div>
        </div>

        <div className="eq-dots-nav">
          {session.items.map((item, idx) => {
            const isDone = (answers[item.id] || []).length > 0;
            const isCurrent = idx === currentIdx;
            return (
              <button
                key={item.id}
                type="button"
                className={`eq-dot ${isCurrent ? 'current' : ''} ${isDone && !isCurrent ? 'done' : ''}`}
                onClick={() => setCurrentIdx(idx)}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Quiz;