import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import type {
  SharedQuizInfo,
  QuizSessionOut,
  QuizAttemptOut,
  PublicFlashcardItem,
  QuizSubmitPayload,
} from '../../types';
import { testService } from '../../services/test.service';
import { questionService } from '../../services/question.service';
import { resultService } from '../../services/result.service';

interface StoredSession {
  attempt_id: string;
  session_token: string;
}

interface FlashcardItem {
  id: string;
  question: string;
  answer: string;
}

const PublicQuiz: React.FC = () => {
  const { shareCode } = useParams<{ shareCode: string }>();
  const storageKey = `equiz_guest_session_${shareCode}`;

  const [step, setStep] = useState<'loading' | 'intro' | 'testing' | 'flashcards' | 'result' | 'error'>('loading');
  const [errorText, setErrorText] = useState<string>('');
  const [quizInfo, setQuizInfo] = useState<SharedQuizInfo | null>(null);

  // 1-қадам: Лобби (Қатысушының аты, Бөлісу, Карточкалар)
  const [participantName, setParticipantName] = useState<string>('');
  const [starting, setStarting] = useState<boolean>(false);
  const [toastText, setToastText] = useState<string>('');

  // Карточкалар режимі
  const [flashcards, setFlashcards] = useState<FlashcardItem[]>([]);
  const [cardsLoading, setCardsLoading] = useState<boolean>(false);
  const [cardIndex, setCardIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);

  // 2-қадам: Белсенді сессия (бір сұрақтан көрсету)
  const [session, setSession] = useState<QuizSessionOut | null>(null);
  const [token, setToken] = useState<string>('');
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [lockedSingle, setLockedSingle] = useState<boolean>(false);
  const [feedbackState, setFeedbackState] = useState<{
    isCorrect: boolean | null;
    correctKeys: string[];
    selectedKeys: string[];
  } | null>(null);
  const autoAdvanceTimer = useRef<number | null>(null);

  // 3-қадам: Дайын нәтиже
  const [result, setResult] = useState<QuizAttemptOut | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastText(msg);
    window.setTimeout(() => {
      setToastText((prev) => (prev === msg ? '' : prev));
    }, 2400);
  }, []);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current !== null) {
        window.clearTimeout(autoAdvanceTimer.current);
      }
    };
  }, []);

  // Бет ашылғанда: егер аяқталмаған сессия болса қалпына келтіру, болмаса тест ақпаратын жүктеу
  useEffect(() => {
    if (!shareCode) return;

    const init = async () => {
      try {
        const savedRaw = sessionStorage.getItem(storageKey);
        if (savedRaw) {
          const saved: StoredSession = JSON.parse(savedRaw);
          try {
            const resumedSession = await testService.resumePublicAttempt(
              saved.attempt_id,
              saved.session_token
            );
            setSession(resumedSession);
            setToken(saved.session_token);
            setSecondsLeft(resumedSession.remaining_seconds);
            setCurrentQuestionIndex(0);
            setLockedSingle(false);
            setStep('testing');
            return;
          } catch {
            sessionStorage.removeItem(storageKey);
          }
        }

        const info = await testService.getPublicQuizInfo(shareCode);
        setQuizInfo(info);
        setStep('intro');
      } catch (e: any) {
        setErrorText(e.message || 'Сервермен байланыс орнату мүмкін болмады');
        setStep('error');
      }
    };

    init();
  }, [shareCode, storageKey]);

  // «Бөлісу» батырмасы
  const handleShare = async () => {
    const shareUrl = window.location.href;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        showToast('Тест сілтемесі көшірілді!');
        return;
      }
    } catch {
      // fallback төменде
    }
    const ta = document.createElement('textarea');
    ta.value = shareUrl;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast('Тест сілтемесі көшірілді!');
    } catch {
      showToast('Сілтемені көшіру мүмкін болмады');
    }
    document.body.removeChild(ta);
  };

  // «Тестті бастау» батырмасы
  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareCode || !participantName.trim() || starting) return;

    setStarting(true);
    setErrorText('');
    try {
      const newSession = await testService.startPublicQuiz(
        shareCode,
        participantName.trim()
      );
      const sessionToken = newSession.session_token || '';

      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          attempt_id: newSession.attempt_id,
          session_token: sessionToken,
        } satisfies StoredSession)
      );

      setSession(newSession);
      setToken(sessionToken);
      setSecondsLeft(newSession.remaining_seconds);
      setCurrentQuestionIndex(0);
      setLockedSingle(false);
      setStep('testing');
    } catch (e: any) {
      setErrorText(e.message || 'Қате орын алды');
    } finally {
      setStarting(false);
    }
  };

  // «Карточкалар» режимін ашу
  const handleOpenFlashcards = async () => {
    if (!shareCode || cardsLoading) return;
    setCardsLoading(true);
    setIsFlipped(false);
    setCardIndex(0);

    try {
      const data: PublicFlashcardItem[] = await questionService.getPublicFlashcards(shareCode);
      setFlashcards(data);
      setStep('flashcards');
      return;
    } catch {
      showToast('Карточкаларды жүктеу мүмкін болмады');
    } finally {
      setCardsLoading(false);
    }
  };

  // Тестті аяқтау және серверге жіберу
  const handleSubmit = useCallback(async (overrideAnswers?: Record<string, string[]>) => {
    if (!session || submitting) return;
    setSubmitting(true);

    const finalAnswers = overrideAnswers || answers;

    try {
      const payload: QuizSubmitPayload = {
        answers: session.items.map((item) => ({
          item_id: item.id,
          selected_keys: finalAnswers[item.id] || [],
        })),
      };

      const attemptResult = await resultService.submitPublicAttempt(
        session.attempt_id,
        token,
        payload
      );
      sessionStorage.removeItem(storageKey);
      setResult(attemptResult);
      setStep('result');
    } catch (e: any) {
      setErrorText(e.message || 'Жауаптарды жіберу кезінде қате шықты');
      setLockedSingle(false);
    } finally {
      setSubmitting(false);
    }
  }, [session, submitting, answers, token, storageKey]);

  // Сұрақтың дұрыс жауабын сол сәтте тексеріп, жасыл/қызыл күйін көрсету
  const revealAndAdvance = useCallback(async (
    itemId: string,
    selectedKeys: string[],
    updatedAnswers: Record<string, string[]>
  ) => {
    if (!session) return;
    setLockedSingle(true);

    const activeItem = session.items.find((it) => it.id === itemId);
    const payloadAny = activeItem?.payload as any;
    const inlineCorrectKeys = (payloadAny?.correct_keys || payloadAny?.correct_answers) as string[] | undefined;

    let isCorrect: boolean | null = null;
    let correctKeys: string[] = [];
    let hasAnswerKey = false;

    if (Array.isArray(inlineCorrectKeys) && inlineCorrectKeys.length > 0) {
      correctKeys = inlineCorrectKeys;
      const sortedSel = [...selectedKeys].sort().join(',');
      const sortedRight = [...correctKeys].sort().join(',');
      isCorrect = sortedSel === sortedRight;
      hasAnswerKey = true;
    } else {
      try {
        const data = await questionService.checkPublicAnswer(
          session.attempt_id,
          token,
          itemId,
          selectedKeys
        );
        if (Array.isArray(data.correct_keys) && data.correct_keys.length > 0) {
          correctKeys = data.correct_keys;
          const sortedSel = [...selectedKeys].sort().join(',');
          const sortedRight = [...correctKeys].sort().join(',');
          isCorrect = sortedSel === sortedRight;
          hasAnswerKey = true;
        }
      } catch {
        // Серверде /check эндпоинты әлі қосылмаған жағдайда жалған жасыл көрсетпеу
      }
    }

    if (hasAnswerKey) {
      setFeedbackState({
        isCorrect,
        correctKeys,
        selectedKeys,
      });
    } else {
      setFeedbackState({
        isCorrect: null,
        correctKeys: [],
        selectedKeys,
      });
    }

    if (autoAdvanceTimer.current !== null) {
      window.clearTimeout(autoAdvanceTimer.current);
    }

    autoAdvanceTimer.current = window.setTimeout(() => {
      setFeedbackState(null);
      setLockedSingle(false);
      if (currentQuestionIndex < session.items.length - 1) {
        setCurrentQuestionIndex((idx) => idx + 1);
      } else {
        handleSubmit(updatedAnswers);
      }
    }, hasAnswerKey ? 2400 : 450);
  }, [session, token, currentQuestionIndex, handleSubmit]);

  // Жауапты таңдау:
  // - Бір жауапты болса: 1 рет басылғанда сол сәтте дұрыс жауабын жасылмен көрсетіп, келесі сұраққа өтеді
  // - Көп жауапты болса: нұсқаларды белгілеп, «Жіберу» батырмасы арқылы сол сәтте тексереді
  const toggleOption = useCallback((itemId: string, optionKey: string, isMulti: boolean) => {
    if (!session || submitting || lockedSingle || feedbackState !== null) return;

    if (!isMulti) {
      const updatedAnswers = { ...answers, [itemId]: [optionKey] };
      setAnswers(updatedAnswers);
      revealAndAdvance(itemId, [optionKey], updatedAnswers);
      return;
    }

    setAnswers((prev) => {
      const current = prev[itemId] || [];
      const exists = current.includes(optionKey);
      return {
        ...prev,
        [itemId]: exists
          ? current.filter((k) => k !== optionKey)
          : [...current, optionKey],
      };
    });
  }, [session, submitting, lockedSingle, feedbackState, answers, revealAndAdvance]);

  // Көп жауапты сұраққа арналған «Жіберу» батырмасы
  const handleMultiSubmit = () => {
    if (!session || submitting || lockedSingle || feedbackState !== null) return;
    const activeItem = session.items[currentQuestionIndex];
    if (!activeItem) return;
    const picked = answers[activeItem.id] || [];
    if (picked.length === 0) return;
    revealAndAdvance(activeItem.id, picked, answers);
  };

  // Пернетақтамен (1-5) таңдау (компьютерде)
  useEffect(() => {
    if (step !== 'testing' || !session) return;
    const activeItem = session.items[currentQuestionIndex];
    if (!activeItem) return;

    const optionEntries = Object.entries(activeItem.payload.options);
    const onKeyDown = (e: KeyboardEvent) => {
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= optionEntries.length) {
        const [optKey] = optionEntries[num - 1];
        toggleOption(activeItem.id, optKey, activeItem.payload.is_multi);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [step, session, currentQuestionIndex, toggleOption]);

  // Уақыт шектеуі болса — кері санақ таймері
  useEffect(() => {
    if (step !== 'testing' || secondsLeft === null) return;
    if (secondsLeft <= 0) {
      handleSubmit();
      return;
    }
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [step, secondsLeft, handleSubmit]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const currentItem = session ? session.items[currentQuestionIndex] : null;
  const totalQuestions = session ? session.items.length : 0;
  const answeredCount = Object.values(answers).filter((a) => a.length > 0).length;

  return (
    <div className="pq-wrapper">
      <style>{`
        .pq-wrapper {
          min-height: 100vh;
          min-height: 100dvh;
          background-color: #f3f5f9;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1440' height='900' viewBox='0 0 1440 900' fill='none'%3E%3Cpath d='M160 -20C140 80 280 120 420 40C480 5 460 -30 400 -40Z' fill='%23DBEAFE' fill-opacity='0.55'/%3E%3Cpath d='M1240 -20C1280 90 1380 140 1460 80L1460 -20Z' fill='%23CBD5E1' fill-opacity='0.35'/%3E%3Cpath d='M-20 720C80 680 210 730 290 830C330 880 280 930 200 930L-20 930Z' fill='%23DBEAFE' fill-opacity='0.5'/%3E%3Cpath d='M1160 890C1190 790 1310 730 1460 760L1460 920L1160 920Z' fill='%23DBEAFE' fill-opacity='0.5'/%3E%3Cpath d='M890 12L1010 12M890 36L1010 36M890 60L1010 60M890 84L1010 84M914 -10L914 108M938 -10L938 108M962 -10L962 108M986 -10L986 108' stroke='%23CBD5E1' stroke-width='1.2' stroke-opacity='0.65'/%3E%3Cpath d='M400 790L520 790M400 814L520 814M400 838L520 838M400 862L520 862M424 766L424 886M448 766L448 886M472 766L472 886M496 766L496 886' stroke='%23CBD5E1' stroke-width='1.2' stroke-opacity='0.65'/%3E%3Cpath d='M1140 800L1240 800M1140 824L1240 824M1140 848L1240 848M1164 776L1164 872M1188 776L1188 872M1212 776L1212 872' stroke='%23CBD5E1' stroke-width='1.2' stroke-opacity='0.55'/%3E%3Cpath d='M60 44C180 140 240 20 380 80' stroke='%2394A3B8' stroke-width='1.3' stroke-dasharray='5 5' stroke-opacity='0.5'/%3E%3Cpath d='M60 540C140 610 110 700 180 780' stroke='%2394A3B8' stroke-width='1.3' stroke-dasharray='5 5' stroke-opacity='0.5'/%3E%3Cpath d='M1250 420C1340 420 1320 510 1410 490' stroke='%2394A3B8' stroke-width='1.3' stroke-dasharray='5 5' stroke-opacity='0.5'/%3E%3Ccircle cx='455' cy='80' r='14' stroke='%2394A3B8' stroke-width='1.4' stroke-opacity='0.5'/%3E%3Ccircle cx='1190' cy='70' r='13' stroke='%2394A3B8' stroke-width='1.4' stroke-opacity='0.5'/%3E%3Ccircle cx='735' cy='810' r='14' stroke='%2394A3B8' stroke-width='1.4' stroke-opacity='0.5'/%3E%3Cpath d='M220 150V166M212 158H228M935 765V781M927 773H943M1245 360V376M1237 368H1253' stroke='%2394A3B8' stroke-width='1.5' stroke-opacity='0.55'/%3E%3C/svg%3E");
          background-size: cover;
          background-position: center;
          background-attachment: fixed;
          padding: 24px 16px 36px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #0f172a;
          display: flex;
          flex-direction: column;
        }
        .pq-brand {
          text-align: center;
          font-size: 1.5rem;
          font-weight: 800;
          color: #2563eb;
          margin-bottom: 22px;
          letter-spacing: -0.025em;
        }
        .pq-main {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
        }
        .pq-lobby-grid {
          width: 100%;
          max-width: 880px;
          display: grid;
          grid-template-columns: 5fr 7fr;
          gap: 24px;
          align-items: stretch;
        }
        .pq-card {
          background: rgba(255, 255, 255, 0.96);
          backdrop-filter: blur(8px);
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 28px;
          box-shadow: 0 12px 32px -12px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.04);
        }
        .pq-single-card {
          width: 100%;
          max-width: 520px;
          margin: 0 auto;
        }
        .pq-lobby-left {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .pq-icon-badge {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          background: #eff6ff;
          border: 1px solid #dbeafe;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 18px;
        }
        .pq-title {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 800;
          line-height: 1.25;
          color: #0f172a;
        }
        .pq-desc {
          margin: 10px 0 0;
          font-size: 0.92rem;
          color: #475569;
          line-height: 1.5;
        }
        .pq-meta-pills {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 14px;
        }
        .pq-pill {
          background: #eff6ff;
          color: #2563eb;
          font-size: 0.82rem;
          font-weight: 600;
          padding: 5px 12px;
          border-radius: 999px;
        }
        .pq-share-wrap {
          margin-top: 24px;
          padding-top: 18px;
          border-top: 1px solid #f1f5f9;
        }
        .pq-btn-share {
          width: 100%;
          padding: 11px 16px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #334155;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.15s ease;
        }
        .pq-btn-share:hover {
          background: #eff6ff;
          border-color: #bfdbfe;
          color: #1d4ed8;
        }
        .pq-lobby-right {
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .pq-label {
          display: block;
          font-weight: 700;
          margin-bottom: 8px;
          font-size: 0.92rem;
          color: #0f172a;
        }
        .pq-input {
          width: 100%;
          box-sizing: border-box;
          padding: 14px 16px;
          border-radius: 12px;
          border: 1.5px solid #cbd5e1;
          font-size: 16px;
          color: #0f172a;
          background: #ffffff;
          margin-bottom: 18px;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .pq-input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
        }
        .pq-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .pq-btn-start {
          width: 100%;
          padding: 14px 18px;
          border-radius: 12px;
          border: none;
          background: #2563eb;
          color: #ffffff;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 6px 16px -4px rgba(37, 99, 235, 0.35);
          transition: background 0.15s ease, transform 0.1s ease;
        }
        .pq-btn-start:hover:not(:disabled) { background: #1d4ed8; }
        .pq-btn-start:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }
        .pq-btn-cards {
          width: 100%;
          padding: 14px 18px;
          border-radius: 12px;
          border: 1.5px solid #e2e8f0;
          background: #ffffff;
          color: #0f172a;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.15s ease;
        }
        .pq-btn-cards:hover:not(:disabled) {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        /* ІШКІ ТЕСТ ТАПСЫРУ БЕТІ (1 сұрақ + бағаналы карточкалар) */
        .pq-stage-container {
          width: 100%;
          max-width: 960px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .pq-topbar {
          background: rgba(255, 255, 255, 0.96);
          backdrop-filter: blur(8px);
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 14px 18px;
          box-shadow: 0 6px 20px rgba(15, 23, 42, 0.05);
        }
        .pq-topbar-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        .pq-progress-track {
          width: 100%;
          height: 5px;
          background: #e2e8f0;
          border-radius: 999px;
          overflow: hidden;
          margin-top: 12px;
        }
        .pq-progress-fill {
          height: 100%;
          background: #2563eb;
          border-radius: 999px;
          transition: width 0.25s ease;
        }
        .pq-timer {
          background: #eff6ff;
          color: #1d4ed8;
          font-weight: 800;
          font-family: monospace;
          font-size: 1rem;
          padding: 6px 12px;
          border-radius: 10px;
          flex-shrink: 0;
        }
        .pq-timer.danger {
          background: #fef2f2;
          color: #dc2626;
        }
        .pq-question-box {
          background: rgba(255, 255, 255, 0.98);
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 28px 24px;
          text-align: center;
          box-shadow: 0 10px 28px -10px rgba(15, 23, 42, 0.07);
        }
        .pq-q-counter {
          display: inline-block;
          background: #eff6ff;
          color: #2563eb;
          font-size: 0.82rem;
          font-weight: 700;
          padding: 4px 12px;
          border-radius: 999px;
          margin-bottom: 12px;
        }
        .pq-q-text {
          font-size: 1.32rem;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.4;
          margin: 0 auto;
          max-width: 720px;
        }
        .pq-multi-hint {
          display: inline-block;
          margin-top: 12px;
          background: #f1f5f9;
          color: #475569;
          font-size: 0.8rem;
          font-weight: 600;
          padding: 4px 12px;
          border-radius: 999px;
        }

        /* Бағаналы жауап карточкалары (Desktop) */
        .pq-options-grid {
          display: grid;
          gap: 14px;
          width: 100%;
        }
        .pq-options-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
        .pq-options-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
        .pq-options-grid.cols-4 { grid-template-columns: repeat(4, 1fr); }
        .pq-options-grid.cols-5 { grid-template-columns: repeat(5, 1fr); }

        .pq-opt-card {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          min-height: 148px;
          padding: 28px 16px 20px;
          border-radius: 18px;
          border: 2px solid #e2e8f0;
          background: #ffffff;
          color: #0f172a;
          font-size: 1rem;
          font-weight: 600;
          line-height: 1.4;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
          transition: transform 0.12s ease, border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .pq-opt-card:hover {
          border-color: #93c5fd;
          background: #f8fafc;
          transform: translateY(-2px);
        }
        .pq-opt-card.selected {
          border-color: #2563eb;
          background: #eff6ff;
          color: #1e3a8a;
          box-shadow: 0 8px 20px -6px rgba(37, 99, 235, 0.25);
        }
        .pq-opt-num {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 24px;
          height: 24px;
          border-radius: 7px;
          background: #f1f5f9;
          color: #64748b;
          font-size: 0.75rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .pq-opt-card.selected .pq-opt-num {
          background: #2563eb;
          color: #ffffff;
        }
        .pq-opt-check {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 24px;
          height: 24px;
          border-radius: 7px;
          border: 2px solid #cbd5e1;
          background: #ffffff;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }
        .pq-opt-card.selected .pq-opt-check {
          border-color: #2563eb;
          background: #2563eb;
          color: #ffffff;
        }
        /* Сол сәтте жауапты көрсету: қанық емес, мәтінге фокус беретін жұмсақ реңктер */
        .pq-opt-card.reveal-dim {
          opacity: 0;
          pointer-events: none;
          transform: scale(0.97);
        }
        .pq-opt-card.reveal-correct {
          background: #ecfdf5 !important;
          border-color: #34d399 !important;
          color: #064e3b !important;
          box-shadow: 0 6px 18px -6px rgba(16, 185, 129, 0.18) !important;
          pointer-events: none;
        }
        .pq-opt-card.reveal-wrong {
          background: #fef2f2 !important;
          border-color: #f87171 !important;
          color: #7f1d1d !important;
          box-shadow: 0 6px 18px -6px rgba(239, 68, 68, 0.16) !important;
          pointer-events: none;
        }
        .pq-status-badge {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 24px;
          height: 24px;
          border-radius: 7px;
          font-size: 0.88rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }
        .pq-opt-card.reveal-correct .pq-status-badge {
          background: #d1fae5;
          border: 1px solid #6ee7b7;
          color: #065f46;
        }
        .pq-opt-card.reveal-wrong .pq-status-badge {
          background: #fee2e2;
          border: 1px solid #fca5a5;
          color: #991b1b;
        }
        .pq-feedback-banner {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 14px 20px;
          text-align: center;
          font-size: 0.98rem;
          font-weight: 700;
          z-index: 60;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          backdrop-filter: blur(8px);
        }
        .pq-feedback-banner.is-correct {
          background: rgba(236, 253, 245, 0.96);
          color: #065f46;
          border-top: 1.5px solid #6ee7b7;
        }
        .pq-feedback-banner.is-wrong {
          background: rgba(254, 242, 242, 0.96);
          color: #991b1b;
          border-top: 1.5px solid #fca5a5;
        }
        .pq-feedback-banner.is-neutral {
          background: rgba(239, 246, 255, 0.96);
          color: #1e40af;
          border-top: 1.5px solid #bfdbfe;
        }

        /* Көп жауапты сұраққа арналған «Жіберу» батырмасы */
        .pq-multi-submit-wrap {
          display: flex;
          justify-content: flex-end;
          margin-top: 4px;
        }
        .pq-btn-submit-multi {
          padding: 14px 32px;
          border-radius: 12px;
          border: none;
          background: #2563eb;
          color: #ffffff;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 6px 16px -4px rgba(37, 99, 235, 0.35);
          transition: background 0.15s ease, opacity 0.15s ease;
        }
        .pq-btn-submit-multi:hover:not(:disabled) {
          background: #1d4ed8;
        }
        .pq-btn-submit-multi:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          box-shadow: none;
        }

        .pq-toast {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          background: #0f172a;
          color: #ffffff;
          padding: 10px 18px;
          border-radius: 12px;
          font-size: 0.9rem;
          font-weight: 600;
          box-shadow: 0 10px 25px rgba(15, 23, 42, 0.22);
          z-index: 50;
        }

        /* ТЕЛЕФОНҒА АРНАЛҒАН БЕЙІМДЕЛГЕН ДИЗАЙН (Mobile-First) */
        @media (max-width: 767px) {
          .pq-wrapper {
            padding: 14px 12px 24px;
          }
          .pq-brand {
            font-size: 1.3rem;
            margin-bottom: 14px;
          }
          .pq-main {
            align-items: flex-start;
          }
          .pq-lobby-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .pq-card {
            padding: 18px;
            border-radius: 18px;
          }
          .pq-icon-badge {
            width: 42px;
            height: 42px;
            border-radius: 12px;
            margin-bottom: 12px;
          }
          .pq-title {
            font-size: 1.25rem;
          }
          .pq-share-wrap {
            margin-top: 16px;
            padding-top: 14px;
          }

          /* Тест тапсыру беті (Телефон) */
          .pq-stage-container {
            gap: 12px;
          }
          .pq-topbar {
            padding: 12px 14px;
            border-radius: 14px;
          }
          .pq-question-box {
            padding: 20px 16px;
            border-radius: 16px;
            text-align: left;
          }
          .pq-q-text {
            font-size: 1.1rem;
            line-height: 1.42;
          }
          .pq-options-grid.cols-2,
          .pq-options-grid.cols-3,
          .pq-options-grid.cols-4,
          .pq-options-grid.cols-5 {
            grid-template-columns: 1fr;
            gap: 10px;
          }
          .pq-opt-card {
            flex-direction: row;
            justify-content: flex-start;
            text-align: left;
            min-height: 58px;
            padding: 14px 14px 14px 12px;
            border-radius: 14px;
            gap: 12px;
            font-size: 0.96rem;
          }
          .pq-opt-card:hover {
            transform: none;
          }
          .pq-opt-num,
          .pq-opt-check,
          .pq-status-badge {
            position: static;
            width: 28px;
            height: 28px;
            border-radius: 8px;
            flex-shrink: 0;
            font-size: 0.88rem;
          }
          .pq-multi-submit-wrap {
            position: sticky;
            bottom: 10px;
            background: rgba(243, 245, 249, 0.9);
            backdrop-filter: blur(6px);
            padding-top: 6px;
          }
          .pq-btn-submit-multi {
            width: 100%;
            padding: 14px 18px;
          }
        }

        /* Нәтиже беті */
        .pq-result-container {
          width: 100%;
          max-width: 720px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .pq-result-actions {
          display: flex;
          gap: 12px;
          margin-top: 20px;
        }
        .pq-accuracy-track {
          width: 100%;
          height: 14px;
          background: #fee2e2;
          border-radius: 999px;
          overflow: hidden;
          position: relative;
        }
        .pq-accuracy-fill {
          height: 100%;
          background: #10b981;
          border-radius: 999px;
          transition: width 0.4s ease;
        }
        .pq-stat-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 12px;
        }
        .pq-stat-pill {
          padding: 7px 14px;
          border-radius: 10px;
          font-size: 0.88rem;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .pq-stat-correct { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
        .pq-stat-wrong { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
        .pq-stat-total { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
        .pq-review-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }
        .pq-q-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 12px;
        }
        @media (max-width: 767px) {
          .pq-result-actions {
            flex-direction: column;
          }
        }
      `}</style>

      <div className="pq-brand">eQuiz</div>

      <div className="pq-main">
        {step === 'loading' && (
          <div className="pq-card pq-single-card" style={{ textAlign: 'center', color: '#64748b' }}>
            Тест жүктелуде...
          </div>
        )}

        {step === 'error' && (
          <div className="pq-card pq-single-card" style={{ textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 10px 0', color: '#dc2626' }}>Қолжетімсіз</h2>
            <p style={{ margin: 0, color: '#475569' }}>{errorText}</p>
          </div>
        )}

        {/* 1-ҚАДАМ: ЛОББИ (2-бағаналы Desktop + Бейімделген Mobile) */}
        {step === 'intro' && quizInfo && (
          <div className="pq-lobby-grid">
            <div className="pq-card pq-lobby-left">
              <div>
                <div className="pq-icon-badge" aria-hidden="true">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                    <polyline points="2 17 12 22 22 17" />
                    <polyline points="2 12 12 17 22 12" />
                  </svg>
                </div>

                <h1 className="pq-title">{quizInfo.title}</h1>
                {quizInfo.description && <p className="pq-desc">{quizInfo.description}</p>}

                <div className="pq-meta-pills">
                  <span className="pq-pill">{quizInfo.question_count} сұрақ</span>
                  {quizInfo.time_limit_sec && (
                    <span className="pq-pill">
                      Уақыт: {Math.ceil(quizInfo.time_limit_sec / 60)} мин
                    </span>
                  )}
                </div>
              </div>

              <div className="pq-share-wrap">
                <button type="button" className="pq-btn-share" onClick={handleShare}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                  <span>Бөлісу</span>
                </button>
              </div>
            </div>

            <div className="pq-card pq-lobby-right">
              {!quizInfo.is_active ? (
                <div style={{ padding: 14, background: '#fef2f2', color: '#b91c1c', borderRadius: 12, fontWeight: 600 }}>
                  Бұл тестке қабылдау уақытша жабылған.
                </div>
              ) : (
                <form onSubmit={handleStart}>
                  <label htmlFor="participantName" className="pq-label">
                    Атыңызды енгізіңіз
                  </label>
                  <input
                    id="participantName"
                    type="text"
                    required
                    maxLength={100}
                    className="pq-input"
                    placeholder="Мысалы: Әлихан"
                    value={participantName}
                    onChange={(e) => setParticipantName(e.target.value)}
                    autoFocus
                  />

                  {errorText && (
                    <div style={{ color: '#dc2626', fontSize: '0.88rem', marginBottom: 12 }}>
                      {errorText}
                    </div>
                  )}

                  <div className="pq-actions">
                    <button
                      type="submit"
                      className="pq-btn-start"
                      disabled={starting || !participantName.trim()}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                      <span>{starting ? 'Басталуда...' : 'Тестті бастау'}</span>
                    </button>

                    <button
                      type="button"
                      className="pq-btn-cards"
                      disabled={cardsLoading}
                      onClick={handleOpenFlashcards}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      <span>{cardsLoading ? 'Жүктелуде...' : 'Карточкалар'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* КАРТОЧКАЛАР РЕЖИМІ */}
        {step === 'flashcards' && flashcards.length > 0 && (
          <div className="pq-single-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontWeight: 700, color: '#475569', fontSize: '0.92rem' }}>
                {cardIndex + 1} / {flashcards.length} карточка
              </span>
              <button
                type="button"
                onClick={() => setStep('intro')}
                style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 600, cursor: 'pointer', fontSize: '0.92rem' }}
              >
                ← Лоббиге оралу
              </button>
            </div>

            <div
              className="pq-card"
              onClick={() => setIsFlipped((prev) => !prev)}
              style={{
                minHeight: 220,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                cursor: 'pointer',
                background: isFlipped ? '#eff6ff' : '#ffffff',
                borderColor: isFlipped ? '#bfdbfe' : '#e2e8f0',
              }}
            >
              <span className="pq-pill" style={{ marginBottom: 14 }}>
                {isFlipped ? 'Дұрыс жауап' : 'Сұрақ'}
              </span>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: isFlipped ? '#1e3a8a' : '#0f172a' }}>
                {isFlipped ? flashcards[cardIndex].answer : flashcards[cardIndex].question}
              </div>
              <span style={{ marginTop: 18, fontSize: '0.8rem', color: '#64748b' }}>
                Аудару үшін басыңыз
              </span>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
              <button
                type="button"
                className="pq-btn-cards"
                onClick={() => {
                  setIsFlipped(false);
                  setCardIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
                }}
              >
                Алдыңғы
              </button>
              <button
                type="button"
                className="pq-btn-start"
                onClick={() => {
                  setIsFlipped(false);
                  setCardIndex((prev) => (prev + 1) % flashcards.length);
                }}
              >
                Келесі
              </button>
            </div>
          </div>
        )}

        {/* 2-ҚАДАМ: ТЕСТ ТАПСЫРУ (Бір экранда 1 сұрақ + Бағаналы карточкалар) */}
        {step === 'testing' && session && currentItem && (
          <div className="pq-stage-container">
            <div className="pq-topbar">
              <div className="pq-topbar-row">
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.98rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {session.title}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 2 }}>
                    <strong>{session.participant_name}</strong> • Жауап берілді: {answeredCount} / {totalQuestions}
                  </div>
                </div>

                {secondsLeft !== null && (
                  <div className={`pq-timer ${secondsLeft <= 30 ? 'danger' : ''}`}>
                    {formatTimer(secondsLeft)}
                  </div>
                )}
              </div>

              <div className="pq-progress-track">
                <div
                  className="pq-progress-fill"
                  style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
                />
              </div>
            </div>

            {/* Ағымдағы 1 сұрақ */}
            <div className="pq-question-box">
              <span className="pq-q-counter">
                {currentQuestionIndex + 1} / {totalQuestions}
              </span>
              <h2 className="pq-q-text">{currentItem.payload.question}</h2>
              {currentItem.payload.is_multi && (
                <div className="pq-multi-hint">
                  Бірнеше дұрыс жауапты таңдаңыз
                </div>
              )}
            </div>

            {/* Бағаналы жауап карточкалары (Desktop: cols-2..5 | Mobile: 1 бағана) */}
            {(() => {
              const optionEntries = Object.entries(currentItem.payload.options);
              const colCount = Math.min(Math.max(optionEntries.length, 2), 5);
              const picked = answers[currentItem.id] || [];

              return (
                <>
                  <div className={`pq-options-grid cols-${colCount}`}>
                    {optionEntries.map(([key, text], optIdx) => {
                      const isSelected = picked.includes(key);
                      let revealClass = '';
                      let statusSymbol: string | null = null;
                      if (feedbackState) {
                        const hasKey = feedbackState.correctKeys.length > 0;
                        const isRight = feedbackState.correctKeys.includes(key);
                        const wasPicked = feedbackState.selectedKeys.includes(key);

                        if (!hasKey) {
                          revealClass = wasPicked ? '' : 'reveal-dim';
                        } else if (isRight) {
                          revealClass = 'reveal-correct';
                        } else if (wasPicked) {
                          revealClass = 'reveal-wrong';
                        } else {
                          revealClass = 'reveal-dim';
                        }

                        if (hasKey && currentItem.payload.is_multi) {
                          if (wasPicked) {
                            statusSymbol = '✓';
                          } else if (isRight) {
                            statusSymbol = '−';
                          }
                        }
                      }
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`pq-opt-card ${isSelected ? 'selected' : ''} ${revealClass}`}
                          onClick={() => toggleOption(currentItem.id, key, currentItem.payload.is_multi)}
                        >
                          {statusSymbol && (
                            <span className="pq-status-badge" aria-hidden="true">{statusSymbol}</span>
                          )}
                          {!feedbackState && (
                            currentItem.payload.is_multi ? (
                              <span className="pq-opt-check" aria-hidden="true">
                                {isSelected && (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                )}
                              </span>
                            ) : (
                              <span className="pq-opt-num">{optIdx + 1}</span>
                            )
                          )}
                          <span>{text}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Көп жауапты сұрақта ғана «Жіберу» батырмасы шығады */}
                  {currentItem.payload.is_multi && !feedbackState && (
                    <div className="pq-multi-submit-wrap">
                      <button
                        type="button"
                        className="pq-btn-submit-multi"
                        disabled={picked.length === 0 || submitting}
                        onClick={handleMultiSubmit}
                      >
                        {submitting ? 'Тексерілуде...' : 'Жіберу'}
                      </button>
                    </div>
                  )}
                </>
              );
            })()}

            {errorText && (
              <div style={{ color: '#dc2626', textAlign: 'center', fontSize: '0.9rem' }}>
                {errorText}
              </div>
            )}
          </div>
        )}

        {/* 3-ҚАДАМ: НӘТИЖЕ БЕТІ */}
        {step === 'result' && result && (() => {
          const totalCount = result.details.length;
          const correctCount = result.details.filter((d) => d.is_correct).length;
          const wrongCount = totalCount - correctCount;
          const score = result.score ?? 0;
          const maxScore = result.max_score ?? 0;
          const accuracyPct = maxScore > 0
            ? Math.round((score / maxScore) * 100)
            : 0;

          const handleRetry = () => {
            setAnswers({});
            setResult(null);
            setSession(null);
            setCurrentQuestionIndex(0);
            setLockedSingle(false);
            setStep('intro');
          };

          const handleStudyFromResult = () => {
            const derivedCards: FlashcardItem[] = result.details.map((q) => ({
              id: q.item_id,
              question: q.question,
              answer: q.correct_keys.map((k) => q.options[k]).filter(Boolean).join(', '),
            }));
            if (derivedCards.length > 0) {
              setFlashcards(derivedCards);
              setCardIndex(0);
              setIsFlipped(false);
              setStep('flashcards');
            }
          };

          return (
            <div className="pq-result-container">
              {/* Негізгі нәтиже карточкасы */}
              <div className="pq-card">
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                  {quizInfo?.title || session?.title || 'Тест нәтижесі'}
                </div>
                <h2 style={{ margin: '0 0 18px 0', fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
                  Жарайсыз, {result.participant_name}!
                </h2>

                <div style={{ display: 'flex', gap: 32, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#2563eb', lineHeight: 1 }}>
                      {score} <span style={{ fontSize: '1.1rem', color: '#64748b', fontWeight: 600 }}>/ {maxScore}</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 4 }}>Ұпай</div>
                  </div>
                  <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: 24 }}>
                    <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
                      {accuracyPct}%
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 4 }}>Дәлдік</div>
                  </div>
                </div>

                <div className="pq-result-actions">
                  <button type="button" className="pq-btn-start" onClick={handleRetry}>
                    Қайта тапсыру
                  </button>
                  <button type="button" className="pq-btn-cards" onClick={handleStudyFromResult}>
                    Карточкалар
                  </button>
                </div>
              </div>

              {/* Дәлдік жолағы */}
              <div className="pq-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Дәлдік</span>
                  <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#047857' }}>{accuracyPct}%</span>
                </div>
                <div className="pq-accuracy-track">
                  <div className="pq-accuracy-fill" style={{ width: `${accuracyPct}%` }} />
                </div>
              </div>

              {/* Статистика */}
              <div className="pq-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Нәтиже статистикасы</span>
                  <span style={{ fontSize: '0.84rem', color: '#64748b', fontWeight: 600 }}>{totalCount} сұрақ</span>
                </div>
                <div className="pq-stat-pills">
                  <span className="pq-stat-pill pq-stat-correct">✓ {correctCount} Дұрыс</span>
                  <span className="pq-stat-pill pq-stat-wrong">✕ {wrongCount} Қате</span>
                  <span className="pq-stat-pill pq-stat-total">{totalCount} Барлығы</span>
                </div>
              </div>

              {/* Сұрақтарға шолу */}
              <div className="pq-card">
                <div className="pq-review-header">
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>Сұрақтарға шолу</div>
                    <div style={{ fontSize: '0.84rem', color: '#64748b' }}>Дұрыс және қате жауаптарды тексеріңіз</div>
                  </div>
                  <button
                    type="button"
                    className="pq-btn-cards"
                    style={{ width: 'auto', padding: '9px 16px', fontSize: '0.88rem' }}
                    onClick={handleStudyFromResult}
                  >
                    Карточкалармен оқу
                  </button>
                </div>

                {result.details.map((q, idx) => (
                  <div
                    key={q.item_id}
                    className="pq-q-card"
                    style={{ borderLeft: `4px solid ${q.is_correct ? '#10b981' : '#ef4444'}`, marginBottom: idx === result.details.length - 1 ? 0 : 12 }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 8, fontSize: '0.98rem' }}>
                      {idx + 1}. {q.question}
                    </div>
                    {Object.entries(q.options).map(([key, text]) => {
                      const isRight = q.correct_keys.includes(key);
                      const isPicked = q.selected_keys.includes(key);
                      let bg = '#ffffff';
                      let border = '#e2e8f0';
                      if (isRight) {
                        bg = '#ecfdf5';
                        border = '#6ee7b7';
                      } else if (isPicked) {
                        bg = '#fef2f2';
                        border = '#fca5a5';
                      }
                      return (
                        <div
                          key={key}
                          style={{
                            padding: '9px 12px',
                            borderRadius: 10,
                            border: `1px solid ${border}`,
                            background: bg,
                            marginTop: 6,
                            fontSize: '0.92rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <span><strong>{key})</strong> {text}</span>
                          {isRight && <span style={{ color: '#047857', fontWeight: 700 }}>✓</span>}
                          {!isRight && isPicked && <span style={{ color: '#b91c1c', fontWeight: 700 }}>✕</span>}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {feedbackState && (
        <div
          className={`pq-feedback-banner ${
            feedbackState.isCorrect === true
              ? 'is-correct'
              : feedbackState.isCorrect === false
              ? 'is-wrong'
              : 'is-neutral'
          }`}
        >
          {feedbackState.isCorrect === true && '✓ Дұрыс!'}
          {feedbackState.isCorrect === false && '✕ Қате'}
          {feedbackState.isCorrect === null && '✓ Жауап қабылданды'}
        </div>
      )}
      {toastText && <div className="pq-toast">{toastText}</div>}
    </div>
  );
};

export default PublicQuiz;