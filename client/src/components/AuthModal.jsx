import { useState, useEffect } from 'react';
import Icon from './Icon.jsx';
import { api } from '../services/api.js';

export default function AuthModal({ isOpen, initialMode = 'login', onClose, onAuthSuccess }) {
  const [mode, setMode] = useState(initialMode); // 'login' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError('');
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        if (!name.trim()) throw new Error('Please enter your name.');
        const result = await api.signup({ name: name.trim(), email: email.trim(), password });
        if (typeof localStorage !== 'undefined')
          localStorage.setItem('rowready_token', result.token);
        onAuthSuccess(result.user, result.token);
      } else {
        const result = await api.login({ email: email.trim(), password });
        if (typeof localStorage !== 'undefined')
          localStorage.setItem('rowready_token', result.token);
        onAuthSuccess(result.user, result.token);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function toggleMode() {
    setMode((m) => (m === 'login' ? 'signup' : 'login'));
    setError('');
  }

  return (
    <div className="auth-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auth-header">
          <div className="auth-brand">
            <span className="brand-mark">
              <i />
              <i />
              <i />
            </span>
            <h2>{mode === 'login' ? 'Sign in to RowReady' : 'Create an Account'}</h2>
          </div>
          <button className="auth-close" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        <p className="auth-subheading">
          {mode === 'login'
            ? 'Access your saved data quality reports and session history.'
            : 'Join RowReady to save reports, track dataset cleaning, and manage workflows.'}
        </p>

        {error && (
          <div className="auth-error" role="alert">
            <Icon name="info" size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signup' && (
            <div className="auth-field">
              <label htmlFor="auth-name">Full Name</label>
              <input
                id="auth-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Analyst"
                disabled={loading}
                autoFocus
              />
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="auth-email">Email Address</label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@example.com"
              disabled={loading}
              autoFocus={mode === 'login'}
            />
          </div>

          <div className="auth-field">
            <div className="auth-label-row">
              <label htmlFor="auth-password">Password</label>
              <button
                type="button"
                className="text-button text-muted"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              id="auth-password"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
              minLength={mode === 'signup' ? 6 : 1}
              disabled={loading}
            />
          </div>

          <button type="submit" className="button primary auth-submit" disabled={loading}>
            {loading ? <span className="spinner" /> : null}
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="auth-footer">
          <span>
            {mode === 'login' ? "Don't have an account yet?" : 'Already have an account?'}
          </span>
          <button type="button" className="text-button" onClick={toggleMode} disabled={loading}>
            {mode === 'login' ? 'Create an account' : 'Sign in instead'}
          </button>
        </div>
      </div>
    </div>
  );
}
