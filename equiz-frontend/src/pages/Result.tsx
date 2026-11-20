import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { QuizAttemptOut } from '../types';
import { resultService } from '../services/result.service';

const Result: React.FC = () => {
  const { resultId } = useParams<{ resultId: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<QuizAttemptOut | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!resultId) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);

    resultService
      .getResult(resultId, controller.signal)
      .then((data) => setResult(data))
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setResult(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [resultId]);

  if (loading) {
    return (
      <div className="page-container equiz-result-page" style={{ textAlign: 'center', paddingTop: 60 }}>
        Жүктелуде...
      </div>
    );
  }

  if (!result) {
    return (
      <div className="page-container equiz-result-page">
        <div className="surface-card" style={{ textAlign: 'center' }}>
          <p>Нәтиже табылмады</p>
          <button className="btn-primary" onClick={() => navigate('/')}>
            Басты бетке оралу
          </button>
        </div>
      </div>
    );
  }

  const score = result.score ?? 0;
  const maxScore = result.max_score ?? 0;
  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const correctQuestions = result.details.filter((d) => d.is_correct).length;
  const wrongQuestions = result.details.length - correctQuestions;
  const ringRadius = 27;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - percent / 100);
  const formattedDate = new Date(result.created_at ?? result.started_at).toLocaleString('kk-KZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="page-container equiz-result-page">
      <style>{`
        .equiz-result-page {
          max-width: 820px;
          margin: 0 auto;
          padding: 24px 16px 48px;
          background-color: #f4f6fb;
          color: #0f172a;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .equiz-result-page .top-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          gap: 12px;
        }
        .equiz-result-page .equiz-back-btn {
          background: #ffffff;
          color: #0f172a;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 9px 16px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .equiz-result-page .equiz-retry-btn {
          background: #2563eb;
          color: #ffffff;
          border: none;
          border-radius: 10px;
          padding: 9px 18px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .equiz-result-page .equiz-summary-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 28px;
        }
        .equiz-result-page .equiz-test-date {
          display: block;
          font-size: 13px;
          color: #64748b;
          margin-bottom: 4px;
        }
        .equiz-result-page .equiz-test-title {
          font-size: 22px;
          font-weight: 700;
          margin: 0 0 18px 0;
        }
        .equiz-result-page .equiz-stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }
        .equiz-result-page .equiz-stat-box {
          background: #f8fafc;
          border: 1px solid #edf2f7;
          border-radius: 12px;
          padding: 18px 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        .equiz-result-page .equiz-ring-wrap {
          position: relative;
          width: 68px;
          height: 68px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 8px;
        }
        .equiz-result-page .equiz-ring-svg {
          position: absolute;
          inset: 0;
          transform: rotate(-90deg);
        }
        .equiz-result-page .equiz-ring-track { fill: none; stroke: #e0e7ff; stroke-width: 5; }
        .equiz-result-page .equiz-ring-progress {
          fill: none;
          stroke: #2563eb;
          stroke-width: 5;
          stroke-linecap: round;
        }
        .equiz-result-page .equiz-stat-value { font-size: 22px; font-weight: 700; }
        .equiz-result-page .equiz-stat-label { font-size: 13px; color: #64748b; margin-top: 4px; }
        .equiz-result-page .equiz-breakdown-list { display: flex; flex-direction: column; gap: 16px; }
        .equiz-result-page .equiz-question-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-left-width: 4px;
          border-radius: 16px;
          padding: 20px 22px;
        }
        .equiz-result-page .equiz-card-correct { border-left-color: #10b981; }
        .equiz-result-page .equiz-card-wrong { border-left-color: #ef4444; }
        .equiz-result-page .equiz-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .equiz-result-page .equiz-q-num {
          background: #0f172a;
          color: #ffffff;
          font-size: 12.5px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 7px;
        }
        .equiz-result-page .equiz-status-ok {
          background: #ecfdf5;
          color: #059669;
          border: 1px solid #bbf7d0;
          font-size: 12.5px;
          font-weight: 600;
          padding: 4px 12px;
          border-radius: 999px;
        }
        .equiz-result-page .equiz-status-wrong {
          background: #fee2e2;
          color: #dc2626;
          border: 1px solid #fecaca;
          font-size: 12.5px;
          font-weight: 600;
          padding: 4px 12px;
          border-radius: 999px;
        }
        .equiz-result-page .equiz-question-text { font-size: 15.5px; font-weight: 600; margin: 0 0 14px 0; }
        .equiz-result-page .equiz-options-list { display: flex; flex-direction: column; gap: 8px; }
        .equiz-result-page .equiz-option {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          background: #f8fafc;
          border: 1px solid #edf2f7;
          border-radius: 10px;
          padding: 11px 14px;
          font-size: 14.5px;
        }
        .equiz-result-page .equiz-opt-correct { background: #ecfdf5; border-color: #6ee7b7; color: #065f46; }
        .equiz-result-page .equiz-opt-wrong { background: #fef2f2; border-color: #fca5a5; color: #991b1b; }
        .equiz-result-page .tag { font-size: 12px; font-weight: 600; padding: 3px 9px; border-radius: 7px; }
        .equiz-result-page .equiz-tag-wrong { color: #dc2626; background: rgba(254, 226, 226, 0.8); }
        .equiz-result-page .equiz-tag-correct-solid { color: #fff; background: #10b981; }
        @media (max-width: 600px) {
          .equiz-result-page .equiz-stats-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="top-bar">
        <button className="equiz-back-btn" onClick={() => navigate('/')}>
          ← Басты бетке оралу
        </button>
        <button className="equiz-retry-btn" onClick={() => navigate(`/quiz/${result.deck_id}`)}>
          Қайта тапсыру
        </button>
      </div>

      <div className="equiz-summary-card">
        <span className="equiz-test-date">{formattedDate}</span>
        <h2 className="equiz-test-title">{result.deck_title}</h2>

        <div className="equiz-stats-grid">
          <div className="equiz-stat-box">
            <div className="equiz-ring-wrap" aria-hidden="true">
              <svg className="equiz-ring-svg" viewBox="0 0 64 64">
                <circle className="equiz-ring-track" cx="32" cy="32" r={ringRadius} />
                <circle
                  className="equiz-ring-progress"
                  cx="32"
                  cy="32"
                  r={ringRadius}
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                />
              </svg>
              <span style={{ fontWeight: 700, fontSize: 16, color: '#2563eb' }}>{percent}%</span>
            </div>
            <span className="equiz-stat-label">
              Ұпай: {score} / {maxScore}
            </span>
          </div>

          <div className="equiz-stat-box">
            <span className="equiz-stat-value" style={{ color: '#059669' }}>
              {correctQuestions}
            </span>
            <span className="equiz-stat-label">Дұрыс сұрақ</span>
          </div>

          <div className="equiz-stat-box">
            <span className="equiz-stat-value" style={{ color: '#dc2626' }}>
              {wrongQuestions}
            </span>
            <span className="equiz-stat-label">Қате сұрақ</span>
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Сұрақтар талдауы</h3>

      <div className="equiz-breakdown-list">
        {result.details.map((item, idx) => (
          <div
            key={item.item_id}
            className={`equiz-question-card ${
              item.is_correct ? 'equiz-card-correct' : 'equiz-card-wrong'
            }`}
          >
            <div className="equiz-card-header">
              <span className="equiz-q-num">#{idx + 1}</span>
              <span className={item.is_correct ? 'equiz-status-ok' : 'equiz-status-wrong'}>
                {item.is_correct ? 'Дұрыс' : 'Қате'} · {item.points_earned}/{item.max_points} ұпай
              </span>
            </div>

            <p className="equiz-question-text">{item.question}</p>

            <div className="equiz-options-list">
              {Object.entries(item.options).map(([letter, text]) => {
                const isUserChoice = item.selected_keys.includes(letter);
                const isRightAnswer = item.correct_keys.includes(letter);

                let optionClass = 'equiz-option';
                if (isRightAnswer) {
                  optionClass += ' equiz-opt-correct';
                } else if (isUserChoice) {
                  optionClass += ' equiz-opt-wrong';
                }

                return (
                  <div key={letter} className={optionClass}>
                    <span>
                      <strong>{letter})</strong> {text}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {isUserChoice && !isRightAnswer && (
                        <span className="tag equiz-tag-wrong">Сіздің жауабыңыз ✕</span>
                      )}
                      {isRightAnswer && (
                        <span className="tag equiz-tag-correct-solid">
                          {isUserChoice ? 'Сіз таңдадыңыз ✓' : 'Дұрыс жауап ✓'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Result;