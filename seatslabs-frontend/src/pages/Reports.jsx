import React, { useState } from 'react';
import api from '../services/api';
import '../styles/Reports.css';

function Reports() {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const generateReport = async (type, params = {}) => {
        try {
            setLoading(true);
            setMessage(`Generating ${type.replace('-', ' ')}...`);

            let response;
            switch (type) {
                case 'daily-booking':
                    response = await api.reports.getDailyBookingReport(params.date);
                    break;
                case 'monthly-revenue':
                    response = await api.reports.getMonthlyRevenueReport(params.month, params.year);
                    break;
                case 'technician-performance':
                    response = await api.reports.getTechnicianPerformanceReport(params.start, params.end);
                    break;
                case 'customer-satisfaction':
                    response = await api.reports.getCustomerSatisfactionReport(params.month, params.year);
                    break;
                default:
                    throw new Error('Invalid report type');
            }

            if (response.data.success) {
                setMessage('Report generated successfully! Downloading...');
                const token = localStorage.getItem('token');
                const downloadUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/reports/download/${response.data.filename}?token=${token}`;
                
                // Create a hidden link and click it to trigger download without opening a new tab
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.setAttribute('download', response.data.filename);
                document.body.appendChild(link);
                link.click();
                link.remove();
            }
        } catch (error) {
            console.error(error);
            setMessage('Error generating report. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const reportCards = [
        {
            id: 'daily-booking',
            title: 'Daily Booking Report',
            description: 'Summary of all bookings and workshop activities for a specific day.',
            icon: '📅',
            fields: [{ name: 'date', label: 'Select Date', type: 'date', defaultValue: new Date().toISOString().split('T')[0] }]
        },
        {
            id: 'monthly-revenue',
            title: 'Monthly Revenue Report',
            description: 'Financial breakdown including service revenue and advertisement earnings.',
            icon: '💰',
            fields: [
                { name: 'month', label: 'Month (1-12)', type: 'number', defaultValue: new Date().getMonth() + 1 },
                { name: 'year', label: 'Year', type: 'number', defaultValue: new Date().getFullYear() }
            ]
        },
        {
            id: 'technician-performance',
            title: 'Technician Performance',
            description: 'Analyze technician productivity, average service times, and ratings.',
            icon: '👨‍🔧',
            fields: [
                { name: 'start', label: 'Start Date', type: 'date', defaultValue: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
                { name: 'end', label: 'End Date', type: 'date', defaultValue: new Date().toISOString().split('T')[0] }
            ]
        },
        {
            id: 'customer-satisfaction',
            title: 'Customer Satisfaction',
            description: 'Review customer feedback, service ratings, and complaint resolution stats.',
            icon: '⭐',
            fields: [
                { name: 'month', label: 'Month', type: 'number', defaultValue: new Date().getMonth() + 1 },
                { name: 'year', label: 'Year', type: 'number', defaultValue: new Date().getFullYear() }
            ]
        }
    ];

    return (
        <div className="reports-page">
            <header className="reports-header">
                <h1>SeatsLabs Management Reports</h1>
                <p>Generate and export system data in professional PDF format.</p>
            </header>

            {message && <div className={`status-banner ${loading ? 'loading' : 'success'}`}>{message}</div>}

            <div className="reports-grid">
                {reportCards.map(card => (
                    <ReportCard key={card.id} card={card} onGenerate={generateReport} loading={loading} />
                ))}
            </div>
        </div>
    );
}

function ReportCard({ card, onGenerate, loading }) {
    const [formData, setFormData] = useState(
        card.fields.reduce((acc, field) => ({ ...acc, [field.name]: field.defaultValue }), {})
    );
    const [shaking, setShaking] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleGenerate = async () => {
        setShaking(true);
        setTimeout(() => setShaking(false), 500); // Reset shake after animation
        await onGenerate(card.id, formData);
    };

    return (
        <div className="report-card">
            <div className="card-icon">{card.icon}</div>
            <h3>{card.title}</h3>
            <p>{card.description}</p>

            <div className="card-form">
                {card.fields.map(field => (
                    <div key={field.name} className="report-field">
                        <label>{field.label}</label>
                        <input
                            type={field.type}
                            name={field.name}
                            value={formData[field.name]}
                            onChange={handleChange}
                        />
                    </div>
                ))}
            </div>

            <button
                className={`btn btn-primary ${shaking ? 'button-shake' : ''}`}
                onClick={handleGenerate}
                disabled={loading}
            >
                {loading ? 'Processing...' : 'Generate PDF'}
            </button>
        </div>
    );
}

export default Reports;
