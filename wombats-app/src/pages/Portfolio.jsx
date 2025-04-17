import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../contexts/firebase';
import { collection, getDocs, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Portfolio = () => {
  const [portfolio, setPortfolio] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userMoney, setUserMoney] = useState(0);
  const [showSellModal, setShowSellModal] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [sellQuantity, setSellQuantity] = useState(1);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [transactionError, setTransactionError] = useState('');
  const [transactionSuccess, setTransactionSuccess] = useState(false);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState(0);

  // Finnhub API key from Search.jsx
  const FINNHUB_API_KEY = 'cvh3fupr01qi76d6bic0cvh3fupr01qi76d6bicg';

  useEffect(() => {
    if (auth.currentUser) {
      fetchPortfolio();
      fetchUserMoney();
    } else {
      setLoading(false);
      setError('Please log in to view your portfolio');
    }
  }, [auth.currentUser]);

  // Fetch user's money
  const fetchUserMoney = async () => {
    try {
      const userDocRef = doc(db, `users/${auth.currentUser.uid}`);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        setUserMoney(userDoc.data().Money || 0);
      } else {
        setUserMoney(0);
      }
    } catch (error) {
      console.error('Error fetching user money:', error);
      setUserMoney(0);
    }
  };

  // Fetch portfolio from transactions
  const fetchPortfolio = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Get user's transactions
      const transactionsCollection = collection(db, `users/${auth.currentUser.uid}/transactions`);
      const transactionsSnapshot = await getDocs(transactionsCollection);
      
      if (transactionsSnapshot.empty) {
        setPortfolio([]);
        setLoading(false);
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
      
      // Calculate total portfolio value
      const portfolioTotal = updatedHoldings.reduce((total, holding) => {
        return total + (holding.currentValue || 0);
      }, 0);
      
      setTotalPortfolioValue(portfolioTotal);
      setPortfolio(updatedHoldings);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      setError('Failed to load portfolio. Please try again.');
      setLoading(false);
    }
  };

  // Handle sell button click
  const handleSellClick = (stock) => {
    setSelectedStock(stock);
    setSellQuantity(1);
    setTransactionError('');
    setTransactionSuccess(false);
    setShowSellModal(true);
  };

  // Handle sell modal close
  const handleCloseSellModal = () => {
    setShowSellModal(false);
  };

  // Handle sell transaction
  const handleSellTransaction = async (e) => {
    e.preventDefault();
    
    if (!auth.currentUser) {
      setTransactionError('You must be logged in to make transactions');
      return;
    }

    if (sellQuantity <= 0) {
      setTransactionError('Quantity must be greater than zero');
      return;
    }

    if (sellQuantity > selectedStock.totalQuantity) {
      setTransactionError(`You only have ${selectedStock.totalQuantity} shares to sell`);
      return;
    }

    setTransactionLoading(true);
    setTransactionError('');
    
    try {
      // Calculate total sale value
      const quantityNum = parseInt(sellQuantity);
      const stockPrice = selectedStock.currentPrice;
      const totalValue = stockPrice * quantityNum;
      
      // Create transaction object with negative quantity (for selling)
      const transaction = {
        timestamp: new Date().toISOString(),
        stock: selectedStock.symbol,
        quantity: -quantityNum, // Negative for selling
        stock_price: stockPrice,
        total_cost: -totalValue // Negative for money received
      };
      
      // Update user's money (add the sale value)
      const userDocRef = doc(db, `users/${auth.currentUser.uid}`);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const currentMoney = userDoc.data().Money || 0;
        const newMoney = currentMoney + totalValue;
        
        await updateDoc(userDocRef, {
          Money: newMoney
        });
        
        // Update local state
        setUserMoney(newMoney);
      }
      
      // Add transaction to user's transaction history
      await addDoc(collection(db, `users/${auth.currentUser.uid}/transactions`), transaction);
      
      // Show success message
      setTransactionSuccess(true);
      setSellQuantity(1);
      
      // Refresh portfolio after short delay
      setTimeout(() => {
        fetchPortfolio();
        setShowSellModal(false);
        setTransactionSuccess(false);
      }, 2000);
    } catch (error) {
      console.error('Transaction error:', error);
      setTransactionError(`Error: ${error.message}`);
    } finally {
      setTransactionLoading(false);
    }
  };

  return (
    <div className="page">
      <h1>Portfolio</h1>
      
      {auth.currentUser ? (
        <>
          <div className="portfolio-summary">
            <div className="portfolio-balance">
              <h2>Account Summary</h2>
              <div className="balance-row">
                <span>Cash Balance:</span>
                <span className="balance-amount">${userMoney.toFixed(2)}</span>
              </div>
              <div className="balance-row">
                <span>Portfolio Value:</span>
                <span className="balance-amount">${totalPortfolioValue.toFixed(2)}</span>
              </div>
              <div className="balance-row total">
                <span>Total Value:</span>
                <span className="balance-amount">${(userMoney + totalPortfolioValue).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading">Loading your portfolio...</div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : portfolio.length > 0 ? (
            <div className="portfolio-holdings">
              <h2>Your Holdings</h2>
              <div className="holdings-table">
                <div className="holdings-header">
                  <div className="holding-cell">Symbol</div>
                  <div className="holding-cell">Quantity</div>
                  <div className="holding-cell">Avg. Cost</div>
                  <div className="holding-cell">Current Price</div>
                  <div className="holding-cell">Current Value</div>
                  <div className="holding-cell">Profit/Loss</div>
                  <div className="holding-cell">Actions</div>
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
                    <div className="holding-cell actions">
                      <button 
                        className="sell-button"
                        onClick={() => handleSellClick(holding)}
                      >
                        Sell
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="no-holdings">
              <p>You don't have any stocks in your portfolio yet.</p>
              <Link to="/search" className="nav-button">
                Search for Stocks
              </Link>
            </div>
          )}
          
          <div className="portfolio-navigation">
            <Link to="/automated-investing" className="nav-button">
              Automated Investing
            </Link>
            <Link to="/detailed-view" className="nav-button">
              Detailed View
            </Link>
            <Link to="/performance" className="nav-button">
              Performance
            </Link>
          </div>
        </>
      ) : (
        <div className="not-logged-in">
          <p>Please log in to view your portfolio.</p>
          <Link to="/login" className="nav-button">
            Go to Login
          </Link>
        </div>
      )}

      {/* Sell Modal */}
      {selectedStock && showSellModal && (
        <div className="stock-modal-overlay" onClick={handleCloseSellModal}>
          <div className="sell-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Sell {selectedStock.symbol}</h2>
              <button className="modal-close-btn" onClick={handleCloseSellModal}>×</button>
            </div>
            <div className="modal-content">
              {transactionSuccess ? (
                <div className="transaction-success">
                  <p>Transaction successful!</p>
                </div>
              ) : (
                <form onSubmit={handleSellTransaction}>
                  <div className="sell-details">
                    <p>Current Holdings: {selectedStock.totalQuantity} shares</p>
                    <p>Average Cost: ${selectedStock.averageCost.toFixed(2)}</p>
                    <p>Current Price: ${selectedStock.currentPrice.toFixed(2)}</p>
                    <div className="quantity-input">
                      <label htmlFor="quantity">Quantity to Sell:</label>
                      <input
                        id="quantity"
                        type="number"
                        min="1"
                        max={selectedStock.totalQuantity}
                        value={sellQuantity}
                        onChange={(e) => setSellQuantity(e.target.value)}
                        required
                      />
                    </div>
                    <div className="total-value">
                      <p>Total Value: ${(selectedStock.currentPrice * sellQuantity).toFixed(2)}</p>
                    </div>
                  </div>
                  
                  {transactionError && (
                    <div className="transaction-error">
                      <p>{transactionError}</p>
                    </div>
                  )}
                  
                  <div className="transaction-actions">
                    <button 
                      type="submit" 
                      className="transaction-button" 
                      disabled={
                        transactionLoading || 
                        sellQuantity <= 0 ||
                        sellQuantity > selectedStock.totalQuantity
                      }
                    >
                      {transactionLoading ? 'Processing...' : 'Sell Shares'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Portfolio;