import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { QuizAttemptOut } from '../types';
import Layout from '../components/Layout';
import { resultService } from '../services/result.service';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('kk-KZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const Results: React.FC = () => {
  const navigate = useNavigate();
  const [results, setResults] = useState<QuizAttemptOut[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    resultService
      .listResults(controller.signal)
      .then((data) => setResults(data))
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setSelectedResultId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const filteredResults = results.filter((r) =>
    r.deck_title.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  // Жалпы статистиканы есептеу
  const totalAttempts = results.length;
  const averagePercent =
    totalAttempts > 0
      ? Math.round(
          results.reduce((acc, r) => {
            const score = r.score ?? 0;
            const maxScore = r.max_score ?? 0;
            return acc + (maxScore > 0 ? (score / maxScore) * 100 : 0);
          }, 0) / totalAttempts
        )
      : 0;

  return (
    <Layout>
      <style>{`
        .results-header-row {
          margin-bottom: 24px;
        }
        .page-heading {
          margin: 0 0 6px 0;
          font-size: 1.75rem;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
        }
        .page-sub {
          margin: 0;
          font-size: 0.95rem;
          color: #64748b;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }
        .stat-card {
          background: #ffffff;
          border: 1px solid #e8eef5;
          border-radius: 14px;
          padding: 18px 20px;
          box-shadow: 0 2px 12px rgba(15, 23, 42, 0.02);
        }
        .stat-label {
          font-size: 0.84rem;
          font-weight: 600;
          color: #64748b;
          margin-bottom: 6px;
        }
        .stat-value {
          font-size: 1.65rem;
          font-weight: 800;
          color: #0f172a;
        }
        .result-clickable { cursor: pointer; user-select: none; }
        .clean-table tbody tr.result-clickable.selected { background: #e8f1ff; }
        .progress-cell { display: flex; align-items: center; gap: 14px; min-width: 210px; }
        .progress-percent { font-weight: 700; font-size: 0.92rem; color: #0f172a; width: 52px; flex-shrink: 0; }
        .progress-track { flex: 1; height: 8px; background: #e2e8f0; border-radius: 999px; overflow: hidden; }
        .progress-fill { height: 100%; background: #2563eb; border-radius: 999px; }
        .btn-detail {
          background: #ebf3ff;
          color: #2563eb;
          border: none;
          padding: 7px 14px;
          border-radius: 8px;
          font-size: 0.84rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }
        .btn-detail:hover { background: #dbeafe; }
      `}</style>

      <div className="results-header-row">
        <h2 className="page-heading">Нәтижелер</h2>
        <p className="page-sub">Тапсырылған барлық тесттер бойынша үлгерім тарихы</p>
      </div>

      {results.length > 0 && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Барлық талпыныстар</div>
            <div className="stat-value">{totalAttempts}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Орташа көрсеткіш</div>
            <div className="stat-value" style={{ color: '#2563eb' }}>{averagePercent}%</div>
          </div>
        </div>
      )}

      <section className="panel-box">
        <div className="panel-header">
          <div className="panel-title-wrap">
            <svg className="panel-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 13a1 1 0 011-1h2a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1v-7zm6-5a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V8zm6-4a1 1 0 011-1h2a1 1 0 011 1v16a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
            <h3 className="panel-title">Тест нәтижелері</h3>
          </div>

          <div className="search-wrap">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Тест атауын іздеу..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="empty-box">Жүктелуде...</div>
        ) : results.length === 0 ? (
          <div className="empty-box">Әзірге тапсырылған тест нәтижелері жоқ.</div>
        ) : filteredResults.length === 0 ? (
          <div className="empty-box">«{searchQuery}» бойынша нәтиже табылмады.</div>
        ) : (
          <div className="table-wrap">
            <table className="clean-table">
              <thead>
                <tr>
                  <th>Тест атауы</th>
                  <th>Тапсырылған күні</th>
                  <th>Нәтиже</th>
                  <th style={{ textAlign: 'right' }}>Талдау</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((res) => {
                  const resId = res.id ?? res.attempt_id;
                  const score = res.score ?? 0;
                  const maxScore = res.max_score ?? 0;
                  const percent =
                    maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
                  const isSelected = selectedResultId === resId;
                  return (
                    <tr
                      key={resId}
                      className={`result-clickable ${isSelected ? 'selected' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedResultId(resId);
                      }}
                      onDoubleClick={() => navigate(`/result/${resId}`)}
                    >
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{res.deck_title}</td>
                      <td>
                        <span className="date-text">
                          {formatDateTime(res.created_at ?? res.started_at)}
                        </span>
                      </td>
                      <td>
                        <div className="progress-cell">
                          <span className="progress-percent">
                            {score}/{maxScore}
                          </span>
                          <div className="progress-track">
                            <div className="progress-fill" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn-detail"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/result/${resId}`);
                          }}
                        >
                          Қарау
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Layout>
  );
};

export default Results;