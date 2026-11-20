import React, { useState } from 'react';
import Layout from '../components/Layout';

const Settings: React.FC = () => {
  const [userName, setUserName] = useState<string>(
    () => localStorage.getItem('equiz_user_name') || 'Raim'
  );
  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = userName.trim() || 'Raim';
    setUserName(cleaned);
    localStorage.setItem('equiz_user_name', cleaned);

    // Layout компонентіндегі есімді бірден жаңарту үшін оқиға жібереміз
    window.dispatchEvent(new Event('equiz_name_updated'));

    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <Layout>
      <style>{`
        .settings-header-row {
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
        .settings-form {
          max-width: 440px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .settings-label {
          display: block;
          font-size: 0.88rem;
          font-weight: 600;
          color: #334155;
          margin-bottom: 6px;
        }
        .settings-input {
          width: 100%;
          padding: 11px 14px;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          font-size: 0.94rem;
          color: #0f172a;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .settings-input:focus {
          border-color: #2563eb;
        }
        .settings-actions {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .saved-badge {
          font-size: 0.88rem;
          font-weight: 600;
          color: #16a34a;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          padding: 6px 12px;
          border-radius: 8px;
        }
      `}</style>

      <div className="settings-header-row">
        <h2 className="page-heading">Параметрлер</h2>
        <p className="page-sub">Профиль мен қосымша баптауларын басқару</p>
      </div>

      <section className="panel-box">
        <div className="panel-header">
          <div className="panel-title-wrap">
            <svg className="panel-icon" viewBox="0 0 24 24" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
                clipRule="evenodd"
              />
            </svg>
            <h3 className="panel-title">Жеке деректер</h3>
          </div>
        </div>

        <form className="settings-form" onSubmit={handleSaveName}>
          <div>
            <label htmlFor="equiz-name-input" className="settings-label">
              Пайдаланушы аты
            </label>
            <input
              id="equiz-name-input"
              type="text"
              className="settings-input"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Атыңызды енгізіңіз"
            />
          </div>

          <div className="settings-actions">
            <button type="submit" className="btn-yes">
              Сақтау
            </button>
            {savedNotice && <span className="saved-badge">✓ Өзгерістер сақталды</span>}
          </div>
        </form>
      </section>
    </Layout>
  );
};

export default Settings;