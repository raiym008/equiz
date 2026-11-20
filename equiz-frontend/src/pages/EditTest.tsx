import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DeckEditor } from '../components/DeckEditor';
import { testService } from '../services/test.service';
import type { DeckOut } from '../types';

const EditTest: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [deck, setDeck] = useState<DeckOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('Материал идентификаторы көрсетілмеген');
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    testService
      .getDeck(id, controller.signal)
      .then((data) => setDeck(data))
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Материал табылмады');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [id]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#f6f9fe',
          padding: 48,
          textAlign: 'center',
          color: '#64748b',
        }}
      >
        Жүктелуде...
      </div>
    );
  }

  if (error || !deck) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#f6f9fe',
          padding: 48,
          textAlign: 'center',
        }}
      >
        <p style={{ color: '#dc2626', marginBottom: 16 }}>
          {error || 'Материал табылмады'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          style={{
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '10px 20px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Басты бетке оралу
        </button>
      </div>
    );
  }

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
        initialDeck={deck}
        onSaved={() => navigate('/')}
        onCancel={() => navigate('/')}
      />
    </div>
  );
};

export default EditTest;