import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function InitialSetup() {
  const navigate = useNavigate();
  const { setup } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState({
    tenantName: '',
    tenantSlug: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    confirmPassword: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setData({ ...data, [e.target.name]: e.target.value });
  };

  const validateStep1 = () => {
    if (!data.tenantName.trim()) return 'Tenant name is required';
    if (!data.tenantSlug.trim() && !data.tenantName.trim()) return 'Tenant slug is required';
    return null;
  };

  const validateStep2 = () => {
    if (!data.adminEmail.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.adminEmail)) return 'Invalid email format';
    if (!data.adminPassword) return 'Password is required';
    if (data.adminPassword.length < 8) return 'Password must be at least 8 characters';
    if (data.adminPassword !== data.confirmPassword) return 'Passwords do not match';
    return null;
  };

  const handleNext = () => {
    const error = step === 1 ? validateStep1() : validateStep2();
    if (error) {
      setError(error);
      return;
    }
    setError('');
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await setup({
        tenantName: data.tenantName,
        tenantSlug: data.tenantSlug || undefined,
        adminName: data.adminName || undefined,
        adminEmail: data.adminEmail,
        adminPassword: data.adminPassword
      });
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
      padding: '2rem'
    }}>
      <div className="card" style={{ width: '480px', maxWidth: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: 'var(--color-primary)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
            fontSize: '2rem',
            fontWeight: 'bold',
            color: 'white'
          }}>
            C
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            ChatIAS 3.0
          </h1>
          <p className="text-muted">Initial Setup</p>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: step >= i ? 'var(--color-primary)' : 'var(--color-bg)',
                color: step >= i ? 'white' : 'var(--color-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '600',
                fontSize: '0.875rem'
              }}>
                {step > i ? '✓' : i}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
            <span className="text-sm text-muted">
              {step === 1 && 'Organization'}
              {step === 2 && 'Administrator'}
              {step === 3 && 'Confirm'}
            </span>
          </div>
        </div>

        {error && (
          <div style={{
            padding: '0.75rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--color-danger)',
            borderRadius: 'var(--radius)',
            color: 'var(--color-danger)',
            marginBottom: '1rem',
            fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <>
              <div className="input-group">
                <label>Organization Name *</label>
                <input
                  type="text"
                  name="tenantName"
                  className="input"
                  placeholder="Your company name"
                  value={data.tenantName}
                  onChange={handleChange}
                />
              </div>
              <div className="input-group">
                <label>Organization Slug (optional)</label>
                <input
                  type="text"
                  name="tenantSlug"
                  className="input"
                  placeholder="auto-generated if empty"
                  value={data.tenantSlug}
                  onChange={handleChange}
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="input-group">
                <label>Full Name</label>
                <input
                  type="text"
                  name="adminName"
                  className="input"
                  placeholder="Administrator name"
                  value={data.adminName}
                  onChange={handleChange}
                />
              </div>
              <div className="input-group">
                <label>Email Address *</label>
                <input
                  type="email"
                  name="adminEmail"
                  className="input"
                  placeholder="admin@company.com"
                  value={data.adminEmail}
                  onChange={handleChange}
                />
              </div>
              <div className="input-group">
                <label>Password *</label>
                <input
                  type="password"
                  name="adminPassword"
                  className="input"
                  placeholder="Min. 8 characters"
                  value={data.adminPassword}
                  onChange={handleChange}
                />
              </div>
              <div className="input-group">
                <label>Confirm Password *</label>
                <input
                  type="password"
                  name="confirmPassword"
                  className="input"
                  placeholder="Confirm your password"
                  value={data.confirmPassword}
                  onChange={handleChange}
                />
              </div>
            </>
          )}

          {step === 3 && (
            <div>
              <div style={{
                padding: '1rem',
                background: 'var(--color-bg)',
                borderRadius: 'var(--radius)',
                marginBottom: '1rem'
              }}>
                <h4 style={{ marginBottom: '0.5rem' }}>Organization</h4>
                <p><strong>{data.tenantName}</strong></p>
                {data.tenantSlug && <p className="text-sm text-muted">{data.tenantSlug}</p>}
              </div>
              <div style={{
                padding: '1rem',
                background: 'var(--color-bg)',
                borderRadius: 'var(--radius)'
              }}>
                <h4 style={{ marginBottom: '0.5rem' }}>Administrator</h4>
                <p><strong>{data.adminName || 'Administrator'}</strong></p>
                <p className="text-sm text-muted">{data.adminEmail}</p>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            {step > 1 && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleBack}
                style={{ flex: 1 }}
              >
                Back
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleNext}
                style={{ flex: step === 1 ? 1 : 1 }}
              >
                Continue
              </button>
            ) : (
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ flex: 1 }}
              >
                {loading ? 'Setting up...' : 'Complete Setup'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default InitialSetup;
