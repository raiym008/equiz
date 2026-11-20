import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Results from './pages/Results';
import Settings from './pages/Settings';
import UploadTest from './pages/UploadTest';
import EditTest from './pages/EditTest';
import Quiz from './pages/Quiz';
import Result from './pages/Result';
import Flashcards from './pages/Flashcards';
import SharedTests from './pages/share/SharedTests';
import PublicQuiz from './pages/share/PublicQuiz';
import './App.css';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Мұғалім / Әкімші беттері */}
        <Route path="/" element={<Home />} />
        <Route path="/shared-tests" element={<SharedTests />} />
        <Route path="/results" element={<Results />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/upload" element={<UploadTest />} />
        <Route path="/edit/:id" element={<EditTest />} />
        <Route path="/flashcards/:id" element={<Flashcards />} />
        <Route path="/quiz/:id" element={<Quiz />} />
        <Route path="/result/:resultId" element={<Result />} />

        {/* Қатысушылардың арнайы сілтеме арқылы кіретін беті */}
        <Route path="/q/:shareCode" element={<PublicQuiz />} />
      </Routes>
    </Router>
  );
};

export default App;