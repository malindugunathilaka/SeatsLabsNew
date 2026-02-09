import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import '../styles/AdminDashboard.css';

function AdminDashboard({ currentUser }) {
  const [activeTab, setActiveTab] = useState('bookings');
  const [bookings, setBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('All');
  const [payments, setPayments] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [ads, setAds] = useState([]);

  // Asset Management State
  const [brands, setBrands] = useState([]);
  const [bodyTypes, setBodyTypes] = useState([]);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [assetType, setAssetType] = useState(''); // 'brand', 'model', 'bodyType'
  const [newAsset, setNewAsset] = useState({
    name: '',
    brandId: '', // For model
  });

  // Modals
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [newService, setNewService] = useState({
    serviceCategoryId: '',
    serviceName: '',
    serviceDescription: '',
    durationMinutes: 60,
    basePrice: 0
  });

  const navigate = useNavigate();

  const isManager = currentUser?.role === 'Manager' || currentUser?.role === 'Admin';
  const isTechnician = currentUser?.role === 'Technician';

  const fetchData = async () => {
    try {
      setLoading(true);
      const [bookingsRes, servicesRes, categoriesRes, techsRes, brandsRes, bodyTypesRes, paymentsRes, campaignsRes, adsRes] = await Promise.all([
        api.bookings.getAll(),
        api.services.getAll(),
        api.services.getCategories(),
        isManager ? api.users.getTechnicians() : Promise.resolve({ data: { data: [] } }),
        isManager ? api.vehicles.getBrands() : Promise.resolve({ data: { data: [] } }),
        isManager ? api.vehicles.getBodyTypes() : Promise.resolve({ data: { data: [] } }),
        isManager ? api.payments.getAll() : Promise.resolve({ data: { data: [] } }),
        isManager ? api.ads.getAllCampaigns() : Promise.resolve({ data: { data: [] } }),
        isManager ? api.ads.getAllAds() : Promise.resolve({ data: { data: [] } })
      ]);
      setBookings(bookingsRes.data.data);
      setServices(servicesRes.data.data);
      setCategories(categoriesRes.data.data);
      setTechnicians(techsRes.data.data);
      if (isManager) {
        setBrands(brandsRes.data.data || []);
        setBodyTypes(bodyTypesRes.data.data || []);
        setPayments(paymentsRes.data.data || []);
        setCampaigns(campaignsRes.data.data || []);
        setAds(adsRes.data.data || []);
      }
    } catch (error) {
      console.error("Dashboard error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser && !isManager && !isTechnician) {
      navigate('/');
    }
    if (isManager || isTechnician) {
      fetchData();
    }
  }, [currentUser, isManager, isTechnician, navigate]);

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      await api.bookings.updateStatus(id, newStatus, 'Status updated by dashboard');
      fetchData();
    } catch (err) {
      alert('Error updating status');
    }
  };

  const handleAssignTech = async (bookingId, techId) => {
    try {
      await api.bookings.assignTechnician(bookingId, techId);
      fetchData();
      alert('Technician assigned');
    } catch (err) {
      alert('Error assigning technician');
    }
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    try {
      await api.services.create(newService);
      setShowServiceModal(false);
      fetchData();
      alert('Service added!');
    } catch (error) {
      alert('Failed to add service');
    }
  };

  const handleVerifyPayment = async (paymentId) => {
    try {
      await api.payments.verify(paymentId);
      alert('Payment verified successfully');
      fetchData();
    } catch (error) {
      alert('Failed to verify payment');
    }
  };

  const handleRefund = async (paymentId) => {
    if (!window.confirm('Are you sure you want to process this refund?')) return;
    try {
      await api.payments.refund(paymentId);
      alert('Refund processed successfully');
      fetchData();
    } catch (error) {
      alert('Failed to process refund');
    }
  };

  const handleApproveAd = async (adId) => {
    try {
      await api.ads.approveAd(adId);
      alert('Ad approved successfully');
      fetchData();
    } catch (error) {
      alert('Failed to approve ad');
    }
  };

  const handleRejectAd = async (adId) => {
    try {
      await api.ads.rejectAd(adId);
      alert('Ad rejected');
      fetchData();
    } catch (error) {
      alert('Failed to reject ad');
    }
  };

  const handleAddAsset = async (e) => {
    e.preventDefault();
    try {
      if (assetType === 'brand') {
        await api.vehicles.createBrand({ name: newAsset.name });
      } else if (assetType === 'model') {
        await api.vehicles.createModel({ brandId: newAsset.brandId, name: newAsset.name });
      } else if (assetType === 'bodyType') {
        await api.vehicles.createBodyType({ name: newAsset.name });
      }
      setShowAssetModal(false);
      setNewAsset({ name: '', brandId: '' });
      fetchData();
      alert(`${assetType} added successfully!`);
    } catch (error) {
      alert(`Failed to add ${assetType}`);
    }
  };

  const renderBookings = () => {
    const filtered = bookings.filter(b => filterStatus === 'All' || b.booking_status === filterStatus);
    return (
      <div className="tab-content">
        <div className="filters">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Customer</th>
                <th>Service</th>
                <th>Vehicle</th>
                <th>Status</th>
                <th>Assign Tech</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.booking_id}>
                  <td>{b.booking_reference}</td>
                  <td>{b.customer_first_name} {b.customer_last_name}</td>
                  <td>{b.service_name}</td>
                  <td>{b.registration_number}</td>
                  <td><span className={`status-badge status-${b.booking_status?.toLowerCase().replace(' ', '-') || 'pending'}`}>{b.booking_status}</span></td>
                  <td>
                    {isManager && b.booking_status !== 'Completed' ? (
                      <select
                        value={b.technician_id || ''}
                        onChange={(e) => handleAssignTech(b.booking_id, e.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {technicians.map(t => (
                          <option key={t.technician_id} value={t.technician_id}>{t.user_first_name}</option>
                        ))}
                      </select>
                    ) : (
                      b.tech_first_name ? b.tech_first_name : 'N/A'
                    )}
                  </td>
                  <td>
                    <select
                      value={b.booking_status}
                      onChange={(e) => handleStatusUpdate(b.booking_id, e.target.value)}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Approved">Approve</option>
                      <option value="In Progress">Start</option>
                      <option value="Completed">Complete</option>
                      <option value="Cancelled">Cancel</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderServices = () => (
    <div className="tab-content">
      <div className="section-header">
        <h3>Workshop Services</h3>
        <button className="btn btn-primary" onClick={() => setShowServiceModal(true)}>+ New Service</button>
      </div>
      <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Duration</th>
              <th>Price</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {services.length > 0 ? (
              services.map(s => (
                <tr key={s.service_id}>
                  <td>{s.service_name}</td>
                  <td>{s.service_category_name}</td>
                  <td>{s.duration_minutes}m</td>
                  <td>Rs. {parseFloat(s.base_price).toLocaleString()}</td>
                  <td>
                    <button className="btn-small" onClick={() => alert('Edit soon')}>Edit</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="text-center">No services found. Add your first service!</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (loading) return <div className="loading">Syncing with SeatsLabs Backend...</div>;

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <div>
          <h1>{currentUser?.role} Dashboard</h1>
          <p>System is online and synced with database.</p>
        </div>
        <div className="quick-stats">
          <div className="stat"><span>{bookings.length}</span> Bookings</div>
          <div className="stat"><span>{technicians.length}</span> Technicians</div>
          <div className="stat"><span>{services.length}</span> Services</div>
        </div>
      </div>

      <div className="dashboard-tabs">
        <button className={activeTab === 'bookings' ? 'active' : ''} onClick={() => setActiveTab('bookings')}>Bookings</button>
        {isManager && <button className={activeTab === 'services' ? 'active' : ''} onClick={() => setActiveTab('services')}>Services</button>}
        {isManager && <button className={activeTab === 'technicians' ? 'active' : ''} onClick={() => setActiveTab('technicians')}>Technicians</button>}
        {isManager && <button className={activeTab === 'assets' ? 'active' : ''} onClick={() => setActiveTab('assets')}>System Assets</button>}
        {isManager && <button className={activeTab === 'payments' ? 'active' : ''} onClick={() => setActiveTab('payments')}>Payments & Refunds</button>}
        {isManager && <button className={activeTab === 'marketing' ? 'active' : ''} onClick={() => setActiveTab('marketing')}>Marketing Review</button>}
      </div>

      {activeTab === 'bookings' && renderBookings()}
      {activeTab === 'services' && renderServices()}
      {activeTab === 'technicians' && (
        <div className="tab-content">
          <h3>Technician Management</h3>
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Specialization</th>
                  <th>Level</th>
                  <th>Rating</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {technicians.map(t => (
                  <tr key={t.technician_id}>
                    <td>{t.user_first_name} {t.user_last_name}</td>
                    <td>{t.specialization}</td>
                    <td>{t.skill_level}</td>
                    <td>⭐ {parseFloat(t.performance_rating).toFixed(1)}</td>
                    <td>{t.is_available ? 'Available' : 'Busy'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'assets' && (
        <div className="tab-content">
          <div className="asset-grid">
            <div className="asset-card">
              <div className="section-header">
                <h3>Vehicle Brands</h3>
                <button className="btn-small" onClick={() => { setAssetType('brand'); setShowAssetModal(true); }}>+ Add</button>
              </div>
              <ul className="asset-list">
                {brands.map(b => <li key={b.vehicle_brand_id}>{b.vehicle_brand_name}</li>)}
              </ul>
            </div>

            <div className="asset-card">
              <div className="section-header">
                <h3>Vehicle Models</h3>
                <button className="btn-small" onClick={() => { setAssetType('model'); setShowAssetModal(true); }}>+ Add</button>
              </div>
              <p className="hint">Models are linked to brands</p>
            </div>

            <div className="asset-card">
              <div className="section-header">
                <h3>Body Types</h3>
                <button className="btn-small" onClick={() => { setAssetType('bodyType'); setShowAssetModal(true); }}>+ Add</button>
              </div>
              <ul className="asset-list">
                {bodyTypes.map(bt => <li key={bt.vehicle_body_type_id}>{bt.vehicle_body_type_name}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="tab-content">
          <div className="section-header">
            <h3>System Transactions</h3>
            <p className="hint">View and manage all booking-related payments and processing refunds.</p>
          </div>
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Payment ID</th>
                  <th>Customer</th>
                  <th>Booking Ref</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.payment_id}>
                    <td>#{p.payment_id}</td>
                    <td>{p.user_first_name} {p.user_last_name}</td>
                    <td>{p.booking_reference}</td>
                    <td>Rs. {parseFloat(p.amount).toLocaleString()}</td>
                    <td>
                      <span className={`status-badge status-${p.payment_status?.toLowerCase()}`}>
                        {p.payment_status}
                      </span>
                    </td>
                    <td>{new Date(p.payment_date_time).toLocaleDateString()}</td>
                    <td>
                      {p.payment_status === 'Pending' && (
                        <button
                          className="btn-small btn-outline-success"
                          onClick={() => handleVerifyPayment(p.payment_id)}
                        >
                          Verify Payment
                        </button>
                      )}
                      {p.payment_status === 'Completed' && (
                        <button
                          className="btn-small btn-outline-danger"
                          onClick={() => handleRefund(p.payment_id)}
                        >
                          Process Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'marketing' && (
        <div className="tab-content">
          <div className="marketing-section">
            <h3>Ad Campaigns</h3>
            <div className="table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Advertiser</th>
                    <th>Type</th>
                    <th>Budget</th>
                    <th>Status</th>
                    <th>Dates</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map(c => (
                    <tr key={c.campaign_id}>
                      <td>{c.campaign_name}</td>
                      <td>{c.business_name}</td>
                      <td>{c.campaign_type}</td>
                      <td>Rs. {parseFloat(c.budget).toLocaleString()}</td>
                      <td><span className={`status-badge status-${c.status?.toLowerCase()}`}>{c.status}</span></td>
                      <td>{new Date(c.start_date).toLocaleDateString()} - {new Date(c.end_date).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="marketing-section" style={{ marginTop: '3rem' }}>
            <h3>Advertisement Approval Queue</h3>
            <div className="table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Ad Title</th>
                    <th>Campaign</th>
                    <th>Advertiser</th>
                    <th>Approval Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ads.map(ad => (
                    <tr key={ad.advertisement_id}>
                      <td>{ad.ad_title}</td>
                      <td>{ad.campaign_name}</td>
                      <td>{ad.business_name}</td>
                      <td>
                        <span className={`status-badge ${ad.is_approved ? 'status-approved' : 'status-pending'}`}>
                          {ad.is_approved ? 'Approved' : 'Pending'}
                        </span>
                      </td>
                      <td>
                        {!ad.is_approved ? (
                          <button className="btn-small" onClick={() => handleApproveAd(ad.advertisement_id)}>Approve Ad</button>
                        ) : (
                          <button className="btn-small btn-outline-danger" onClick={() => handleRejectAd(ad.advertisement_id)}>Revoke Approval</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showServiceModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <h2>Add New Service</h2>
            <form onSubmit={handleAddService}>
              <div className="form-group">
                <label>Category</label>
                <select required value={newService.serviceCategoryId} onChange={e => setNewService({ ...newService, serviceCategoryId: e.target.value })}>
                  <option value="">Select Category</option>
                  {categories.map(c => <option key={c.service_category_id} value={c.service_category_id}>{c.service_category_name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Service Name</label>
                <input type="text" required value={newService.serviceName} onChange={e => setNewService({ ...newService, serviceName: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={newService.serviceDescription} onChange={e => setNewService({ ...newService, serviceDescription: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Duration (Minutes)</label>
                <input type="number" required value={newService.durationMinutes} onChange={e => setNewService({ ...newService, durationMinutes: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Base Price (Rs.)</label>
                <input type="number" required value={newService.basePrice} onChange={e => setNewService({ ...newService, basePrice: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowServiceModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Create Service</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAssetModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <h2>Add {assetType.charAt(0).toUpperCase() + assetType.slice(1)}</h2>
            <form onSubmit={handleAddAsset}>
              {assetType === 'model' && (
                <div className="form-group">
                  <label>Brand</label>
                  <select required value={newAsset.brandId} onChange={e => setNewAsset({ ...newAsset, brandId: e.target.value })}>
                    <option value="">Select Brand</option>
                    {brands.map(b => <option key={b.vehicle_brand_id} value={b.vehicle_brand_id}>{b.vehicle_brand_name}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  required
                  value={newAsset.name}
                  onChange={e => setNewAsset({ ...newAsset, name: e.target.value })}
                  placeholder={`Enter ${assetType} name`}
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowAssetModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Add Asset</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
