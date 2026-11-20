import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { DeckSummary, QuizAttemptOut } from '../../types';
import Layout from '../../components/Layout';
import { api } from '../api/equizapi' 

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('kk-KZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs} сек`;
  return `${mins} мин ${secs} сек`;
}

const SharedTests: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [attempts, setAttempts] = useState<QuizAttemptOut[]>([]);
  const [nameFilter, setNameFilter] = useState<string>('');
  const [loadingResults, setLoadingResults] = useState<boolean>(false);
  const [togglingActive, setTogglingActive] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [inspectAttempt, setInspectAttempt] = useState<QuizAttemptOut | null>(null);

  useEffect(() => {
    fetch(`${api}/decks`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: DeckSummary[]) => {
        const mcqDecks = data.filter((d) => d.mcq_count > 0);
        setDecks(mcqDecks);
        const queryDeckId = searchParams.get('deck');
        if (queryDeckId && mcqDecks.some((d) => d.id === queryDeckId)) {
          setSelectedDeckId(queryDeckId);
        } else if (mcqDecks.length > 0) {
          setSelectedDeckId(mcqDecks[0].id);
        }
      })
      .catch(() => {});
  }, [searchParams]);

  const loadResults = useCallback(async (deckId: string) => {
    if (!deckId) return;
    setLoadingResults(true);
    try {
      const res = await fetch(`${api}/decks/${deckId}/results`);
      if (res.ok) {
        const data: QuizAttemptOut[] = await res.json();
        setAttempts(data);
      }
    } finally {
      setLoadingResults(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDeckId) {
      loadResults(selectedDeckId);
    }
  }, [selectedDeckId, loadResults]);

  const currentDeck = decks.find((d) => d.id === selectedDeckId) || null;
  const shareUrl = currentDeck
    ? `${window.location.origin}/q/${currentDeck.share_code}`
    : '';

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleActive = async () => {
    if (!currentDeck || togglingActive) return;
    setTogglingActive(true);
    try {
      const fullRes = await fetch(`${api}/decks/${currentDeck.id}`);
      if (!fullRes.ok) return;
      const fullDeck = await fullRes.json();

      const updateRes = await fetch(`${api}/decks/${currentDeck.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: fullDeck.title,
          description: fullDeck.description,
          is_active: !currentDeck.is_active,
          settings: fullDeck.settings,
          items: fullDeck.items.map((i: any) => ({
            item_type: i.item_type,
            points: i.points,
            payload: i.payload,
          })),
        }),
      });

      if (updateRes.ok) {
        setDecks((prev) =>
          prev.map((d) =>
            d.id === currentDeck.id ? { ...d, is_active: !d.is_active } : d
          )
        );
      }
    } finally {
      setTogglingActive(false);
    }
  };

  const filteredAttempts = attempts.filter((a) =>
    a.participant_name.toLowerCase().includes(nameFilter.trim().toLowerCase()) ||
    a.attempt_id.toLowerCase().includes(nameFilter.trim().toLowerCase())
  );

  const completedAttempts = attempts.filter((a) => a.status === 'completed');
  const avgPercent =
    completedAttempts.length > 0
      ? Math.round(
          completedAttempts.reduce(
            (acc, a) => acc + ((a.score || 0) / (a.max_score || 1)) * 100,
            0
          ) / completedAttempts.length
        )
      : 0;

  return (
    <Layout>
      <style>{`
        .st-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }
        .st-title {
          margin: 0 0 6px 0;
          font-size: 1.7rem;
          font-weight: 800;
          color: #0f172a;
        }
        .st-sub {
          margin: 0;
          color: #64748b;
          font-size: 0.94rem;
        }
        .st-control-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 24px;
          display: grid;
          grid-template-columns: 1fr 1.4fr;
          gap: 20px;
          align-items: end;
        }
        .st-label {
          display: block;
          font-size: 0.82rem;
          font-weight: 700;
          color: #475569;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .st-select {
          width: 100%;
          padding: 11px 14px;
          border-radius: 10px;
          border: 1px solid #cbd5e1;
          font-size: 0.95rem;
          font-weight: 600;
          color: #0f172a;
          background: #ffffff;
          outline: none;
        }
        .st-select:focus { border-color: #2563eb; }
        .st-link-row {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }
        .st-url-input {
          flex: 1;
          min-width: 200px;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid #cbd5e1;
          background: #f8fafc;
          font-family: monospace;
          font-size: 0.88rem;
          color: #0f172a;
        }
        .st-btn-primary {
          padding: 10px 16px;
          border-radius: 10px;
          border: none;
          background: #2563eb;
          color: #ffffff;
          font-size: 0.88rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }
        .st-btn-primary.copied { background: #16a34a; }
        .st-btn-status {
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 0.86rem;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid;
          white-space: nowrap;
        }
        .st-btn-status.open {
          background: #ecfdf5;
          color: #047857;
          border-color: #a7f3d0;
        }
        .st-btn-status.closed {
          background: #fef2f2;
          color: #b91c1c;
          border-color: #fecaca;
        }
        .st-stats-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          margin-bottom: 24px;
        }
        .st-stat-box {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 16px 20px;
        }
        .st-stat-val {
          font-size: 1.55rem;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 2px;
        }
        .st-stat-lbl {
          font-size: 0.84rem;
          color: #64748b;
          font-weight: 500;
        }
        .attempt-id-badge {
          display: inline-block;
          font-family: monospace;
          font-size: 0.76rem;
          background: #f1f5f9;
          color: #475569;
          padding: 2px 7px;
          border-radius: 6px;
          margin-top: 3px;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 0.78rem;
          font-weight: 600;
        }
        .status-badge.done { background: #dcfce7; color: #15803d; }
        .status-badge.progress { background: #fef3c7; color: #b45309; }
        .status-badge.late { background: #fee2e2; color: #b91c1c; margin-left: 6px; }
        .btn-inspect {
          background: #eff6ff;
          color: #2563eb;
          border: 1px solid #bfdbfe;
          padding: 7px 13px;
          border-radius: 8px;
          font-size: 0.83rem;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-inspect:hover { background: #dbeafe; }
        .inspect-modal {
          background: #ffffff;
          border-radius: 16px;
          padding: 24px;
          max-width: 680px;
          width: 100%;
          max-height: 86vh;
          overflow-y: auto;
          border: 1px solid #e2e8f0;
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.2);
        }
        .q-review-card {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 14px 16px;
          margin-bottom: 12px;
          background: #f8fafc;
        }
        .q-review-card.correct { border-left: 4px solid #16a34a; }
        .q-review-card.wrong { border-left: 4px solid #dc2626; }
        .opt-line {
          padding: 6px 10px;
          border-radius: 7px;
          font-size: 0.88rem;
          margin-top: 6px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
        }
        .opt-line.is-correct {
          background: #ecfdf5;
          border-color: #6ee7b7;
          color: #065f46;
          font-weight: 600;
        }
        .opt-line.is-wrong-pick {
          background: #fef2f2;
          border-color: #fca5a5;
          color: #991b1b;
        }
        @media (max-width: 820px) {
          .st-control-card { grid-template-columns: 1fr; }
          .st-stats-row { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="st-header">
        <div>
          <h2 className="st-title">Онлайн тестілеу және қатысушылар</h2>
          <p className="st-sub">
            Арнайы сілтеме арқылы кірген қатысушылардың нәтижелерін нақты уақытта бақылаңыз
          </p>
        </div>

        {selectedDeckId && (
          <button
            type="button"
            className="btn-share-quick"
            onClick={() => loadResults(selectedDeckId)}
          >
            ↻ Жаңарту
          </button>
        )}
      </div>

      {decks.length === 0 ? (
        <div className="empty-box">
          Әзірге тест сұрақтары бар материал жоқ. Алдымен «Менің материалдарым» бөлімінен тест жүктеңіз.
        </div>
      ) : (
        <>
          <div className="st-control-card">
            <div>
              <label className="st-label">Тест материалын таңдаңыз</label>
              <select
                className="st-select"
                value={selectedDeckId}
                onChange={(e) => {
                  setSelectedDeckId(e.target.value);
                  setSearchParams({ deck: e.target.value });
                }}
              >
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title} ({d.mcq_count} сұрақ)
                  </option>
                ))}
              </select>
            </div>

            {currentDeck && (
              <div>
                <label className="st-label">Қатысушыларға арналған сілтеме</label>
                <div className="st-link-row">
                  <input
                    type="text"
                    readOnly
                    className="st-url-input"
                    value={shareUrl}
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    type="button"
                    className={`st-btn-primary ${copied ? 'copied' : ''}`}
                    onClick={handleCopy}
                  >
                    {copied ? 'Көшірілді ✓' : 'Сілтемені көшіру'}
                  </button>
                  <button
                    type="button"
                    disabled={togglingActive}
                    className={`st-btn-status ${currentDeck.is_active ? 'open' : 'closed'}`}
                    onClick={handleToggleActive}
                    title="Сілтемені ашу немесе жабу"
                  >
                    {currentDeck.is_active ? '● Қабылдау ашық' : '○ Жабық'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="st-stats-row">
            <div className="st-stat-box">
              <div className="st-stat-val">{attempts.length}</div>
              <div className="st-stat-lbl">Барлық қатысушылар әрекеті</div>
            </div>
            <div className="st-stat-box">
              <div className="st-stat-val">{completedAttempts.length}</div>
              <div className="st-stat-lbl">Тестті аяқтағандар</div>
            </div>
            <div className="st-stat-box">
              <div className="st-stat-val">{avgPercent}%</div>
              <div className="st-stat-lbl">Орташа нәтиже</div>
            </div>
          </div>

          <section className="panel-box">
            <div className="panel-header">
              <div className="panel-title-wrap">
                <h3 className="panel-title">Қатысушылар тізімі</h3>
              </div>

              <div className="search-wrap">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Аты немесе attempt_id бойынша..."
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                />
              </div>
            </div>

            {loadingResults ? (
              <div className="empty-box">Нәтижелер жүктелуде...</div>
            ) : filteredAttempts.length === 0 ? (
              <div className="empty-box">
                Бұл тестке әлі ешкім қатыспаған. Жоғарыдағы сілтемені қатысушыларға жіберіңіз.
              </div>
            ) : (
              <div className="table-wrap">
                <table className="clean-table">
                  <thead>
                    <tr>
                      <th>Қатысушы / Attempt ID</th>
                      <th>Күйі</th>
                      <th>Басталған уақыты</th>
                      <th>Аяқталған уақыты</th>
                      <th>Ұпайы</th>
                      <th style={{ textAlign: 'right' }}>Жауаптары</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttempts.map((att) => (
                      <tr key={att.attempt_id}>
                        <td>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>
                            {att.participant_name}
                          </div>
                          <span className="attempt-id-badge" title={att.attempt_id}>
                            ID: {att.attempt_id.slice(0, 8)}...
                          </span>
                        </td>
                        <td>
                          {att.status === 'completed' ? (
                            <span className="status-badge done">Аяқталды</span>
                          ) : (
                            <span className="status-badge progress">Тапсыруда...</span>
                          )}
                          {att.is_late && (
                            <span className="status-badge late">Уақыттан кеш</span>
                          )}
                        </td>
                        <td className="date-text">{formatDateTime(att.started_at)}</td>
                        <td>
                          <div className="date-text">{formatDateTime(att.finished_at)}</div>
                          {att.duration_seconds !== null && (
                            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                              Ұзақтығы: {formatDuration(att.duration_seconds)}
                            </div>
                          )}
                        </td>
                        <td>
                          {att.status === 'completed' ? (
                            <strong style={{ color: '#0f172a', fontSize: '0.96rem' }}>
                              {att.score} / {att.max_score}
                            </strong>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {att.status === 'completed' && (
                            <button
                              type="button"
                              className="btn-inspect"
                              onClick={() => setInspectAttempt(att)}
                            >
                              Жауаптарды көру
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* Қатысушының жеке жауаптарын тексеру модалкасы */}
      {inspectAttempt && (
        <div className="modal-overlay" onClick={() => setInspectAttempt(null)}>
          <div className="inspect-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', color: '#0f172a' }}>
                  Қатысушы: {inspectAttempt.participant_name}
                </h3>
                <div style={{ fontSize: '0.82rem', color: '#64748b', fontFamily: 'monospace' }}>
                  attempt_id: {inspectAttempt.attempt_id}
                </div>
              </div>
              <button
                type="button"
                className="btn-no"
                onClick={() => setInspectAttempt(null)}
              >
                Жабу ✕
              </button>
            </div>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '12px 14px', background: '#f8fafc', borderRadius: 10, marginBottom: 18, fontSize: '0.86rem', color: '#334155' }}>
              <span><strong>Ұпай:</strong> {inspectAttempt.score} / {inspectAttempt.max_score}</span>
              <span><strong>Басталды:</strong> {formatDateTime(inspectAttempt.started_at)}</span>
              <span><strong>Аяқталды:</strong> {formatDateTime(inspectAttempt.finished_at)}</span>
            </div>

            {inspectAttempt.details.map((q, idx) => (
              <div
                key={q.item_id}
                className={`q-review-card ${q.is_correct ? 'correct' : 'wrong'}`}
              >
                <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                  {idx + 1}. {q.question}
                </div>
                {Object.entries(q.options).map(([key, text]) => {
                  const isRight = q.correct_keys.includes(key);
                  const isPicked = q.selected_keys.includes(key);
                  let cls = 'opt-line';
                  if (isRight) cls += ' is-correct';
                  else if (isPicked) cls += ' is-wrong-pick';

                  return (
                    <div key={key} className={cls}>
                      <strong>{key})</strong> {text}{' '}
                      {isRight && '✓ (Дұрыс жауап)'}
                      {!isRight && isPicked && '✕ (Қатысушы таңдауы)'}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default SharedTests;