import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

const Navigation = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const goBack = () => {
    navigate(-1);
  };

  const goHome = () => {
    navigate('/');
  };

  const isHomePage = location.pathname === '/';

  return (
    <nav className="navigation">
      <div className="nav-controls">
        <div className="left-controls">
          {!isHomePage && (
            <button onClick={goBack} className="back-button">
              ← Back
            </button>
          )}
          
          {!isHomePage && (
            <button onClick={goHome} className="home-button">
              🏠 Home
            </button>
          )}
        </div>
        
        <button onClick={toggleMenu} className="menu-button">
          ☰
        </button>
      </div>
      
      <div className={`menu ${menuOpen ? 'open' : ''}`}>
        <div className="menu-content">
          <button onClick={toggleMenu} className="close-button">
            ✕
          </button>
          <ul>
            <li>
              <Link to="/" onClick={toggleMenu}>Dashboard</Link>
            </li>
            <li>
              <Link to="/portfolio" onClick={toggleMenu}>Portfolio</Link>
            </li>
            <li>
              <Link to="/automated-investing" onClick={toggleMenu}>Automated Investing</Link>
            </li>
            <li>
              <Link to="/detailed-view" onClick={toggleMenu}>Detailed View</Link>
            </li>
            <li>
              <Link to="/search" onClick={toggleMenu}>Search</Link>
            </li>
            <li>
              <Link to="/performance" onClick={toggleMenu}>Performance</Link>
            </li>
            <li>
              <Link to="/login" onClick={toggleMenu}>Login</Link>
            </li>
            <li>
              <Link to="/settings" onClick={toggleMenu}>Settings</Link>
            </li>
            <li>
              <Link to="/notifications" onClick={toggleMenu}>Notifications</Link>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;