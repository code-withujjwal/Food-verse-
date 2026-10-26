import { useEffect, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import Dashboard from './pages/Dashboard.jsx';
import FoodScanner from './pages/FoodScanner.jsx';
import FreshnessChecker from './pages/FreshnessChecker.jsx';
import KitchenAnalyzer from './pages/KitchenAnalyzer.jsx';
import CookingAssistant from './pages/CookingAssistant.jsx';
import MealPlanner from './pages/MealPlanner.jsx';

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className="app">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="main">
        <Header onMenu={() => setMenuOpen(true)} />
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/scanner" element={<FoodScanner />} />
            <Route path="/freshness" element={<FreshnessChecker />} />
            <Route path="/kitchen" element={<KitchenAnalyzer />} />
            <Route path="/cooking" element={<CookingAssistant />} />
            <Route path="/planner" element={<MealPlanner />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </main>
        <footer className="footer">
          <span>Food Verse AI · Multimodal Food Intelligence Agent</span>
          <span>Built for the NASSCOM SmartBridge program with React, Flask and Google Gemini.</span>
        </footer>
      </div>
    </div>
  );
}
