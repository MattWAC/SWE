import { Link } from 'react-router-dom';

const Portfolio = () => {
  return (
    <div className="page">
      <h1>Portfolio</h1>
      <p>Your portfolio information will be displayed here.</p>
      
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
    </div>
  );
};

export default Portfolio;