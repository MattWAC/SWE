import { Link } from 'react-router-dom';

const Dashboard = () => {
  return (
    <div className="dashboard-page">
      <h1>Dashboard</h1>
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