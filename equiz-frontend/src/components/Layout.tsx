import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

// equiz ресми эмблемасы (мөлдір фонмен оңтайландырылған)
const EQUIZ_LOGO_SRC =
  "data:image/png;base64,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";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string>(
    () => localStorage.getItem('equiz_user_name') || 'Raim'
  );

  // Параметрлер бетінде есім өзгерсе, бірден жаңарту
  useEffect(() => {
    const syncName = () => {
      setUserName(localStorage.getItem('equiz_user_name') || 'Raim');
    };
    window.addEventListener('equiz_name_updated', syncName);
    window.addEventListener('storage', syncName);
    return () => {
      window.removeEventListener('equiz_name_updated', syncName);
      window.removeEventListener('storage', syncName);
    };
  }, []);

  const userInitial = (userName.trim()[0] || 'R').toUpperCase();

  return (
    <div className="equiz-layout">
      <style>{`
        .equiz-layout {
          display: flex;
          min-height: 100vh;
          width: 100%;
          background-color: #f6f9fe;
          color: #0f172a;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          box-sizing: border-box;
        }
        .equiz-layout *, .equiz-layout *::before, .equiz-layout *::after {
          box-sizing: border-box;
        }
        .equiz-sidebar {
          width: 232px;
          flex-shrink: 0;
          background: #ffffff;
          border-right: 1px solid #eef2f6;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 24px 16px 20px;
          position: sticky;
          top: 0;
          height: 100vh;
        }
        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 4px 10px 28px;
          cursor: pointer;
          text-decoration: none;
        }
        .sidebar-logo {
          width: 34px;
          height: 34px;
          object-fit: contain;
          display: block;
        }
        .sidebar-brand-name {
          margin: 0;
          font-size: 1.3rem;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
        }
        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .nav-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 11px 14px;
          border-radius: 10px;
          text-decoration: none;
          color: #64748b;
          font-size: 0.94rem;
          font-weight: 500;
          transition: background-color 0.15s ease, color 0.15s ease;
        }
        .nav-item:hover { background: #f8fafc; color: #0f172a; }
        .nav-item.active { background: #ebf3ff; color: #2563eb; font-weight: 600; }
        .nav-item svg { width: 19px; height: 19px; flex-shrink: 0; }
        .sidebar-footer-art {
          display: flex;
          justify-content: center;
          padding-top: 16px;
          opacity: 0.9;
          pointer-events: none;
          user-select: none;
        }
        .equiz-content {
          flex: 1;
          min-width: 0;
          padding: 20px 36px 48px;
          max-width: 1240px;
          margin: 0 auto;
        }
        .content-top-row {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          margin-bottom: 12px;
        }
        .user-profile-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 999px;
          transition: background-color 0.15s ease;
        }
        .user-profile-btn:hover { background: #eef2f6; }
        .user-name-label {
          font-size: 0.9rem;
          font-weight: 600;
          color: #334155;
        }
        .user-avatar {
          width: 36px;
          height: 36px;
          border-radius: 999px;
          background: #dce3ee;
          color: #1e293b;
          font-size: 0.9rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .panel-box {
          background: #ffffff;
          border: 1px solid #e8eef5;
          border-radius: 16px;
          padding: 20px 24px 22px;
          margin-bottom: 24px;
          box-shadow: 0 4px 20px rgba(15, 23, 42, 0.03);
        }
        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }
        .panel-title-wrap { display: flex; align-items: center; gap: 10px; }
        .panel-icon { width: 22px; height: 22px; color: #2563eb; flex-shrink: 0; }
        .panel-title { margin: 0; font-size: 1.15rem; font-weight: 700; color: #0f172a; }
        .search-wrap { position: relative; width: 270px; max-width: 100%; }
        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          width: 16px;
          height: 16px;
          color: #94a3b8;
          pointer-events: none;
        }
        .search-input {
          width: 100%;
          padding: 9px 14px 9px 36px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #ffffff;
          font-size: 0.88rem;
          color: #0f172a;
          outline: none;
        }
        .search-input:focus { border-color: #2563eb; }
        .table-wrap { width: 100%; overflow-x: auto; }
        .clean-table { width: 100%; border-collapse: collapse; text-align: left; }
        .clean-table thead th {
          background: #f5f7fb;
          color: #64748b;
          font-size: 0.82rem;
          font-weight: 600;
          padding: 11px 16px;
          border-bottom: 1px solid #eef2f6;
          white-space: nowrap;
        }
        .clean-table thead th:first-child { border-radius: 8px 0 0 8px; }
        .clean-table thead th:last-child { border-radius: 0 8px 8px 0; }
        .clean-table tbody tr { border-bottom: 1px solid #f1f5f9; }
        .clean-table tbody tr:last-child { border-bottom: none; }
        .clean-table tbody tr:hover { background: #fafcff; }
        .clean-table td { padding: 14px 16px; font-size: 0.94rem; color: #1e293b; vertical-align: middle; }
        .date-text { color: #334155; font-size: 0.9rem; white-space: nowrap; }
        .empty-box { padding: 36px 20px; text-align: center; color: #64748b; font-size: 0.92rem; }
        .btn-yes {
          padding: 11px 20px;
          border-radius: 10px;
          font-size: 0.92rem;
          font-weight: 600;
          cursor: pointer;
          border: none;
          background: #2563eb;
          color: #ffffff;
          transition: background-color 0.15s ease;
        }
        .btn-yes:hover { background: #1d4ed8; }
        .btn-no {
          padding: 11px 18px;
          border-radius: 10px;
          font-size: 0.92rem;
          font-weight: 600;
          cursor: pointer;
          border: none;
          background: #f1f5f9;
          color: #334155;
        }
        .btn-no:hover { background: #e2e8f0; }
        @media (max-width: 860px) {
          .equiz-layout { flex-direction: column; }
          .equiz-sidebar {
            width: 100%;
            height: auto;
            position: static;
            border-right: none;
            border-bottom: 1px solid #eef2f6;
            padding: 14px 16px;
            flex-direction: row;
            align-items: center;
          }
          .sidebar-brand { padding: 0; }
          .sidebar-nav { flex-direction: row; gap: 4px; }
          .nav-item { padding: 8px 10px; font-size: 0.85rem; }
          .sidebar-footer-art { display: none; }
          .equiz-content { padding: 20px 16px 40px; width: 100%; }
        }
      `}</style>

      <aside className="equiz-sidebar">
        <div>
          <div className="sidebar-brand" onClick={() => navigate("/")}>
            <img
              src={EQUIZ_LOGO_SRC}
              alt="equiz эмблемасы"
              className="sidebar-logo"
            />
            <h1 className="sidebar-brand-name">equiz</h1>
          </div>

          <nav className="sidebar-nav">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" />
                <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z" />
              </svg>
              <span>Басты бет</span>
            </NavLink>

            <NavLink
              to="/results"
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 13a1 1 0 011-1h2a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1v-7zm6-5a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V8zm6-4a1 1 0 011-1h2a1 1 0 011 1v16a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
              <span>Нәтижелер</span>
            </NavLink>

            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Параметрлер</span>
            </NavLink>

            <NavLink
              to="/shared-tests"
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Онлайн тестілеу</span>
            </NavLink>
          </nav>
        </div>

        <div className="sidebar-footer-art">
          <svg
            width="110"
            height="88"
            viewBox="0 0 110 88"
            fill="none"
            aria-hidden="true"
          >
            <path d="M55 12L14 30L55 48L96 30L55 12Z" fill="#DBEAFE" />
            <path
              d="M30 37V52C30 57 41 62 55 62C69 62 80 57 80 52V37L55 48L30 37Z"
              fill="#BFDBFE"
            />
            <path
              d="M90 33V48"
              stroke="#93C5FD"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="90" cy="50" r="3" fill="#93C5FD" />
            <rect x="24" y="62" width="62" height="10" rx="4" fill="#DBEAFE" />
            <rect x="20" y="74" width="70" height="10" rx="4" fill="#E2E8F0" />
          </svg>
        </div>
      </aside>

      <main className="equiz-content">
        <div className="content-top-row">
          <button
            type="button"
            className="user-profile-btn"
            onClick={() => navigate("/settings")}
            title="Параметрлер"
          >
            <span className="user-name-label">{userName}</span>
            <span className="user-avatar">{userInitial}</span>
          </button>
        </div>

        {children}
      </main>
    </div>
  );
};

export default Layout;