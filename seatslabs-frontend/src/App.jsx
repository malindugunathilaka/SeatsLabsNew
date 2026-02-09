import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import AdSidebar from './components/AdSidebar';
import Home from './pages/Home';
import Services from './pages/Services';
import Booking from './pages/Booking';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login';
import MyBookings from './pages/MyBookings';
import MyVehicles from './pages/MyVehicles';
import SignUp from './pages/SignUp';
import Reports from './pages/Reports';
import api from './services/api';
import './styles/App.css';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [services, setServices] = useState([]);
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchServices = async () => {
    try {
      const response = await api.services.getAll();
      const mappedServices = response.data.data.map(s => ({
        id: s.service_id,
        name: s.service_name,
        description: s.service_description,
        price: parseFloat(s.base_price),
        duration: `${s.duration_minutes} mins`
      }));
      setServices(mappedServices);
    } catch (error) {
      console.error("Failed to fetch services:", error);
    }
  };

  const fetchAds = async () => {
    try {
      const response = await api.ads.getActiveAds();
      const mappedAds = response.data.data.map(ad => ({
        id: ad.advertisementId,
        title: ad.advertisementTitle,
        content: ad.advertisementContent
      }));
      setAds(mappedAds.length > 0 ? mappedAds : [
        { id: 1, title: 'Winter Promo', content: 'Get 10% off on all winter checks!' },
        { id: 2, title: 'New Tires?', content: 'Buy 3 get 1 free on select brands.' }
      ]);
    } catch (error) {
      console.error("Failed to fetch ads:", error);
      setAds([
        { id: 1, title: 'Winter Promo', content: 'Get 10% off on all winter checks!' },
        { id: 2, title: 'New Tires?', content: 'Buy 3 get 1 free on select brands.' }
      ]);
    }
  };

  const handleLogin = (user) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    api.auth.logout();
    setCurrentUser(null);
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
    setLoading(true);
    Promise.all([fetchServices(), fetchAds()]).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="app-loading">Loading SeatsLabs...</div>;

  return (
    <BrowserRouter>
      <div className="app">
        <Navbar user={currentUser} onLogout={handleLogout} />
        <div className="content-wrapper">
          <AdSidebar position="left" ads={ads} />

          <main className="main-content">
            <div className="container">
              <Routes>
                <Route path="/" element={<Home services={services} />} />
                <Route path="/services" element={<Services services={services} />} />
                <Route path="/booking" element={<Booking services={services} />} />
                <Route path="/admin" element={<AdminDashboard currentUser={currentUser} />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/my-bookings" element={<MyBookings currentUser={currentUser} />} />
                <Route path="/my-vehicles" element={<MyVehicles />} />
                <Route path="/login" element={<Login onLogin={handleLogin} />} />
                <Route path="/signup" element={<SignUp />} />
              </Routes>
            </div>
          </main>

          <AdSidebar position="right" ads={ads} />
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
