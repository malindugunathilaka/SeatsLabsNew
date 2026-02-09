import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import '../styles/MyBookings.css'; // Reuse styles for consistency

function MyVehicles() {
    const navigate = useNavigate();
    const [vehicles, setVehicles] = useState([]);
    const [brands, setBrands] = useState([]);
    const [models, setModels] = useState([]);
    const [bodyTypes, setBodyTypes] = useState([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [loading, setLoading] = useState(true);

    const [newVehicle, setNewVehicle] = useState({
        registrationNumber: '',
        brandId: '',
        modelId: '',
        bodyTypeId: '',
        manufactureYear: '',
        color: '',
        mileage: ''
    });


    const fetchInitialData = async () => {
        try {
            setLoading(true);
            console.log('Fetching vehicle data...');
            
            // Fetch public data (brands, body types) - models will be fetched on brand selection
            const [brandsRes, bodyTypesRes] = await Promise.all([
                api.vehicles.getBrands(),
                api.vehicles.getBodyTypes()
            ]);

            console.log('Brands:', brandsRes.data.data);
            console.log('Body Types:', bodyTypesRes.data.data);

            setBrands(brandsRes.data.data);
            setBodyTypes(bodyTypesRes.data.data);

            // Fetch user's vehicles separately (requires auth)
            try {
                const vehiclesRes = await api.vehicles.getMyVehicles();
                console.log('My Vehicles:', vehiclesRes.data.data);
                setVehicles(vehiclesRes.data.data);
            } catch (vehicleError) {
                console.error("Failed to fetch user vehicles:", vehicleError);
                console.error("Vehicle error details:", vehicleError.response?.data || vehicleError.message);
                setVehicles([]);
            }
        } catch (error) {
            console.error("Failed to fetch vehicle data:", error);
            console.error("Error details:", error.response?.data || error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user && (user.role === 'Manager' || user.role === 'Admin')) {
            navigate('/admin');
        } else {
            fetchInitialData();
        }
    }, [navigate]);

    const handleInputChange = async (e) => {
        const { name, value } = e.target;
        setNewVehicle(prev => ({
            ...prev,
            [name]: value
        }));

        // Fetch models when brand changes
        if (name === 'brandId' && value) {
            try {
                const response = await api.vehicles.getModelsByBrand(value);
                setModels(response.data.data);
            } catch (error) {
                console.error("Failed to fetch models for brand:", error);
                setModels([]);
            }
        }
    };

    const handleAddVehicle = async (e) => {
        e.preventDefault();
        try {
            const vehicleData = {
                brandId: parseInt(newVehicle.brandId),
                modelId: parseInt(newVehicle.modelId),
                bodyTypeId: parseInt(newVehicle.bodyTypeId),
                registrationNumber: newVehicle.registrationNumber,
                manufactureYear: parseInt(newVehicle.manufactureYear),
                color: newVehicle.color,
                mileage: parseInt(newVehicle.mileage)
            };

            await api.vehicles.create(vehicleData);
            alert('Vehicle Added Successfully!');
            setShowAddForm(false);
            setNewVehicle({
                registrationNumber: '',
                brandId: '',
                modelId: '',
                bodyTypeId: '',
                manufactureYear: '',
                color: '',
                mileage: ''
            });
            fetchInitialData();
        } catch (error) {
            alert('Failed to add vehicle: ' + (error.response?.data?.error || error.message));
        }
    };

    if (loading) return <div className="loading">Loading vehicles...</div>;

    return (
        <div className="my-bookings-page">
            <div className="page-header">
                <h1>My Vehicles</h1>
                <p>Manage your registered vehicles for service bookings</p>
            </div>

            <div className="bookings-list-container">
                <div className="section-header">
                    <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
                        {showAddForm ? 'Cancel' : '+ Add New Vehicle'}
                    </button>
                </div>

                {showAddForm && (
                    <div className="card add-form-container">
                        <h3>Add New Vehicle</h3>
                        <form onSubmit={handleAddVehicle} className="form-grid">
                            <div className="form-group">
                                <label>Registration Number *</label>
                                <input type="text" name="registrationNumber" placeholder="CAB-1234" value={newVehicle.registrationNumber} onChange={handleInputChange} required className="form-input" />
                            </div>

                            <div className="form-group">
                                <label>Brand *</label>
                                <select name="brandId" value={newVehicle.brandId} onChange={handleInputChange} required className="form-input">
                                    <option value="">Select Brand</option>
                                    {brands.map(b => (
                                        <option key={b.vehicle_brand_id} value={b.vehicle_brand_id}>{b.vehicle_brand_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Model *</label>
                                <select name="modelId" value={newVehicle.modelId} onChange={handleInputChange} required className="form-input">
                                    <option value="">Select Model</option>
                                    {models.map(m => (
                                        <option key={m.vehicle_model_id} value={m.vehicle_model_id}>{m.vehicle_model_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Body Type *</label>
                                <select name="bodyTypeId" value={newVehicle.bodyTypeId} onChange={handleInputChange} required className="form-input">
                                    <option value="">Select Body Type</option>
                                    {bodyTypes.map(bt => (
                                        <option key={bt.vehicle_body_type_id} value={bt.vehicle_body_type_id}>{bt.vehicle_body_type_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Year *</label>
                                <input type="number" name="manufactureYear" placeholder="2022" value={newVehicle.manufactureYear} onChange={handleInputChange} required className="form-input" />
                            </div>

                            <div className="form-group">
                                <label>Color</label>
                                <input type="text" name="color" placeholder="Silver" value={newVehicle.color} onChange={handleInputChange} className="form-input" />
                            </div>

                            <div className="form-group">
                                <label>Mileage (km)</label>
                                <input type="number" name="mileage" placeholder="50000" value={newVehicle.mileage} onChange={handleInputChange} className="form-input" />
                            </div>

                            <div className="form-actions">
                                <button type="submit" className="btn btn-primary">Save Vehicle</button>
                            </div>
                        </form>
                    </div>
                )}

                {vehicles.length > 0 ? (
                    <div className="bookings-grid">
                        {vehicles.map(vehicle => (
                            <div key={vehicle.vehicle_id} className="booking-card glass-panel">
                                <div className="booking-header">
                                    <span className="booking-id">{vehicle.vehicle_registration_number}</span>
                                    <span className="status-badge status-confirmed">{vehicle.vehicle_brand_name}</span>
                                </div>
                                <div className="booking-details">
                                    <div className="detail-row">
                                        <span className="label">Model:</span>
                                        <span className="value">{vehicle.vehicle_model_name}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="label">Year:</span>
                                        <span className="value">{vehicle.vehicle_manufacture_year}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="label">Color:</span>
                                        <span className="value">{vehicle.vehicle_color || 'N/A'}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="label">Mileage:</span>
                                        <span className="value">{vehicle.vehicle_mileage ? `${vehicle.vehicle_mileage} km` : 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="no-bookings-state">
                        <span className="icon">🚗</span>
                        <h3>No Vehicles Found</h3>
                        <p>You haven't added any vehicles yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default MyVehicles;
