import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import '../styles/Booking.css';

function Booking({ services }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Get pre-selected service from navigation state
  const preSelectedService = location.state?.selectedService;

  // Form state
  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    vehicleId: '',
    serviceId: preSelectedService ? preSelectedService.id : '',
    date: '',
    timeSlotId: '',
    notes: ''
  });

  const [localServices, setLocalServices] = useState(services || []);
  const [currentUser, setCurrentUser] = useState(null);
  const [userVehicles, setUserVehicles] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [bookingRef, setBookingRef] = useState('');

  // Sync services prop to local state
  useEffect(() => {
    if (services && services.length > 0) {
      setLocalServices(services);
    }
  }, [services]);

  // Fetch services if localServices is still empty
  useEffect(() => {
    if (localServices.length === 0) {
      const fetchServices = async () => {
        try {
          const response = await api.services.getAll();
          const mapped = response.data.data.map(s => ({
            id: s.service_id,
            name: s.service_name,
            description: s.service_description,
            price: parseFloat(s.base_price),
            duration: `${s.duration_minutes} mins`
          }));
          setLocalServices(mapped);
        } catch (error) {
          console.error("Failed to fetch services locally:", error);
        }
      };
      fetchServices();
    }
  }, []);

  // Prefill from Logged In User and Load Data
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));

    // Redirect Managers/Admins
    if (user && (user.role === 'Manager' || user.role === 'Admin')) {
      navigate('/admin');
      return;
    }

    if (user) {
      setCurrentUser(user);
      setFormData(prev => ({
        ...prev,
        customerName: `${user.firstName} ${user.lastName}`,
        phone: user.phone || ''
      }));

      // Load User's Vehicles
      const fetchVehicles = async () => {
        try {
          const response = await api.vehicles.getMyVehicles();
          setUserVehicles(response.data.data);
        } catch (error) {
          console.error("Failed to fetch vehicles:", error);
        }
      };
      fetchVehicles();
    }
  }, [navigate]);

  // Update Available Slots when Date Changes
  useEffect(() => {
    if (formData.date) {
      const fetchSlots = async () => {
        try {
          const response = await api.bookings.getAvailableSlots(formData.date);
          setAvailableSlots(response.data.data);
        } catch (error) {
          console.error("Failed to fetch slots:", error);
        }
      };
      fetchSlots();
    } else {
      setAvailableSlots([]);
    }
  }, [formData.date]);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};
    if (!formData.customerName.trim()) newErrors.customerName = 'Name is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    if (!formData.vehicleId) newErrors.vehicleId = 'Please select a vehicle';
    if (!formData.serviceId) newErrors.serviceId = 'Please select a service';
    if (!formData.date) newErrors.date = 'Please select a date';
    if (!formData.timeSlotId) newErrors.timeSlotId = 'Please select a time slot';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (validateForm()) {
      setLoading(true);
      try {
        const bookingData = {
          vehicleId: formData.vehicleId,
          serviceId: formData.serviceId,
          timeSlotId: formData.timeSlotId,
          specialNotes: formData.notes
        };

        const response = await api.bookings.create(bookingData);
        setBookingRef(response.data.data.bookingReference);
        setIsSubmitted(true);
      } catch (err) {
        console.error(err);
        setErrors({ submit: err.response?.data?.error || 'Booking failed. Please try again.' });
      } finally {
        setLoading(false);
      }
    }
  };

  // Success message component
  if (isSubmitted) {
    const selectedTime = availableSlots.find(s => s.time_slot_id.toString() === formData.timeSlotId.toString())?.time_slot_start_time || 'Selected Time';
    const selectedServiceName = localServices.find(s => s.id.toString() === formData.serviceId.toString())?.name || 'Selected Service';

    return (
      <div className="booking-page">
        <div className="success-container glass-panel">
          <div className="success-icon">✅</div>
          <h2>Booking Confirmed!</h2>
          <p>Reference: <strong>{bookingRef}</strong></p>

          <div className="booking-summary">
            <h3>Booking Details</h3>
            <div className="summary-item">
              <span className="label">Name:</span>
              <span className="value">{formData.customerName}</span>
            </div>
            <div className="summary-item">
              <span className="label">Service:</span>
              <span className="value">{selectedServiceName}</span>
            </div>
            <div className="summary-item">
              <span className="label">Date:</span>
              <span className="value">{formData.date}</span>
            </div>
            <div className="summary-item">
              <span className="label">Time:</span>
              <span className="value">{selectedTime}</span>
            </div>
          </div>

          <button className="btn btn-primary" onClick={() => navigate('/my-bookings')}>View My Bookings</button>
        </div>
      </div>
    );
  }

  return (
    <div className="booking-page">
      <div className="page-header">
        <h1>Book Your Appointment</h1>
        <p>Fill in the details below to reserve your service slot</p>
      </div>

      <form className="booking-form glass-panel" onSubmit={handleSubmit}>
        <div className="form-section">
          <h3 className="section-title">Customer & Vehicle</h3>
          <div className="form-group">
            <label htmlFor="customerName">Full Name *</label>
            <input type="text" id="customerName" name="customerName" value={formData.customerName} readOnly />
          </div>
          <div className="form-group">
            <label htmlFor="phone">Phone Number *</label>
            <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleChange} />
            {errors.phone && <span className="error-message">{errors.phone}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="vehicleId">Vehicle *</label>
            {userVehicles.length > 0 ? (
              <select id="vehicleId" name="vehicleId" value={formData.vehicleId} onChange={handleChange} className={errors.vehicleId ? 'error' : ''}>
                <option value="">-- Select Your Vehicle --</option>
                {userVehicles.map(v => (
                  <option key={v.vehicle_id} value={v.vehicle_id}>
                    {v.vehicle_registration_number} - {v.vehicle_brand_name} {v.vehicle_model_name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="no-vehicles">
                <p>No vehicles found. Please <Link to="/my-vehicles">add a vehicle</Link> first.</p>
              </div>
            )}
            {errors.vehicleId && <span className="error-message">{errors.vehicleId}</span>}
          </div>
        </div>

        <div className="form-section">
          <h3 className="section-title">Service & Schedule</h3>
          <div className="form-group">
            <label htmlFor="serviceId">Service Type *</label>
            <select id="serviceId" name="serviceId" value={formData.serviceId} onChange={handleChange} className={errors.serviceId ? 'error' : ''}>
              <option value="">-- Select a Service --</option>
              {localServices.map(service => (
                <option key={service.id} value={service.id}>
                  {service.name} - Rs. {service.price.toLocaleString()}
                </option>
              ))}
            </select>
            {errors.serviceId && <span className="error-message">{errors.serviceId}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="date">Date *</label>
              <input type="date" id="date" name="date" value={formData.date} onChange={handleChange} min={new Date().toISOString().split('T')[0]} />
              {errors.date && <span className="error-message">{errors.date}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="timeSlotId">Time Slot *</label>
              <select id="timeSlotId" name="timeSlotId" value={formData.timeSlotId} onChange={handleChange} disabled={!formData.date}>
                <option value="">-- Select Time --</option>
                {availableSlots.map(slot => (
                  <option key={slot.time_slot_id} value={slot.time_slot_id}>
                    {slot.time_slot_start_time.substring(0, 5)} - {slot.time_slot_end_time.substring(0, 5)}
                  </option>
                ))}
              </select>
              {errors.timeSlotId && <span className="error-message">{errors.timeSlotId}</span>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="notes">Special Notes</label>
            <textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} placeholder="Any specific issues with your vehicle?"></textarea>
          </div>
        </div>

        {errors.submit && <div className="error-message submit-error">{errors.submit}</div>}

        <button type="submit" className="btn btn-primary btn-large" disabled={loading}>
          {loading ? 'Processing...' : 'Confirm Booking'}
        </button>
      </form>
    </div>
  );
}

export default Booking;
