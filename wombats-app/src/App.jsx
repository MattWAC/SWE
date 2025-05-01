import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import './App.css';

// Pages
import Dashboard from './pages/Dashboard';
import Portfolio from './pages/Portfolio';
import Search from './pages/Search';
import Performance from './pages/Performance';
import Login from './pages/Login';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import AutomatedInvesting from './pages/AutomatedInvesting';
import DetailedView from './pages/DetailedView';

// Components
import Navigation from './components/Navigation';

// Theme
import { ThemeProvider } from './contexts/ThemeContext';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <div className="app">
          <Navigation />
          <div className="content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/search" element={<Search />} />
              <Route path="/performance" element={<Performance />} />
              <Route path="/login" element={<Login />} />
              <Route path="/settings" element={<Settings />} />
              {/* <Route path="/notifications" element={<Notifications />} /> */}
              {/* <Route path="/automated-investing" element={<AutomatedInvesting />} /> */}
              {/* <Route path="/detailed-view" element={<DetailedView />} /> */}
            </Routes>
          </div>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
