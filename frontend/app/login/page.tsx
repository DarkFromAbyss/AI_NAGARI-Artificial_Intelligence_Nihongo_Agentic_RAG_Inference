'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import './auth.css';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

      const res = await fetch(`${backendUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username_or_email: email,
          password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.success) {
        const message = data?.errors?.general || 'Login failed';
        console.error('[Login] failed:', data);
        window.alert(message);
        return;
      }

      if (!data?.session_token) {
        console.error('[Login] success but missing session_token:', data);
        window.alert('Login succeeded but session token was missing');
        return;
      }

      // Persist token for subsequent API calls (minimal change to satisfy redirect + backend feedback)
      localStorage.setItem('session_token', data.session_token);

      // Immediate redirect on success
      router.push('/');
    } catch (err) {
      console.error('[Login] error:', err);
      window.alert('An unexpected error occurred during login');
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
            <h2 className="auth-form-title">Welcome back</h2>
            <p className="auth-form-subtitle">Sign in to continue your learning journey.</p>
          </div>

          {/* Tab Toggle */}
          <div className="auth-tab-toggle">
            <button className="auth-tab active">Sign In</button>
            <Link href="/register" className="auth-tab">
              Create Account
            </Link>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="auth-form">
            {/* Email Field */}
            <div className="auth-form-group">
              <label className="auth-label">Username or Email</label>
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
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-input"
                  required
                />
              </div>
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
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-input"
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
            </div>

            {/* Forgot Password Link */}
            <div className="auth-forgot-password">
              <Link href="/forgot-password" className="auth-forgot-link">
                Forgot password?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="auth-submit-btn"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
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

