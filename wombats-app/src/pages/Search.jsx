import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { auth, db } from '../contexts/firebase';
import { addDoc, collection, getDoc, updateDoc, doc } from 'firebase/firestore';

// Helper for rate-limited API requests
const requestQueue = [];
let processingQueue = false;

const queueRequest = (url) => {
  return new Promise((resolve, reject) => {
    requestQueue.push({
      url,
      resolve,
      reject
    });
    
    if (!processingQueue) {
      processQueue();
    }
  });
};

const processQueue = async () => {
  if (requestQueue.length === 0) {
    processingQueue = false;
    return;
  }
  
  processingQueue = true;
  const { url, resolve, reject } = requestQueue.shift();
  
  try {
    // Add a delay between requests
    await new Promise(r => setTimeout(r, 300)); // 300ms delay between requests
    
    const response = await fetch(url);
    
    // Check if throttled (status 429)
    if (response.status === 429) {
      const data = await response.json();
      // Create a special throttled response object
      resolve({
        response: response,
        data: data,
        throttled: true
      });
      processQueue(); // Process next request
      return;
    }
    
    const data = await response.json();
    resolve({ response, data });
  } catch (error) {
    console.error('API request error:', error);
    reject(error);
  }
  
  // Process next request
  processQueue();
};

const Search = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [priceData, setPriceData] = useState({});
  const [loading, setLoading] = useState(false);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [error, setError] = useState('');
  const [requestsInProgress, setRequestsInProgress] = useState(0);
  const [selectedStock, setSelectedStock] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [includeWeird, setIncludeWeird] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [transactionError, setTransactionError] = useState('');
  const [transactionSuccess, setTransactionSuccess] = useState(false);
  const [userMoney, setUserMoney] = useState(0);

  // Finnhub API key
  const FINNHUB_API_KEY = 'cvh3fupr01qi76d6bic0cvh3fupr01qi76d6bicg';

  // Function to search for stock symbols/companies
  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!query.trim()) return;
    
    setLoading(true);
    setError('');
    setPriceData({});
    
    try {
      // Search stocks using Finnhub symbol lookup
      const { response, data } = await queueRequest(
        `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${FINNHUB_API_KEY}`
      );
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      if (data.result && data.result.length > 0) {
        // Filter out non-stock results and limit to 10 results
        // At some point we should probably figure out how to get rid of those weird stocks lol
        const stockResults = data.result
          .filter(item => item.type === 'Common Stock')
          .filter(item => includeWeird || !item.symbol.includes('.'))
          .slice(0, 10);
        
        setResults(stockResults);
        // Fetch price data for results
        fetchPriceData(stockResults);
      } else {
        setResults([]);
      }
    } catch (err) {
      setError(`Error searching for stocks: ${err.message}`);
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch price data for search results
  const fetchPriceData = async (searchResults) => {
    if (!searchResults.length) return;
    
    setPricesLoading(true);
    const newPriceData = {};
    setRequestsInProgress(searchResults.length);
    
    // Process each stock sequentially to avoid rate limits
    for (const item of searchResults) {
      try {
        await fetchStockData(item, newPriceData);
        setRequestsInProgress(prev => Math.max(0, prev - 1));
      } catch (err) {
        console.error(`Error processing ${item.symbol}:`, err);
        setRequestsInProgress(prev => Math.max(0, prev - 1));
      }
    }
    
    setPricesLoading(false);
  };
  
  const fetchStockData = async (item, newPriceData) => {
    const symbol = item.symbol;
    
    try {
      // Fetch quote data from Finnhub
      const quoteResponse = await queueRequest(
        `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`
      );
      
      // Check if throttled
      if (quoteResponse.throttled) {
        newPriceData[symbol] = { 
          throttled: true, 
          retryIn: 10,
          error: 'API throttled. Please wait 10 seconds before refreshing.' 
        };
        
        setPriceData(prevData => ({
          ...prevData,
          [symbol]: { 
            throttled: true, 
            retryIn: 10,
            error: 'API throttled. Please wait 10 seconds before refreshing.' 
          }
        }));
        return;
      }
      
      if (!quoteResponse.response.ok) {
        throw new Error(`Failed to fetch price for ${symbol}`);
      }
      
      const quoteData = quoteResponse.data;
      
      // Fetch company data
      let companyData = {};
      try {
        const companyResponse = await queueRequest(
          `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_API_KEY}`
        );
        
        // Handle throttled company data gracefully
        if (companyResponse.throttled) {
          companyData = { name: item.description, currency: 'USD' };
        } else if (companyResponse.response.ok) {
          companyData = companyResponse.data;
        }
      } catch (companyErr) {
        console.warn(`Company data fetch failed for ${symbol}:`, companyErr);
        // Continue with empty company data
        companyData = { name: item.description, currency: 'USD' };
      }
      
      // Create price data object
      const priceDataObj = {
        price: quoteData.c, 
        previousClose: quoteData.pc, 
        change: quoteData.c - quoteData.pc,
        changePercent: ((quoteData.c - quoteData.pc) / quoteData.pc) * 100,
        high: quoteData.h,
        low: quoteData.l,
        currency: companyData.currency || 'USD',
        companyName: companyData.name || item.description,
        industry: companyData.finnhubIndustry,
        marketCap: companyData.marketCapitalization,
        exchange: companyData.exchange
      };
      
      // Update price data state
      newPriceData[symbol] = priceDataObj;
      setPriceData(prevData => ({
        ...prevData,
        [symbol]: priceDataObj
      }));
      
    } catch (err) {
      console.error(`Error fetching data for ${symbol}:`, err);
      
      // Set error state
      newPriceData[symbol] = { error: 'Failed to fetch price data. Try again in a few seconds.' };
      setPriceData(prevData => ({
        ...prevData,
        [symbol]: { error: 'Failed to fetch price data. Try again in a few seconds.' }
      }));
    }
  };

  // Alpha Vantage API key
  const ALPHA_VANTAGE_API_KEY = 'J8EX2AQ7JU6Y9RXN'; 
  
  // Function to fetch historical price data for a stock using Alpha Vantage
  const fetchStockHistory = async (symbol) => {
    setChartLoading(true);
    setChartData([]);
    
    try {
      // Fetch intraday time series data with 5-minute intervals from Alpha Vantage
      const response = await fetch(
        `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=5min&apikey=${ALPHA_VANTAGE_API_KEY}&outputsize=full`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch historical data for ${symbol}`);
      }
      
      const data = await response.json();
      
      // Alpha Vantage returns data in a different format than Finnhub
      const timeSeries = data['Time Series (5min)'];
      
      if (timeSeries) {
        // Get the timestamps and sort them in ascending order
        const timestamps = Object.keys(timeSeries).sort();
        
        // Filter to just the last 24 hours of data
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        
        const recentData = timestamps
          .filter(timestamp => new Date(timestamp) >= oneDayAgo)
          .map(timestamp => {
            const entry = timeSeries[timestamp];
            return {
              time: new Date(timestamp),
              price: parseFloat(entry['4. close']),
              open: parseFloat(entry['1. open']),
              high: parseFloat(entry['2. high']),
              low: parseFloat(entry['3. low']),
              volume: parseFloat(entry['5. volume'])
            };
          });
        
        setChartData(recentData);
        
        if (recentData.length === 0) {
          console.warn('No recent data available for the last 24 hours');
        }
      } else {
        console.warn('No time series data available from Alpha Vantage');
        setChartData([]);
      }
    } catch (err) {
      console.error(`Error fetching historical data for ${symbol}:`, err);
      setChartData([]);
    } finally {
      setChartLoading(false);
    }
  };

  // Function to handle clicking on a stock
  const handleStockClick = (stock) => {
    setSelectedStock(stock);
    fetchStockHistory(stock.symbol);
  };
  
  // Function to close the modal
  const handleCloseModal = () => {
    setSelectedStock(null);
    setChartData([]);
  };
  
  // Format time for chart tooltips
  const formatChartTime = (time) => {
    if (!(time instanceof Date)) return '';
    return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Format date for X-axis
  const formatXAxis = (time) => {
    if (!(time instanceof Date)) return '';
    return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Handle buy button click
  const handleBuyClick = async (e) => {
    e.stopPropagation();
    setQuantity(1);
    setTransactionError('');
    setTransactionSuccess(false);
    
    // Fetch current user money if logged in
    if (auth.currentUser) {
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
    }
    
    setShowBuyModal(true);
  };

  // Handle buy modal close
  const handleCloseBuyModal = (e) => {
    if (e) e.stopPropagation();
    setShowBuyModal(false);
  };

  // Handle transaction submission
  const handleTransaction = async (e) => {
    e.preventDefault();
    
    if (!auth.currentUser) {
      setTransactionError('You must be logged in to make transactions');
      return;
    }

    if (quantity <= 0) {
      setTransactionError('Quantity must be greater than zero');
      return;
    }

    setTransactionLoading(true);
    setTransactionError('');
    
    try {
      // Calculate total cost
      const quantityNum = parseInt(quantity);
      const stockPrice = priceData[selectedStock.symbol].price;
      const totalCost = stockPrice * quantityNum;
      
      // Check if user has enough money
      if (totalCost > userMoney) {
        setTransactionError(`Insufficient funds. You have $${userMoney.toFixed(2)}, but need $${totalCost.toFixed(2)}`);
        setTransactionLoading(false);
        return;
      }
      
      // Create transaction object
      const transaction = {
        timestamp: new Date().toISOString(),
        stock: selectedStock.symbol,
        quantity: quantityNum,
        stock_price: stockPrice,
        total_cost: totalCost
      };
      
      // Get reference to user document
      const userDocRef = doc(db, `users/${auth.currentUser.uid}`);
      
      // Update user's money
      const remainingMoney = userMoney - totalCost;
      await updateDoc(userDocRef, {
        Money: remainingMoney
      });
      
      // Update local state
      setUserMoney(remainingMoney);
      
      // Add transaction to user's transaction history
      await addDoc(collection(db, `users/${auth.currentUser.uid}/transactions`), transaction);
      
      // Show success message
      setTransactionSuccess(true);
      setQuantity(1);
      
      // Close modal after short delay
      setTimeout(() => {
        setShowBuyModal(false);
        setTransactionSuccess(false);
      }, 2000);
    } catch (error) {
      console.error('Transaction error:', error);
      setTransactionError(`Error: ${error.message}`);
    } finally {
      setTransactionLoading(false);
    }
  };

  // Format price display
  const formatPrice = (symbol) => {
    const stockData = priceData[symbol];
    
    if (!stockData) return <div className="loading-price">Loading...</div>;
    if (stockData.error) return <div className="error-price">{stockData.error}</div>;
    
    const priceDisplay = stockData.price ? 
      `${stockData.price.toFixed(2)} ${stockData.currency}` : 'N/A';
      
    let changeDisplay = '';
    if (stockData.change !== undefined && stockData.changePercent !== undefined) {
      const changeClass = stockData.change >= 0 ? 'positive-change' : 'negative-change';
      const changeSign = stockData.change >= 0 ? '+' : '';
      changeDisplay = (
        <span className={changeClass}>
          {`${changeSign}${stockData.change.toFixed(2)} (${changeSign}${stockData.changePercent.toFixed(2)}%)`}
        </span>
      );
    }
    
    return (
      <div className="price-container">
        <div className="current-price">{priceDisplay}</div>
        <div className="price-change">{changeDisplay}</div>
        {stockData.high && stockData.low && (
          <div className="price-range">
            Range: {stockData.low.toFixed(2)} - {stockData.high.toFixed(2)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page">
      <div className="settings-section">
        <div className="setting-item">
          <div className="setting-label">
            <h1>Stock Search</h1>
          </div>
          <div className="setting-item-no-border">
            <span> Include all stocks? </span>
            <div className="setting-control">
              <button 
                      className={`theme-toggle ${includeWeird ? 'dark' : 'light'}`}
                      onClick={() => setIncludeWeird(!includeWeird)}
                      aria-label="Include Weird Data">
                      
                        <div className="toggle-thumb"></div>
                        <span className="toggle-text">{includeWeird ? 'on' : 'off'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSearch} className="search-form">
        <input 
          type="text" 
          value={query} 
          onChange={(e) => setQuery(e.target.value)} 
          placeholder="Enter stock ticker or company name"
          className="search-input"
        />
        <button type="submit" className="search-button">Search</button>
      </form>
      
      <div className="api-note">
        <p>Using Finnhub API for real-time stock data {requestsInProgress > 0 && `(${requestsInProgress} requests pending)`}</p>
      </div>
      
      {loading && <div className="loading">Searching...</div>}
      
      {error && <div className="error-message">{error}</div>}
      
      {results.length > 0 ? (
        <div className="search-results">
          <h2>Results</h2>
          {pricesLoading && <div className="loading">Fetching price data...</div>}
          
          <ul className="results-list">
            {results.map((item, index) => (
              <li 
                key={index} 
                className="result-item"
                onClick={() => handleStockClick(item)}
                style={{ cursor: 'pointer' }}
              >
                <div className="result-main-info">
                  <div className="result-symbol">{item.symbol}</div>
                  <div className="result-name">{item.description}</div>
                  <div className="result-details">
                    <span className="result-type">{item.type}</span>
                    {priceData[item.symbol]?.exchange && (
                      <span className="result-exchange">{priceData[item.symbol].exchange}</span>
                    )}
                    {priceData[item.symbol]?.industry && (
                      <span className="result-industry">{priceData[item.symbol].industry}</span>
                    )}
                  </div>
                </div>
                <div className="result-price">
                  {formatPrice(item.symbol)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : query && !loading && !error ? (
        <div className="no-results">No results found for "{query}"</div>
      ) : null}

      {selectedStock && (
        <div className="stock-modal-overlay" onClick={handleCloseModal}>
          <div className="stock-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedStock.symbol}: {selectedStock.description}</h2>
              <div className="modal-header-actions">
                <button className="buy-button" onClick={handleBuyClick}>Buy</button>
                <button className="modal-close-btn" onClick={handleCloseModal}>×</button>
              </div>
            </div>
            <div className="modal-content">
              <div className="modal-chart-section">
                <h3>Price Chart (Last 24 Hours)</h3>
                {chartLoading ? (
                  <div className="loading">Loading chart data...</div>
                ) : chartData.length > 0 ? (
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="time" 
                          tickFormatter={formatXAxis} 
                          minTickGap={50}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis 
                          domain={['auto', 'auto']}
                          tickFormatter={(value) => value.toFixed(2)}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip 
                          labelFormatter={formatChartTime}
                          formatter={(value) => [value.toFixed(2), "Price"]}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="price" 
                          stroke={
                            chartData.length > 1 && 
                            chartData[chartData.length - 1].price > chartData[0].price
                              ? 'var(--color-success)' 
                              : 'var(--color-error)'
                          }
                          dot={false}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="chart-note">
                      Data provided by Alpha Vantage (5-minute intervals)
                    </div>
                  </div>
                ) : (
                  <div className="no-chart-data">
                    <p>No chart data available for this stock or something broke, oops.</p>
                  </div>
                )}
              </div>
              
              <div className="modal-price-section">
                <h3>Price Information</h3>
                {priceData[selectedStock.symbol] ? (
                  <div className="modal-price-details">
                    <div className="modal-current-price">
                      <span className="price-label">Current Price:</span>
                      <span className="price-value">
                        {priceData[selectedStock.symbol].price?.toFixed(2) || 'N/A'} 
                        {priceData[selectedStock.symbol].currency}
                      </span>
                    </div>
                    
                    {priceData[selectedStock.symbol].change !== undefined && (
                      <div className="modal-price-change">
                        <span className="price-label">Change:</span>
                        <span className={priceData[selectedStock.symbol].change >= 0 ? 'positive-change' : 'negative-change'}>
                          {priceData[selectedStock.symbol].change >= 0 ? '+' : ''}
                          {priceData[selectedStock.symbol].change?.toFixed(2)} 
                          ({priceData[selectedStock.symbol].change >= 0 ? '+' : ''}
                          {priceData[selectedStock.symbol].changePercent?.toFixed(2)}%)
                        </span>
                      </div>
                    )}
                    
                    {priceData[selectedStock.symbol].previousClose !== undefined && (
                      <div className="modal-previous-close">
                        <span className="price-label">Previous Close:</span>
                        <span>{priceData[selectedStock.symbol].previousClose?.toFixed(2)}</span>
                      </div>
                    )}
                    
                    {priceData[selectedStock.symbol].high !== undefined && priceData[selectedStock.symbol].low !== undefined && (
                      <div className="modal-range">
                        <span className="price-label">Day Range:</span>
                        <span>
                          {priceData[selectedStock.symbol].low?.toFixed(2)} - 
                          {priceData[selectedStock.symbol].high?.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="loading">Loading price data...</div>
                )}
              </div>
              
              <div className="modal-company-section">
                <h3>Company Information</h3>
                <div className="modal-company-details">
                  {priceData[selectedStock.symbol]?.exchange && (
                    <div className="modal-exchange">
                      <span className="detail-label">Exchange:</span>
                      <span>{priceData[selectedStock.symbol].exchange}</span>
                    </div>
                  )}
                  
                  {priceData[selectedStock.symbol]?.industry && (
                    <div className="modal-industry">
                      <span className="detail-label">Industry:</span>
                      <span>{priceData[selectedStock.symbol].industry}</span>
                    </div>
                  )}
                  
                  {priceData[selectedStock.symbol]?.marketCap && (
                    <div className="modal-market-cap">
                      <span className="detail-label">Market Cap:</span>
                      <span>
                        ${(priceData[selectedStock.symbol].marketCap * 1000000).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Buy Modal */}
      {selectedStock && showBuyModal && (
        <div className="stock-modal-overlay" onClick={handleCloseBuyModal}>
          <div className="buy-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Buy {selectedStock.symbol}</h2>
              <button className="modal-close-btn" onClick={handleCloseBuyModal}>×</button>
            </div>
            <div className="modal-content">
              {transactionSuccess ? (
                <div className="transaction-success">
                  <p>Transaction successful!</p>
                </div>
              ) : (
                <form onSubmit={handleTransaction}>
                  <div className="buy-details">
                    <p>Your Balance: ${userMoney.toFixed(2)}</p>
                    <p>Current Price: {priceData[selectedStock.symbol].price?.toFixed(2) || 'N/A'} {priceData[selectedStock.symbol].currency}</p>
                    <div className="quantity-input">
                      <label htmlFor="quantity">Quantity:</label>
                      <input
                        id="quantity"
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        required
                      />
                    </div>
                    <div className="total-cost">
                      <p>Total Cost: {(priceData[selectedStock.symbol].price * quantity).toFixed(2) || 'N/A'} {priceData[selectedStock.symbol].currency}</p>
                      {userMoney < (priceData[selectedStock.symbol].price * quantity) && (
                        <p className="insufficient-funds">Insufficient funds</p>
                      )}
                    </div>
                  </div>
                  
                  {transactionError && (
                    <div className="transaction-error">
                      <p>{transactionError}</p>
                    </div>
                  )}
                  
                  {!auth.currentUser && (
                    <div className="login-message">
                      <p>You must be logged in to make transactions.</p>
                    </div>
                  )}
                  
                  <div className="transaction-actions">
                    <button 
                      type="submit" 
                      className="transaction-button" 
                      disabled={
                        transactionLoading || 
                        !auth.currentUser || 
                        userMoney < (priceData[selectedStock.symbol].price * quantity)
                      }
                    >
                      {transactionLoading ? 'Processing...' : 'Make Transaction'}
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

export default Search;