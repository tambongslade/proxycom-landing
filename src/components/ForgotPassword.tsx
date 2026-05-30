import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import './ForgotPassword.css';

const ForgotPassword: React.FC = () => {
  const { t } = useTranslation();
  const [step, setStep] = useState<'email' | 'otp' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    const payload = {
      email,
      user_type: 'client'
    };
    console.log('Sending password reset payload:', payload);

    try {
      await axios.post('/api/v1/auth/request-password-reset', payload);
      setSuccess(t('resetEmailSent'));
      setStep('otp');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as { response?: { status?: number; data?: { message?: string } } };
        if (axiosError.response?.status === 404 && axiosError.response.data?.message === 'User not found') {
          setError(t('userNotFound'));
        } else {
          setError(t('resetRequestError'));
        }
      } else {
        setError(err instanceof Error ? err.message : t('resetRequestError'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      await axios.post('/api/v1/auth/verify-otp', {
        email,
        otp,
        user_type: 'client'
      });
      setSuccess(t('otpVerified'));
      setStep('password');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('otpVerificationError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError(t('passwordsDoNotMatch'));
      return;
    }

    setIsLoading(true);

    try {
      await axios.post('/api/v1/auth/reset-password', {
        email,
        otp,
        new_password: newPassword,
        user_type: 'client'
      });
      setSuccess(t('passwordResetSuccess'));
      // Redirect to login after 2 seconds
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('passwordResetError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="forgot-password-container">
      <div className="forgot-password-card">
        <h2>{t('forgotPassword')}</h2>
        
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {step === 'email' && (
          <form onSubmit={handleRequestReset}>
            <div className="form-group">
              <label htmlFor="email">{t('email')}</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <button type="submit" disabled={isLoading}>
              {isLoading ? t('sending') : t('sendResetLink')}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOTP}>
            <div className="form-group">
              <label htmlFor="otp">{t('enterOTP')}</label>
              <input
                type="text"
                id="otp"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <button type="submit" disabled={isLoading}>
              {isLoading ? t('verifying') : t('verifyOTP')}
            </button>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={handleResetPassword}>
            <div className="form-group">
              <label htmlFor="newPassword">{t('newPassword')}</label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                disabled={isLoading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirmPassword">{t('confirmPassword')}</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                disabled={isLoading}
              />
            </div>
            <button type="submit" disabled={isLoading}>
              {isLoading ? t('resetting') : t('resetPassword')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword; 