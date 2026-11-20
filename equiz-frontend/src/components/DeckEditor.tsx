import React, { useRef, useState } from 'react';
import type {
  DeckOut,
  FlashcardDraft,
  McqDraft,
  StudyItemDraft,
} from '../types';
import { createDeck, parseDocxFile, updateDeck } from '../api/equizapi';

interface DeckEditorProps {
  initialDeck?: DeckOut | null;
  onSaved?: (deck: DeckOut) => void;
  onCancel?: () => void;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const TIMER_PRESETS = [
  { minutes: null, label: 'Шексіз', tag: 'Еркін оқу', badge: '∞' },
  { minutes: 5, label: '5 мин', tag: 'Блиц-тест', badge: '5м' },
  { minutes: 10, label: '10 мин', tag: 'Жылдам', badge: '10м' },
  { minutes: 15, label: '15 мин', tag: 'Стандарт', badge: '15м' },
  { minutes: 30, label: '30 мин', tag: 'Толық тест', badge: '30м' },
  { minutes: 60, label: '60 мин', tag: 'Емтихан', badge: '60м' },
];

function emptyMcq(): McqDraft {
  return {
    item_type: 'mcq',
    points: 1,
    payload: {
      question: '',
      options: { A: '', B: '', C: '', D: '' },
      correct_keys: [],
    },
  };
}

function emptyCard(): FlashcardDraft {
  return {
    item_type: 'flashcard',
    points: 1,
    payload: { front: '', back: '' },
  };
}

export const DeckEditor: React.FC<DeckEditorProps> = ({
  initialDeck,
  onSaved,
}) => {
  const [title, setTitle] = useState(initialDeck?.title ?? '');
  const [timeLimitMin, setTimeLimitMin] = useState<number | null>(
    initialDeck?.settings?.time_limit_sec
      ? Math.round(initialDeck.settings.time_limit_sec / 60)
      : null
  );
  const [timerModalOpen, setTimerModalOpen] = useState(false);

  const [items, setItems] = useState<StudyItemDraft[]>(
    initialDeck
      ? (initialDeck.items.map((i) => ({
          item_type: i.item_type,
          points: i.points,
          payload: i.payload,
        })) as StudyItemDraft[])
      : [emptyMcq()]
  );

  const [editingOpt, setEditingOpt] = useState<{ idx: number; key: string } | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const processFile = async (file: File) => {
    setError(null);
    setParsing(true);
    try {
      const parsed = await parseDocxFile(file);
      if (!title.trim()) setTitle(file.name.replace(/\.docx$/i, ''));
      setItems((prev) => {
        const isBlank =
          prev.length === 1 &&
          prev[0].item_type === 'mcq' &&
          !prev[0].payload.question.trim();
        return isBlank ? parsed : [...prev, ...parsed];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Файлды оқу сәтсіз аяқталды');
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const updateItem = (idx: number, next: StudyItemDraft) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? next : it)));
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleCorrect = (idx: number, key: string) => {
    const item = items[idx];
    if (item.item_type !== 'mcq') return;
    if (!item.payload.options[key]?.trim()) {
      setEditingOpt({ idx, key });
      setEditDraft('');
      return;
    }
    const exists = item.payload.correct_keys.includes(key);
    const correct_keys = exists
      ? item.payload.correct_keys.filter((k) => k !== key)
      : [...item.payload.correct_keys, key];
    updateItem(idx, { ...item, payload: { ...item.payload, correct_keys } });
  };

  const startEditOption = (idx: number, key: string, currentVal: string) => {
    setEditingOpt({ idx, key });
    setEditDraft(currentVal);
  };

  const commitEditOption = () => {
    if (!editingOpt) return;
    const { idx, key } = editingOpt;
    const item = items[idx];
    if (item && item.item_type === 'mcq') {
      updateItem(idx, {
        ...item,
        payload: {
          ...item.payload,
          options: { ...item.payload, options: { ...item.payload.options, [key]: editDraft.trim() } }.options,
        },
      });
    }
    setEditingOpt(null);
    setEditDraft('');
  };

  const addOption = (idx: number) => {
    const item = items[idx];
    if (item.item_type !== 'mcq') return;
    const nextKey = LETTERS.find((l) => !(l in item.payload.options));
    if (!nextKey) return;
    updateItem(idx, {
      ...item,
      payload: {
        ...item.payload,
        options: { ...item.payload.options, [nextKey]: '' },
      },
    });
    setEditingOpt({ idx, key: nextKey });
    setEditDraft('');
  };

  const removeOption = (idx: number, keyToRemove: string) => {
    const item = items[idx];
    if (item.item_type !== 'mcq') return;
    const entries = Object.entries(item.payload.options).filter(([k]) => k !== keyToRemove);
    if (entries.length < 2) return;
    updateItem(idx, {
      ...item,
      payload: {
        ...item.payload,
        options: Object.fromEntries(entries),
        correct_keys: item.payload.correct_keys.filter((k) => k !== keyToRemove),
      },
    });
  };

  const handleSave = async () => {
    setError(null);
    if (!title.trim()) {
      setError('Материал атауын жазыңыз.');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.item_type === 'mcq') {
        if (!it.payload.question.trim()) {
          setError(`#${i + 1} сұрақтың мәтінін жазыңыз.`);
          return;
        }
        if (Object.values(it.payload.options).some((v) => !v.trim())) {
          setError(`#${i + 1} сұрақтың барлық нұсқасын толтырыңыз.`);
          return;
        }
        if (it.payload.correct_keys.length === 0) {
          setError(`#${i + 1} сұрақтың дұрыс жауабын (бір рет басып) белгілеңіз.`);
          return;
        }
      } else if (!it.payload.front.trim() || !it.payload.back.trim()) {
        setError(`#${i + 1} карточканың екі бетін де толтырыңыз.`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: null,
        settings: { time_limit_sec: timeLimitMin ? timeLimitMin * 60 : null },
        items,
      };
      const saved = initialDeck
        ? await updateDeck(initialDeck.id, payload)
        : await createDeck(payload);
      onSaved?.(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Сақтау кезінде қате шықты');
    } finally {
      setSaving(false);
    }
  };

  const mcqCount = items.filter((i) => i.item_type === 'mcq').length;
  const fcCount = items.filter((i) => i.item_type === 'flashcard').length;

  return (
    <div className="eq-ce-shell">
      <style>{`
        .eq-ce-shell {
          max-width: 1020px;
          margin: 0 auto;
          padding: 16px 16px 72px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          color: #0f172a;
        }
        .eq-ce-shell *, .eq-ce-shell *::before, .eq-ce-shell *::after { box-sizing: border-box; }

        .eq-ce-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 230px;
          gap: 20px;
          align-items: start;
        }

        /* Жоғарғы атау + Сақтау жолағы */
        .eq-ce-top {
          position: sticky;
          top: 10px;
          z-index: 30;
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(8px);
          padding: 12px 16px;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 6px 20px rgba(15, 23, 42, 0.05);
          margin-bottom: 12px;
        }
        .eq-ce-title {
          flex: 1;
          min-width: 0;
          border: none;
          outline: none;
          background: transparent;
          font-size: 1.08rem;
          font-weight: 700;
          color: #0f172a;
        }
        .eq-ce-title::placeholder { color: #94a3b8; font-weight: 500; }

        .eq-ce-save {
          background: #2563eb;
          color: #ffffff;
          border: none;
          padding: 8px 18px;
          border-radius: 9px;
          font-size: 0.88rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }
        .eq-ce-save:hover:not(:disabled) { background: #1d4ed8; }
        .eq-ce-save:disabled { opacity: 0.6; cursor: not-allowed; }

        /* Оң жақ Kahoot-стиліндегі бүйірлік панель */
        .eq-ce-rail {
          position: sticky;
          top: 10px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .eq-rail-box {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.03);
        }
        .eq-rail-label {
          font-size: 0.74rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #94a3b8;
          margin: 0 0 10px 0;
        }
        .eq-time-trigger {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: 12px;
          border: 1.5px solid #e2e8f0;
          background: #f8fafc;
          cursor: pointer;
          text-align: left;
          transition: all 0.16s ease;
        }
        .eq-time-trigger:hover {
          border-color: #2563eb;
          background: #eff6ff;
        }
        .eq-time-trigger.active {
          border-color: #93c5fd;
          background: #eff6ff;
        }
        .eq-time-emblem {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: #ffffff;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.12);
          flex-shrink: 0;
        }
        .eq-time-val {
          display: block;
          font-size: 0.96rem;
          font-weight: 700;
          color: #0f172a;
        }
        .eq-time-sub {
          display: block;
          font-size: 0.75rem;
          color: #64748b;
        }

        .eq-rail-stats {
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 0.86rem;
          color: #475569;
        }
        .eq-rail-stat-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .eq-rail-stat-row strong { color: #0f172a; }

        /* Таймер таңдау модальды карточкалары */
        .eq-tm-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 16px;
        }
        .eq-tm-modal {
          background: #ffffff;
          border-radius: 20px;
          padding: 24px;
          max-width: 480px;
          width: 100%;
          box-shadow: 0 24px 48px rgba(15, 23, 42, 0.18);
        }
        .eq-tm-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .eq-tm-head h3 {
          margin: 0;
          font-size: 1.12rem;
          font-weight: 800;
        }
        .eq-tm-close {
          border: none;
          background: #f1f5f9;
          width: 30px;
          height: 30px;
          border-radius: 999px;
          cursor: pointer;
          color: #475569;
          font-weight: 700;
        }
        .eq-tm-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .eq-tm-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 16px 10px;
          border-radius: 14px;
          border: 1.5px solid #e2e8f0;
          background: #f8fafc;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .eq-tm-card:hover {
          border-color: #93c5fd;
          background: #eff6ff;
          transform: translateY(-2px);
        }
        .eq-tm-card.selected {
          border-color: #2563eb;
          background: #eff6ff;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
        }
        .eq-tm-badge {
          width: 46px;
          height: 46px;
          border-radius: 14px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          color: #2563eb;
          font-size: 1rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 8px;
          box-shadow: 0 3px 10px rgba(37, 99, 235, 0.08);
        }
        .eq-tm-card.selected .eq-tm-badge {
          background: #2563eb;
          border-color: #2563eb;
          color: #ffffff;
        }
        .eq-tm-title {
          font-size: 0.92rem;
          font-weight: 700;
          color: #0f172a;
        }
        .eq-tm-tag {
          font-size: 0.72rem;
          color: #64748b;
          margin-top: 2px;
        }

        /* Компакт Smart Import (.docx) */
        .eq-ce-import {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 11px 16px;
          margin-bottom: 16px;
          border-radius: 14px;
          background: linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%);
          border: 1.5px dashed #93c5fd;
          cursor: pointer;
          transition: all 0.18s ease;
        }
        .eq-ce-import:hover, .eq-ce-import.drag {
          border-color: #2563eb;
          background: linear-gradient(135deg, #dbeafe 0%, #ede9fe 100%);
        }
        .eq-ce-import input[type="file"] {
          position: absolute;
          inset: 0;
          opacity: 0;
          cursor: pointer;
        }
        .eq-ce-import-left { display: flex; align-items: center; gap: 10px; }
        .eq-ce-import-ico {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          background: #ffffff;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 6px rgba(37, 99, 235, 0.12);
          flex-shrink: 0;
        }
        .eq-ce-import-title { margin: 0; font-size: 0.88rem; font-weight: 700; color: #0f172a; }
        .eq-ce-import-sub { margin: 0; font-size: 0.76rem; color: #475569; }
        .eq-ce-import-pill {
          background: #0f172a;
          color: #ffffff;
          font-size: 0.76rem;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 999px;
          white-space: nowrap;
        }

        .eq-ce-err {
          background: #fef2f2;
          color: #dc2626;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 0.86rem;
          font-weight: 500;
          margin-bottom: 14px;
        }

        .eq-ce-list { display: flex; flex-direction: column; gap: 12px; }
        .eq-ce-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-left: 3.5px solid #cbd5e1;
          border-radius: 14px;
          padding: 14px 16px;
        }
        .eq-ce-card.mcq { border-left-color: #2563eb; }
        .eq-ce-card.fc { border-left-color: #8b5cf6; }

        .eq-ce-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .eq-ce-meta { display: flex; align-items: center; gap: 7px; }
        .eq-ce-num { font-size: 0.8rem; font-weight: 700; color: #64748b; }
        .eq-ce-tag {
          font-size: 0.72rem;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 6px;
          background: #eff6ff;
          color: #2563eb;
        }
        .eq-ce-tag.fc { background: #f3e8ff; color: #7c3aed; }

        .eq-ce-tools { display: flex; align-items: center; gap: 6px; }
        .eq-ce-pts {
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #64748b;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 3px 9px;
          border-radius: 7px;
          cursor: pointer;
        }
        .eq-ce-pts.active { background: #fef3c7; border-color: #fcd34d; color: #b45309; }
        .eq-ce-del {
          border: none;
          background: transparent;
          color: #94a3b8;
          font-size: 0.95rem;
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 6px;
        }
        .eq-ce-del:hover:not(:disabled) { background: #fef2f2; color: #dc2626; }
        .eq-ce-del:disabled { opacity: 0.3; cursor: not-allowed; }

        .eq-ce-q {
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          padding: 9px 11px;
          font-family: inherit;
          font-size: 0.93rem;
          font-weight: 600;
          color: #0f172a;
          outline: none;
          resize: vertical;
          margin-bottom: 8px;
        }
        .eq-ce-q:focus { border-color: #2563eb; }

        .eq-ce-hint { font-size: 0.73rem; color: #94a3b8; margin-bottom: 7px; }
        .eq-ce-opts { display: flex; flex-direction: column; gap: 6px; }
        .eq-ce-opt {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          cursor: pointer;
          user-select: none;
          transition: all 0.12s ease;
        }
        .eq-ce-opt:hover { border-color: #cbd5e1; background: #f1f5f9; }
        .eq-ce-opt.correct { background: #ecfdf5; border-color: #6ee7b7; }
        .eq-ce-opt.editing {
          background: #ffffff;
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12);
          cursor: text;
        }
        .eq-ce-key {
          width: 26px;
          height: 26px;
          border-radius: 7px;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #475569;
          font-weight: 700;
          font-size: 0.8rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .eq-ce-opt.correct .eq-ce-key { background: #10b981; border-color: #10b981; color: #ffffff; }
        .eq-ce-opt-txt { flex: 1; font-size: 0.9rem; color: #1e293b; }
        .eq-ce-opt-txt.empty { color: #94a3b8; font-style: italic; }
        .eq-ce-opt.correct .eq-ce-opt-txt { color: #065f46; font-weight: 500; }
        .eq-ce-opt-ok {
          font-size: 0.72rem;
          font-weight: 700;
          color: #059669;
          background: #d1fae5;
          padding: 2px 7px;
          border-radius: 6px;
        }
        .eq-ce-opt-del {
          border: none;
          background: transparent;
          color: #94a3b8;
          font-size: 0.82rem;
          cursor: pointer;
          padding: 2px 5px;
          border-radius: 5px;
        }
        .eq-ce-opt-del:hover { color: #dc2626; background: #fee2e2; }
        .eq-ce-inline {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          font-family: inherit;
          font-size: 0.9rem;
          color: #0f172a;
        }
        .eq-ce-add-opt {
          margin-top: 7px;
          border: none;
          background: transparent;
          color: #2563eb;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          padding: 2px 0;
        }

        .eq-ce-fc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .eq-ce-fc-in {
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          padding: 9px 11px;
          font-family: inherit;
          font-size: 0.9rem;
          outline: none;
          resize: vertical;
        }
        .eq-ce-fc-in:focus { border-color: #7c3aed; }
        .eq-ce-fc-in.back { background: #faf5ff; border-color: #e9d5ff; }

        .eq-ce-bottom { display: flex; gap: 10px; margin-top: 14px; }
        .eq-ce-add {
          flex: 1;
          padding: 11px;
          border-radius: 12px;
          border: 1.5px dashed #cbd5e1;
          background: #ffffff;
          color: #334155;
          font-size: 0.88rem;
          font-weight: 600;
          cursor: pointer;
        }
        .eq-ce-add:hover { border-color: #2563eb; color: #2563eb; background: #eff6ff; }
        .eq-ce-add.fc:hover { border-color: #7c3aed; color: #7c3aed; background: #faf5ff; }

        @media (max-width: 860px) {
          .eq-ce-grid { grid-template-columns: 1fr; }
          .eq-ce-rail { position: static; order: -1; }
        }
        @media (max-width: 600px) {
          .eq-tm-grid { grid-template-columns: repeat(2, 1fr); }
          .eq-ce-import { flex-direction: column; align-items: flex-start; }
          .eq-ce-fc-grid, .eq-ce-bottom { grid-template-columns: 1fr; flex-direction: column; }
        }
      `}</style>

      <div className="eq-ce-grid">
        <div>
          <div className="eq-ce-top">
            <input
              type="text"
              className="eq-ce-title"
              placeholder="Материал атауын жазыңыз..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <button
              type="button"
              className="eq-ce-save"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Сақталуда...' : 'Сақтау'}
            </button>
          </div>

          <div
            className={`eq-ce-import ${isDragging ? 'drag' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const dropped = e.dataTransfer.files?.[0];
              if (dropped) processFile(dropped);
            }}
          >
            <input ref={fileRef} type="file" accept=".docx" onChange={handleFile} />
            <div className="eq-ce-import-left">
              <div className="eq-ce-import-ico">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                </svg>
              </div>
              <div>
                <p className="eq-ce-import-title">
                  {parsing ? 'Сұрақтар талдануда...' : 'Word (.docx) файлы дайын ба?'}
                </p>
                <p className="eq-ce-import-sub">
                  Файлды осында тастаңыз — сұрақтар 2 секундта өзі жиналады
                </p>
              </div>
            </div>
            <span className="eq-ce-import-pill">
              {parsing ? 'Күте тұрыңыз...' : 'Файлдан тарту →'}
            </span>
          </div>

          {error && <div className="eq-ce-err">{error}</div>}

          <div className="eq-ce-list">
            {items.map((item, idx) => (
              <div
                key={idx}
                className={`eq-ce-card ${item.item_type === 'flashcard' ? 'fc' : 'mcq'}`}
              >
                <div className="eq-ce-head">
                  <div className="eq-ce-meta">
                    <span className="eq-ce-num">#{idx + 1}</span>
                    <span className={`eq-ce-tag ${item.item_type === 'flashcard' ? 'fc' : ''}`}>
                      {item.item_type === 'mcq' ? 'Тест' : 'Карточка'}
                    </span>
                  </div>

                  <div className="eq-ce-tools">
                    {item.item_type === 'mcq' && (
                      <button
                        type="button"
                        className={`eq-ce-pts ${item.points === 2 ? 'active' : ''}`}
                        onClick={() =>
                          updateItem(idx, { ...item, points: item.points === 1 ? 2 : 1 })
                        }
                        title="Ұпай санын ауыстыру"
                      >
                        {item.points} ұпай
                      </button>
                    )}
                    <button
                      type="button"
                      className="eq-ce-del"
                      disabled={items.length <= 1}
                      onClick={() => removeItem(idx)}
                      title="Өшіру"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {item.item_type === 'mcq' ? (
                  <div>
                    <textarea
                      className="eq-ce-q"
                      rows={2}
                      placeholder="Сұрақ мәтіні..."
                      value={item.payload.question}
                      onChange={(e) =>
                        updateItem(idx, {
                          ...item,
                          payload: { ...item.payload, question: e.target.value },
                        })
                      }
                    />

                    <div className="eq-ce-hint">
                      1× басу — дұрыс жауап · 2× басу — мәтінді өңдеу
                    </div>

                    <div className="eq-ce-opts">
                      {Object.entries(item.payload.options).map(([key, val]) => {
                        const isCorrect = item.payload.correct_keys.includes(key);
                        const isEditing = editingOpt?.idx === idx && editingOpt?.key === key;

                        return (
                          <div
                            key={key}
                            className={`eq-ce-opt ${isCorrect ? 'correct' : ''} ${
                              isEditing ? 'editing' : ''
                            }`}
                            onClick={() => {
                              if (!isEditing) toggleCorrect(idx, key);
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              startEditOption(idx, key, val);
                            }}
                          >
                            <span className="eq-ce-key">{key}</span>

                            {isEditing ? (
                              <input
                                type="text"
                                autoFocus
                                className="eq-ce-inline"
                                placeholder={`${key} нұсқасын жазыңыз...`}
                                value={editDraft}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setEditDraft(e.target.value)}
                                onBlur={commitEditOption}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitEditOption();
                                  if (e.key === 'Escape') {
                                    setEditingOpt(null);
                                    setEditDraft('');
                                  }
                                }}
                              />
                            ) : (
                              <span className={`eq-ce-opt-txt ${!val.trim() ? 'empty' : ''}`}>
                                {val.trim() || `${key} нұсқасын жазу үшін басыңыз...`}
                              </span>
                            )}

                            {isCorrect && !isEditing && (
                              <span className="eq-ce-opt-ok">Дұрыс ✓</span>
                            )}

                            {Object.keys(item.payload.options).length > 2 && !isEditing && (
                              <button
                                type="button"
                                className="eq-ce-opt-del"
                                title="Нұсқаны өшіру"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeOption(idx, key);
                                }}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {Object.keys(item.payload.options).length < LETTERS.length && (
                      <button
                        type="button"
                        className="eq-ce-add-opt"
                        onClick={() => addOption(idx)}
                      >
                        + Нұсқа қосу
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="eq-ce-fc-grid">
                    <textarea
                      className="eq-ce-fc-in"
                      rows={2}
                      placeholder="Сұрақ / Термин (алдыңғы беті)"
                      value={item.payload.front}
                      onChange={(e) =>
                        updateItem(idx, {
                          ...item,
                          payload: { ...item.payload, front: e.target.value },
                        })
                      }
                    />
                    <textarea
                      className="eq-ce-fc-in back"
                      rows={2}
                      placeholder="Жауап / Анықтама (артқы беті)"
                      value={item.payload.back}
                      onChange={(e) =>
                        updateItem(idx, {
                          ...item,
                          payload: { ...item.payload, back: e.target.value },
                        })
                      }
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="eq-ce-bottom">
            <button
              type="button"
              className="eq-ce-add"
              onClick={() => setItems((prev) => [...prev, emptyMcq()])}
            >
              + Сұрақ қосу
            </button>
            <button
              type="button"
              className="eq-ce-add fc"
              onClick={() => setItems((prev) => [...prev, emptyCard()])}
            >
              + Карточка қосу
            </button>
          </div>
        </div>

        {/* Оң жақ Kahoot-стиліндегі баптау панелі */}
        <aside className="eq-ce-rail">
          <div className="eq-rail-box">
            <p className="eq-rail-label">Баптаулар</p>
            <button
              type="button"
              className={`eq-time-trigger ${timeLimitMin ? 'active' : ''}`}
              onClick={() => setTimerModalOpen(true)}
            >
              <span className="eq-time-emblem">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="13" r="8" />
                  <path strokeLinecap="round" d="M12 9v4l2.5 2.5M9.5 3h5" />
                </svg>
              </span>
              <div>
                <span className="eq-time-val">
                  {timeLimitMin ? `${timeLimitMin} минут` : 'Уақыт: Шексіз'}
                </span>
                <span className="eq-time-sub">Өзгерту үшін басыңыз</span>
              </div>
            </button>
          </div>

          <div className="eq-rail-box">
            <p className="eq-rail-label">Құрамы</p>
            <div className="eq-rail-stats">
              <div className="eq-rail-stat-row">
                <span>Тест сұрақтары</span>
                <strong>{mcqCount}</strong>
              </div>
              <div className="eq-rail-stat-row">
                <span>Карточкалар</span>
                <strong>{fcCount}</strong>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Креативті уақыт таңдау карточкалары */}
      {timerModalOpen && (
        <div className="eq-tm-overlay" onClick={() => setTimerModalOpen(false)}>
          <div className="eq-tm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="eq-tm-head">
              <h3>Тест уақытын таңдаңыз</h3>
              <button
                type="button"
                className="eq-tm-close"
                onClick={() => setTimerModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="eq-tm-grid">
              {TIMER_PRESETS.map((preset) => {
                const isSelected = timeLimitMin === preset.minutes;
                return (
                  <button
                    key={String(preset.minutes)}
                    type="button"
                    className={`eq-tm-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      setTimeLimitMin(preset.minutes);
                      setTimerModalOpen(false);
                    }}
                  >
                    <span className="eq-tm-badge">{preset.badge}</span>
                    <span className="eq-tm-title">{preset.label}</span>
                    <span className="eq-tm-tag">{preset.tag}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};