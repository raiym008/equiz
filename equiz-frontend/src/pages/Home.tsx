import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DeckSummary } from '../types';
import Layout from '../components/Layout';
import { testService } from '../services/test.service';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('kk-KZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDeck, setSelectedDeck] = useState<DeckSummary | null>(null);
  const [shareDeck, setShareDeck] = useState<DeckSummary | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deckToDelete, setDeckToDelete] = useState<DeckSummary | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const userName = localStorage.getItem('equiz_user_name') || 'Raim';

  useEffect(() => {
    const controller = new AbortController();
    testService
      .listDecks(controller.signal)
      .then((data) => setDecks(data))
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setErrorMsg(err instanceof Error ? err.message : 'Материалдарды жүктеу мүмкін болмады');
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const getPublicLink = (shareCode: string) =>
    `${window.location.origin}/q/${shareCode}`;

  const handleCopyLink = async (deck: DeckSummary) => {
    try {
      await navigator.clipboard.writeText(getPublicLink(deck.share_code));
      setCopiedId(deck.id);
      setTimeout(() => setCopiedId(null), 2200);
    } catch {
      setErrorMsg('Сілтемені көшіру мүмкін болмады. Қолмен көшіріп алыңыз.');
    }
  };

  const handleDeleteDeck = async () => {
    if (!deckToDelete) return;
    try {
      await testService.deleteDeck(deckToDelete.id);
      setDecks((prev) => prev.filter((d) => d.id !== deckToDelete.id));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Қате: Сервермен байланыс жоқ.');
    } finally {
      setDeckToDelete(null);
    }
  };

  const filteredDecks = decks.filter((d) =>
    d.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <Layout>
      <style>{`
        .hero-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 28px;
          flex-wrap: wrap;
        }
        .hero-left { display: flex; align-items: center; gap: 20px; }
        .hero-illustration { width: 112px; height: 86px; flex-shrink: 0; }
        .hero-greeting {
          margin: 0 0 6px 0;
          font-size: 1.95rem;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.025em;
          line-height: 1.15;
        }
        .hero-subtitle { margin: 0; font-size: 0.96rem; color: #64748b; }
        .btn-new-test {
          background: #2563eb;
          color: #ffffff;
          border: none;
          padding: 13px 26px;
          border-radius: 11px;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.22);
          transition: background-color 0.15s ease;
        }
        .btn-new-test:hover { background: #1d4ed8; }
        .clean-table thead th:last-child { text-align: right; }
        .test-name-btn {
          background: none;
          border: none;
          padding: 0;
          font-size: 0.95rem;
          font-weight: 600;
          color: #0f172a;
          cursor: pointer;
          text-align: left;
        }
        .test-name-btn:hover { color: #2563eb; }
        .pills-row { display: flex; gap: 6px; flex-wrap: wrap; }
        .count-pill {
          display: inline-block;
          background: #e8f1ff;
          color: #2563eb;
          font-size: 0.78rem;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 999px;
          white-space: nowrap;
        }
        .count-pill.fc { background: #f3e8ff; color: #7c3aed; }
        .count-pill.attempts { background: #ecfdf5; color: #059669; }
        .action-cell { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
        .btn-share-quick {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #f8fafc;
          color: #0f172a;
          border: 1px solid #cbd5e1;
          padding: 8px 13px;
          border-radius: 9px;
          font-size: 0.84rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
        }
        .btn-share-quick:hover {
          background: #eff6ff;
          border-color: #93c5fd;
          color: #2563eb;
        }
        .btn-start {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: #2563eb;
          color: #ffffff;
          border: none;
          padding: 8px 18px;
          border-radius: 9px;
          font-size: 0.86rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }
        .btn-start:hover { background: #1d4ed8; }
        .menu-wrap { position: relative; }
        .btn-dots {
          width: 36px;
          height: 36px;
          border-radius: 9px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #475569;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .row-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          min-width: 175px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 5px;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.1);
          z-index: 50;
        }
        .dropdown-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border: none;
          background: transparent;
          border-radius: 7px;
          font-size: 0.86rem;
          font-weight: 600;
          color: #1e293b;
          cursor: pointer;
          text-align: left;
        }
        .dropdown-btn:hover { background: #f1f5f9; color: #2563eb; }
        .dropdown-btn.danger { color: #dc2626; }
        .dropdown-btn.danger:hover { background: #fef2f2; color: #b91c1c; }
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 16px;
        }
        .modal-box {
          background: #ffffff;
          border-radius: 16px;
          padding: 24px;
          max-width: 460px;
          width: 100%;
          border: 1px solid #e2e8f0;
          box-shadow: 0 18px 36px rgba(15, 23, 42, 0.16);
        }
        .modal-box h3 { margin: 0 0 8px 0; font-size: 1.15rem; font-weight: 700; color: #0f172a; }
        .modal-box p { margin: 0 0 18px 0; font-size: 0.92rem; color: #475569; line-height: 1.5; }
        .modal-actions { display: flex; flex-direction: column; gap: 10px; }
        .modal-actions-row { display: flex; gap: 10px; justify-content: flex-end; }
        .share-link-box {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 6px 6px 6px 12px;
          margin-bottom: 16px;
        }
        .share-link-input {
          flex: 1;
          border: none;
          background: transparent;
          font-size: 0.88rem;
          color: #0f172a;
          font-family: monospace;
          outline: none;
        }
        .btn-copy-link {
          background: #2563eb;
          color: #ffffff;
          border: none;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 0.84rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }
        .btn-copy-link.copied { background: #16a34a; }
        .btn-fc {
          padding: 11px 18px;
          border-radius: 10px;
          font-size: 0.92rem;
          font-weight: 600;
          cursor: pointer;
          border: none;
          background: #7c3aed;
          color: #ffffff;
        }
        .btn-fc:hover { background: #6d28d9; }
        .btn-outline-blue {
          padding: 11px 18px;
          border-radius: 10px;
          font-size: 0.92rem;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid #bfdbfe;
          background: #eff6ff;
          color: #1d4ed8;
        }
        .btn-outline-blue:hover { background: #dbeafe; }
        .error-banner {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fecaca;
          padding: 12px 16px;
          border-radius: 10px;
          margin-bottom: 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.9rem;
        }
        @media (max-width: 860px) {
          .hero-illustration { display: none; }
          .hero-greeting { font-size: 1.55rem; }
        }
      `}</style>

      {errorMsg && (
        <div className="error-banner">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            style={{ background: 'none', border: 'none', color: '#b91c1c', fontWeight: 700, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      <div className="hero-row">
        <div className="hero-left">
          <svg className="hero-illustration" viewBox="0 0 120 92" fill="none" aria-hidden="true">
            <ellipse cx="48" cy="52" rx="34" ry="26" fill="#DBEAFE" opacity="0.65" />
            <rect
              x="24"
              y="10"
              width="56"
              height="72"
              rx="10"
              transform="rotate(-6 24 10)"
              fill="#BFDBFE"
              stroke="#2563EB"
              strokeWidth="3.5"
            />
            <rect
              x="30"
              y="16"
              width="44"
              height="60"
              rx="6"
              transform="rotate(-6 30 16)"
              fill="#EFF6FF"
            />
            <rect x="42" y="6" width="22" height="10" rx="4" transform="rotate(-6 42 6)" fill="#1D4ED8" />
            <circle cx="84" cy="64" r="19" fill="#EFF6FF" stroke="#2563EB" strokeWidth="3.5" />
            <path d="M84 54V64L91 67" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <div>
            <h2 className="hero-greeting">Сәлем, {userName}!</h2>
            <p className="hero-subtitle">Білімді тексеріп, жаңа мүмкіндіктерді ашыңыз</p>
          </div>
        </div>

        <button type="button" className="btn-new-test" onClick={() => navigate('/upload')}>
          <span>+</span>
          <span>Жаңа материал</span>
        </button>
      </div>

      <section className="panel-box">
        <div className="panel-header">
          <div className="panel-title-wrap">
            <svg className="panel-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625z" />
            </svg>
            <h3 className="panel-title">Менің материалдарым</h3>
          </div>

          <div className="search-wrap">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Атауын іздеу..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {decks.length === 0 ? (
          <div className="empty-box">
            Әзірге материалдар жоқ. Жоғарыдағы «+ Жаңа материал» батырмасы арқылы .docx жүктеңіз немесе қолмен құрыңыз.
          </div>
        ) : filteredDecks.length === 0 ? (
          <div className="empty-box">«{searchQuery}» сұранысы бойынша материал табылмады.</div>
        ) : (
          <div className="table-wrap">
            <table className="clean-table">
              <thead>
                <tr>
                  <th>Атауы</th>
                  <th>Мазмұны</th>
                  <th>Құрылған күні</th>
                  <th>Әрекет</th>
                </tr>
              </thead>
              <tbody>
                {filteredDecks.map((deck) => {
                  const isMenuOpen = openMenuId === deck.id;
                  return (
                    <tr key={deck.id}>
                      <td>
                        <button
                          type="button"
                          className="test-name-btn"
                          onClick={() => setSelectedDeck(deck)}
                        >
                          {deck.title}
                        </button>
                      </td>
                      <td>
                        <div className="pills-row">
                          {deck.mcq_count > 0 && (
                            <span className="count-pill">{deck.mcq_count} тест</span>
                          )}
                          {deck.flashcard_count > 0 && (
                            <span className="count-pill fc">{deck.flashcard_count} карточка</span>
                          )}
                          {deck.attempt_count > 0 && (
                            <span className="count-pill attempts">{deck.attempt_count} тапсырды</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="date-text">{formatDate(deck.created_at)}</span>
                      </td>
                      <td>
                        <div className="action-cell">
                          {deck.mcq_count > 0 && (
                            <button
                              type="button"
                              className="btn-share-quick"
                              onClick={() => setShareDeck(deck)}
                              title="Қатысушыларға арналған сілтемені алу"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" strokeLinecap="round" />
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" strokeLinecap="round" />
                              </svg>
                              <span>Сілтеме</span>
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn-start"
                            onClick={() => setSelectedDeck(deck)}
                          >
                            <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
                              <path d="M2.5 1.5L10.5 6L2.5 10.5V1.5Z" />
                            </svg>
                            <span>Бастау</span>
                          </button>

                          <div className="menu-wrap">
                            <button
                              type="button"
                              className="btn-dots"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(isMenuOpen ? null : deck.id);
                              }}
                              aria-label="Қосымша әрекеттер"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="5" r="2" />
                                <circle cx="12" cy="12" r="2" />
                                <circle cx="12" cy="19" r="2" />
                              </svg>
                            </button>

                            {isMenuOpen && (
                              <div className="row-dropdown" onClick={(e) => e.stopPropagation()}>
                                {deck.mcq_count > 0 && (
                                  <button
                                    type="button"
                                    className="dropdown-btn"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      navigate(`/shared-tests?deck=${deck.id}`);
                                    }}
                                  >
                                    <span>Қатысушылар нәтижесі</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="dropdown-btn"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    navigate(`/edit/${deck.id}`);
                                  }}
                                >
                                  <span>Өңдеу</span>
                                </button>
                                <button
                                  type="button"
                                  className="dropdown-btn danger"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setDeckToDelete(deck);
                                  }}
                                >
                                  <span>Өшіру</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Оқу режимін таңдау модалкасы */}
      {selectedDeck && (
        <div className="modal-overlay" onClick={() => setSelectedDeck(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>{selectedDeck.title}</h3>
            <p>Оқу немесе тестілеу режимін таңдаңыз:</p>
            <div className="modal-actions">
              {selectedDeck.mcq_count > 0 && (
                <>
                  <button
                    className="btn-yes"
                    onClick={() => navigate(`/quiz/${selectedDeck.id}`)}
                  >
                    Өзім тест тапсыру ({selectedDeck.mcq_count} сұрақ)
                  </button>
                  <button
                    className="btn-outline-blue"
                    onClick={() => {
                      const d = selectedDeck;
                      setSelectedDeck(null);
                      setShareDeck(d);
                    }}
                  >
                    Қатысушыларға сілтеме жіберу
                  </button>
                </>
              )}
              {selectedDeck.flashcard_count > 0 && (
                <button
                  className="btn-fc"
                  onClick={() => navigate(`/flashcards/${selectedDeck.id}`)}
                >
                  Карточкалармен оқу ({selectedDeck.flashcard_count} дана)
                </button>
              )}
              <button className="btn-no" onClick={() => setSelectedDeck(null)}>
                Жабу
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Жаңа функция: Арнайы сілтемемен бөлісу модалкасы */}
      {shareDeck && (
        <div className="modal-overlay" onClick={() => setShareDeck(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Қатысушыларға арналған сілтеме</h3>
            <p>
              <strong>«{shareDeck.title}»</strong> тестін тапсыру үшін қатысушыларға осы сілтемені
              жіберіңіз. Тіркелу талап етілмейді — тек атын жазып бастайды.
            </p>

            <div className="share-link-box">
              <input
                type="text"
                readOnly
                className="share-link-input"
                value={getPublicLink(shareDeck.share_code)}
                onFocus={(e) => e.target.select()}
              />
              <button
                type="button"
                className={`btn-copy-link ${copiedId === shareDeck.id ? 'copied' : ''}`}
                onClick={() => handleCopyLink(shareDeck)}
              >
                {copiedId === shareDeck.id ? 'Көшірілді ✓' : 'Көшіру'}
              </button>
            </div>

            <div className="modal-actions-row">
              <button
                type="button"
                className="btn-outline-blue"
                style={{ padding: '9px 14px', fontSize: '0.86rem' }}
                onClick={() => {
                  const id = shareDeck.id;
                  setShareDeck(null);
                  navigate(`/shared-tests?deck=${id}`);
                }}
              >
                Нәтижелерді бақылау →
              </button>
              <button
                type="button"
                className="btn-no"
                onClick={() => setShareDeck(null)}
              >
                Жабу
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Өшіру модалкасы */}
      {deckToDelete && (
        <div className="modal-overlay" onClick={() => setDeckToDelete(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: '#dc2626' }}>Материалды өшіру</h3>
            <p>
              <strong>«{deckToDelete.title}»</strong> материалын өшіруге сенімдісіз бе? Бұрынғы
              қатысушылардың нәтижелері мұрағатта сақталады.
            </p>
            <div className="modal-actions-row">
              <button
                className="btn-yes"
                style={{ background: '#dc2626' }}
                onClick={handleDeleteDeck}
              >
                Иә, өшіру
              </button>
              <button className="btn-no" onClick={() => setDeckToDelete(null)}>
                Бас тарту
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Home;