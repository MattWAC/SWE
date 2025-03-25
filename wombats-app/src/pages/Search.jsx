import { useState, useEffect } from 'react';

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
    const data = await response.json();
    resolve({ response, data });
  } catch (error) {
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
        
        if (companyResponse.response.ok) {
          companyData = companyResponse.data;
        }
      } catch (companyErr) {
        console.warn(`Company data fetch failed for ${symbol}:`, companyErr);
        // Continue with empty company data
      }
      
      // Create price data object
      const priceDataObj = {
        price: quoteData.c,  // Current price
        previousClose: quoteData.pc, // Previous close price
        change: quoteData.c - quoteData.pc, // Calculate change
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
      newPriceData[symbol] = { error: 'Failed to fetch price data' };
      setPriceData(prevData => ({
        ...prevData,
        [symbol]: { error: 'Failed to fetch price data' }
      }));
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
      <h1>Stock Search</h1>
      
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
              <li key={index} className="result-item">
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
    </div>
  );
};

export default Search;