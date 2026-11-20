import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DeckEditor } from '../components/DeckEditor';

const UploadTest: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: '#f6f9fe', paddingTop: 20 }}>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '0 16px' }}>
        <button
          type="button"
          onClick={() => navigate('/')}
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 999,
            padding: '8px 16px',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
            color: '#1e293b',
          }}
        >
          ← Артқа
        </button>
      </div>
      <DeckEditor
        onSaved={() => navigate('/')}
        onCancel={() => navigate('/')}
      />
    </div>
  );
};

export default UploadTest;