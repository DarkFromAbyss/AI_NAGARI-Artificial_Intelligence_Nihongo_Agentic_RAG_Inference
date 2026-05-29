'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import './auth.css';

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setErrors({});

    // Validate password match
    if (password !== confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    // Validate required fields
    if (!username.trim() || !email.trim() || !password.trim()) {
      setErrors({ general: 'Please fill in all required fields' });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password: password.trim(),
          full_name: displayName.trim() || null,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log('Registration successful:', data);
        // Redirect to homepage on successful registration
        router.push('/');
      } else {
        // BỘ PHÂN TÍCH LỖI LINH HOẠT (ROBUST ERROR PARSER)
        const parsedErrors: Record<string, string> = {};

        if (data.errors) {
          // Trường hợp backend trả về key chung là 'body'
          if (data.errors.body) {
            const bodyMsg = data.errors.body;
            // Tự động đoán xem lỗi thuộc về trường nào dựa vào từ khóa trong thông báo
            if (bodyMsg.toLowerCase().includes('password')) {
              parsedErrors.password = bodyMsg;
            } else if (bodyMsg.toLowerCase().includes('username') || bodyMsg.toLowerCase().includes('3 characters')) {
              parsedErrors.username = bodyMsg;
            } else if (bodyMsg.toLowerCase().includes('email')) {
              parsedErrors.email = bodyMsg;
            } else {
              parsedErrors.general = bodyMsg;
            }
          } else {
            // Trường hợp backend trả về chuẩn theo từng key (username, email, password)
            Object.assign(parsedErrors, data.errors);
          }
        } else if (data.detail && data.detail.errors) {
          // Xử lý trường hợp log số 3: Lỗi bọc trong detail.errors
          Object.assign(parsedErrors, data.detail.errors);
        } else if (data.detail && typeof data.detail === 'string') {
          parsedErrors.general = data.detail;
        } else {
          parsedErrors.general = data.message || 'Registration failed. Please try again.';
        }

        // Cập nhật lại state errors để kích hoạt dòng chữ đỏ hiển thị trên giao diện
        setErrors(parsedErrors);
        console.error('Processed registration errors for UI:', parsedErrors);
      }
    } catch (error) {
      console.error('Registration request error:', error);
      setErrors({ general: 'Failed to connect to the server. Please check your connection and try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Left Panel - Branding & Decorative */}
      <div className="auth-left-panel">
        <div className="auth-left-content">
          {/* Top: Logo and App Name - Clickable Back to Home */}
          <Link href="/" className="auth-header-link">
            <div className="auth-header">
              <div className="auth-logo">
                <span>名</span>
              </div>
              <div>
                <h1 className="auth-title">AI NAGARI</h1>
                <p className="auth-subtitle">日本語 AI</p>
              </div>
            </div>
          </Link>

          {/* Center: Main Typography and Description */}
          <div className="auth-description">
            <h2 className="auth-main-text">日本語</h2>
            <p className="auth-tagline">
              Master Japanese with an AI companion that adapts to your pace — from hiragana to fluency.
            </p>
          </div>

          {/* Bottom: Japanese Level Badges */}
          <div className="auth-badges">
            <span className="auth-badge">ひらがな</span>
            <span className="auth-badge">カタカナ</span>
            <span className="auth-badge">漢字</span>
            <span className="auth-badge">N5 → N1</span>
          </div>
        </div>

        {/* Decorative Grid Background */}
        <div className="auth-grid-background"></div>
      </div>

      {/* Right Panel - Form */}
      <div className="auth-right-panel">
        <div className="auth-form-container">
          {/* Form Header */}
          <div className="auth-form-header">
            <h2 className="auth-form-title">Create your account</h2>
            <p className="auth-form-subtitle">Start learning Japanese with AI Nagari today.</p>
          </div>

          {/* Tab Toggle */}
          <div className="auth-tab-toggle">
            <Link href="/login" className="auth-tab">
              Sign In
            </Link>
            <button className="auth-tab active">Create Account</button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="auth-form">
            {/* General Error Alert */}
            {errors.general && (
              <div style={{
                padding: '10px 12px',
                marginBottom: '16px',
                backgroundColor: '#fee2e2',
                border: '1px solid #fca5a5',
                borderRadius: '6px',
                color: '#dc2626',
                fontSize: '14px'
              }}>
                {errors.general}
              </div>
            )}

            {/* Display Name Field */}
            <div className="auth-form-group">
              <label className="auth-label">Display Name <span className="auth-optional">(optional)</span></label>
              <div className="auth-input-wrapper">
                <svg
                  className="auth-input-icon"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="10" r="3" />
                  <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />
                </svg>
                <input
                  type="text"
                  placeholder="Yuki Tanaka"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="auth-input"
                />
              </div>
            </div>

            {/* Username Field */}
            <div className="auth-form-group">
              <label className="auth-label">Username</label>
              <div className="auth-input-wrapper">
                <svg
                  className="auth-input-icon"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <input
                  type="text"
                  placeholder="yukitanaka"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (errors.username) {
                      setErrors({ ...errors, username: '' });
                    }
                  }}
                  className={`auth-input ${errors.username ? 'has-error' : ''}`}
                  required
                />
              </div>
              {errors.username && (
                <div style={{
                  marginTop: '6px',
                  color: '#dc2626',
                  fontSize: '13px'
                }}>
                  {errors.username}
                </div>
              )}
            </div>

            {/* Email Field */}
            <div className="auth-form-group">
              <label className="auth-label">Email Address</label>
              <div className="auth-input-wrapper">
                <svg
                  className="auth-input-icon"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="1" />
                  <path d="M20 10.999V8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v.999" />
                  <path d="M9.6 5h4.8" />
                  <path d="M12 12v.01" />
                  <path d="M20 14v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3" />
                </svg>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) {
                      setErrors({ ...errors, email: '' });
                    }
                  }}
                  className={`auth-input ${errors.email ? 'has-error' : ''}`}
                  required
                />
              </div>
              {errors.email && (
                <div style={{
                  marginTop: '6px',
                  color: '#dc2626',
                  fontSize: '13px'
                }}>
                  {errors.email}
                </div>
              )}
            </div>

            {/* Password Field */}
            <div className="auth-form-group">
              <label className="auth-label">Password</label>
              <div className="auth-input-wrapper">
                <svg
                  className="auth-input-icon"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) {
                      setErrors({ ...errors, password: '' });
                    }
                  }}
                  className={`auth-input ${errors.password ? 'has-error' : ''}`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="auth-input-toggle"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <div style={{
                  marginTop: '6px',
                  color: '#dc2626',
                  fontSize: '13px'
                }}>
                  {errors.password}
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="auth-form-group">
              <label className="auth-label">Confirm Password</label>
              <div className="auth-input-wrapper">
                <svg
                  className="auth-input-icon"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword) {
                      setErrors({ ...errors, confirmPassword: '' });
                    }
                  }}
                  className={`auth-input ${errors.confirmPassword ? 'has-error' : ''}`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="auth-input-toggle"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <div style={{
                  marginTop: '6px',
                  color: '#dc2626',
                  fontSize: '13px'
                }}>
                  {errors.confirmPassword}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="auth-submit-btn"
              disabled={isLoading}
            >
              {isLoading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          {/* Footer */}
          <div className="auth-footer">
            <p className="auth-footer-text">
              By continuing, you agree to our{' '}
              <Link href="/terms" className="auth-footer-link">
                Terms
              </Link>
              {' & '}
              <Link href="/privacy" className="auth-footer-link">
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
