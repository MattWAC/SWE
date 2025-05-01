import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { useState, useEffect } from 'react';
import { auth, db, onAuthStateChanged } from '../contexts/firebase';


const Dashboard = () => {

  const [portfolio, setPortfolio] = useState([]);
  const [LoadingProfolio,setLoadingPortfolio] = useState(false);
  const FINNHUB_API_KEY = 'cvh3fupr01qi76d6bic0cvh3fupr01qi76d6bicg';
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return; // Avoid running before auth is settled
    if (user) {
      fetchPortfolio();
    } else {
      setLoadingPortfolio(false);
    }
  }, [loading, user]);

  // Fetch portfolio from transactions
  const fetchPortfolio = async () => {
    setLoadingPortfolio(true);
    
    try {
      // Get user's transactions
      const transactionsCollection = collection(db, `users/${auth.currentUser.uid}/transactions`);
      const transactionsSnapshot = await getDocs(transactionsCollection);
      
      if (transactionsSnapshot.empty) {
        setPortfolio([]);
        setLoadingPortfolio(false);
        return;
      }
      
      // Get transactions and sort them by timestamp
      const transactions = [];
      transactionsSnapshot.forEach(doc => {
        transactions.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      // Sort transactions by timestamp (oldest first)
      transactions.sort((a, b) => {
        return new Date(a.timestamp) - new Date(b.timestamp);
      });
      
      // Process transactions to calculate holdings (using FIFO method)
      const holdings = {};
      
      for (const transaction of transactions) {
        const { stock, quantity, stock_price, timestamp } = transaction;
        
        if (!holdings[stock]) {
          holdings[stock] = {
            symbol: stock,
            totalQuantity: 0,
            totalCost: 0,
            positionStartDate: timestamp,
            transactions: []
          };
        }
        
        // If position was previously liquidated completely, reset the basis
        if (holdings[stock].totalQuantity === 0 && quantity > 0) {
          holdings[stock].totalCost = 0;
          holdings[stock].positionStartDate = timestamp;
        }
        
        // For buys (positive quantity)
        if (quantity > 0) {
          holdings[stock].totalCost += (quantity * stock_price);
          holdings[stock].totalQuantity += quantity;
        } 
        // For sells (negative quantity)
        else if (quantity < 0) {
          // Calculate how much of the original cost is being removed
          const currentAvgCost = holdings[stock].totalQuantity > 0 
            ? holdings[stock].totalCost / holdings[stock].totalQuantity 
            : 0;
          const costToRemove = Math.abs(quantity) * currentAvgCost;
          
          // Remove the proportional cost
          holdings[stock].totalCost -= costToRemove;
          holdings[stock].totalQuantity += quantity; // Add negative quantity (reduce)
        }
        
        holdings[stock].transactions.push(transaction);
      }
      
      // Filter out stocks with zero quantity
      const holdingsArray = Object.values(holdings).filter(holding => holding.totalQuantity > 0);
      
      // Fetch current prices for each holding
      const updatedHoldings = await Promise.all(
        holdingsArray.map(async (holding) => {
          try {
            const response = await fetch(
              `https://finnhub.io/api/v1/quote?symbol=${holding.symbol}&token=${FINNHUB_API_KEY}`
            );
            
            if (!response.ok) {
              throw new Error(`Failed to fetch price for ${holding.symbol}`);
            }
            
            const data = await response.json();
            
            // Add current price and value
            const currentPrice = data.c;
            const currentValue = currentPrice * holding.totalQuantity;
            const averageCost = holding.totalCost / holding.totalQuantity;
            const profitLoss = currentValue - holding.totalCost;
            const profitLossPercent = (profitLoss / holding.totalCost) * 100;
            
            return {
              ...holding,
              currentPrice,
              currentValue,
              averageCost,
              profitLoss,
              profitLossPercent
            };
          } catch (error) {
            console.error(`Error fetching price for ${holding.symbol}:`, error);
            return {
              ...holding,
              currentPrice: null,
              currentValue: null,
              error: 'Failed to fetch current price'
            };
          }
        })
      );

      // getting the top peformers
      updatedHoldings.sort((a, b) =>  b.profitLoss-a.profitLoss);
      let bestPeformers = updatedHoldings.slice(-5);


      setPortfolio(bestPeformers);
      setLoadingPortfolio(false);
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      setLoadingPortfolio(false);
    }
  };

  return (
    <div className="dashboard-page">
      <h1>Dashboard</h1>
      {LoadingProfolio ? (
            <div className="loading">Loading your portfolio...</div>
          ) : portfolio.length > 0 ? (
            <div className="portfolio-holdings">
              <h2>Your Top Holdings</h2>
              <div className="holdings-table">
                <div className="holdings-header">
                  <div className="holding-cell">Symbol</div>
                  <div className="holding-cell">Quantity</div>
                  <div className="holding-cell">Avg. Cost</div>
                  <div className="holding-cell">Current Price</div>
                  <div className="holding-cell">Current Value</div>
                  <div className="holding-cell">Profit/Loss</div>
                </div>
                
                {portfolio.map((holding) => (
                  <div key={holding.symbol} className="holding-row">
                    <div className="holding-cell symbol">{holding.symbol}</div>
                    <div className="holding-cell">{holding.totalQuantity}</div>
                    <div className="holding-cell">${holding.averageCost.toFixed(2)}</div>
                    <div className="holding-cell">
                      {holding.currentPrice ? `$${holding.currentPrice.toFixed(2)}` : 'N/A'}
                    </div>
                    <div className="holding-cell">
                      {holding.currentValue ? `$${holding.currentValue.toFixed(2)}` : 'N/A'}
                    </div>
                    <div className={`holding-cell ${holding.profitLoss >= 0 ? 'positive-change' : 'negative-change'}`}>
                      {holding.profitLoss ? (
                        <>
                          ${holding.profitLoss.toFixed(2)} ({holding.profitLossPercent.toFixed(2)}%)
                        </>
                      ) : 'N/A'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : ""}
      <div className="dashboard-grid">
        <Link to="/portfolio" className="dashboard-item">
          <h2>Portfolio</h2>
        </Link>
        
        <Link to="/search" className="dashboard-item">
          <h2>Search</h2>
        </Link>
        <Link to="/performance" className="dashboard-item">
          <h2>Performance</h2>
        </Link>
        <Link to="/login" className="dashboard-item">
          <h2>Login</h2>
        </Link>
        <Link to="/settings" className="dashboard-item">
          <h2>Settings</h2>
        </Link>
        <Link to="/notifications" className="dashboard-item">
          <h2>Notifications</h2>
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;