import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../contexts/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';

const Navigation = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Monitor auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchUserBalance(currentUser.uid);
      } else {
        setBalance(0);
      }
    });
    
    // Cleanup subscription
    return () => unsubscribe();
  }, []);
  
  // Fetch user balance from Firestore
  const fetchUserBalance = async (userId) => {
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists() && userDoc.data().Money !== undefined) {
        setBalance(userDoc.data().Money);
      } else {
        // Initialize money if not set
        await setDoc(userDocRef, { Money: 0 }, { merge: true });
        setBalance(0);
      }
    } catch (error) {
      console.error('Error fetching user balance:', error);
    }
  };
  
  // Add $10000 to user balance :) 
  const addMoney = async () => {
    if (!user) return;
    
    try {
      const newBalance = balance + 10000;
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, { Money: newBalance });
      setBalance(newBalance);
    } catch (error) {
      console.error('Error updating balance:', error);
    }
  };

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
  
  const handleLogout = () => {
    signOut(auth).then(() => {
      navigate('/');
    }).catch(error => {
      console.error('Logout error:', error);
    });
  };

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
              Home
            </button>
          )}
        </div>
        
        <div className="right-controls">
          {user ? (
            <div className="user-info">
              <span className="user-balance" onClick={addMoney}>${balance.toLocaleString()}</span>
              <span className="user-email">{user.email}</span>
              <button onClick={handleLogout} className="logout-button">
                Logout
              </button>
            </div>
          ) : (
            <Link to="/login" className="login-link">Login</Link>
          )}
          <button onClick={toggleMenu} className="menu-button">
            ☰
          </button>
        </div>
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
              <Link to="/login" onClick={toggleMenu}>
                {user ? 'Account' : 'Login'}
              </Link>
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