'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProfileSidebar } from '@/components/profile/profile-sidebar';
import { ProfileTab } from '@/components/profile/profile-tab';
import { AccountTab } from '@/components/profile/account-tab';

interface UserProfile {
  id: number;
  username: string;
  email: string;
  full_name: string;
  birth_year?: number | null;
  occupation?: string | null;
  interests?: string | null;
  preferred_language?: string | null;
}

interface EditingField {
  field: string;
  value: string;
}

interface ApiErrorResponse {
  success: boolean;
  errors: Record<string, string>;
}

interface ApiSuccessResponse {
  success: boolean;
  message: string;
  data?: UserProfile;
}

export default function SettingsPage() {
  const router = useRouter();

  // State Management
  const [activeTab, setActiveTab] = useState<'profile' | 'account'>('profile');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAccountUnlocked, setIsAccountUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [editingField, setEditingField] = useState<EditingField | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Get session token from localStorage
  const getSessionToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('session_token');
  };

  // Fetch user profile from backend
  const fetchUserProfile = async (sessionToken: string) => {
    try {
      setLoading(true);
      setError(null);

      console.log('[DEBUG] Fetching profile with token:', sessionToken?.substring(0, 20) + '...');

      const response = await fetch('http://localhost:8000/api/profile', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      console.log('[DEBUG] Profile response status:', response.status);

      if (!response.ok) {
        let errorMessage = 'Failed to fetch profile';
        try {
          const errorData = await response.json();
          console.log('[DEBUG] Error response:', errorData);
          
          // Handle different error response formats
          if (typeof errorData.detail === 'string') {
            errorMessage = errorData.detail;
          } else if (errorData.detail?.errors?.general) {
            errorMessage = errorData.detail.errors.general;
          } else if (errorData.errors?.general) {
            errorMessage = errorData.errors.general;
          }
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = (await response.json()) as ApiSuccessResponse;
      console.log('[DEBUG] Profile data received:', data);
      
      if (data.success && data.data) {
        setUserProfile(data.data);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('[ERROR] Failed to fetch user profile:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch profile on component mount
  useEffect(() => {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      setError('No session found. Please log in.');
      setLoading(false);
      return;
    }

    fetchUserProfile(sessionToken);
  }, []);

  // Handle logout
  const handleLogout = async () => {
    try {
      const sessionToken = getSessionToken();
      if (sessionToken) {
        await fetch('http://localhost:8000/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
          },
        });
      }
      localStorage.removeItem('session_token');
      router.push('/');
    } catch (err) {
      console.error('Logout failed:', err);
      localStorage.removeItem('session_token');
      router.push('/');
    }
  };

  // Handle account unlock via password
  const handleUnlockAccount = async () => {
    setPasswordError('');
    try {
      const response = await fetch('http://localhost:8000/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      });

      if (response.ok) {
        setIsAccountUnlocked(true);
        setPasswordInput('');
      } else {
        setPasswordError('Incorrect password. Please try again.');
      }
    } catch (err) {
      console.error('Password verification failed:', err);
      setPasswordError('An error occurred. Please try again.');
    }
  };

  // Handle field editing - start
  const startEditField = (field: string, currentValue: any) => {
    setEditingField({ field, value: currentValue || '' });
    setEditValue(currentValue?.toString() || '');
    setSaveError(null);
  };

  // Handle field editing - save
  const saveEditField = async () => {
    if (!editingField || !userProfile) return;

    const sessionToken = getSessionToken();
    if (!sessionToken) {
      setSaveError('Session expired. Please log in again.');
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);

      console.log('[DEBUG] Saving field:', editingField.field, 'with value:', editValue);

      const response = await fetch('http://localhost:8000/api/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          field: editingField.field,
          value: editValue || null,
        }),
      });

      console.log('[DEBUG] Update response status:', response.status);

      if (!response.ok) {
        let errorMessage = 'Failed to update field';
        try {
          const errorData = await response.json();
          console.log('[DEBUG] Error response:', errorData);
          
          // Handle different error response formats
          if (typeof errorData.detail === 'string') {
            errorMessage = errorData.detail;
          } else if (errorData.detail?.errors) {
            errorMessage = Object.values(errorData.detail.errors)[0] as string;
          } else if (errorData.errors) {
            errorMessage = Object.values(errorData.errors)[0] as string;
          }
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        setSaveError(errorMessage);
        throw new Error(errorMessage);
      }

      const data = (await response.json()) as ApiSuccessResponse;
      console.log('[DEBUG] Update successful, new profile data:', data);

      if (data.success && data.data) {
        // Update local state with the new profile data
        setUserProfile(data.data);
        setEditingField(null);
        setEditValue('');
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setSaveError(message);
      console.error('[ERROR] Failed to update field:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle field editing - cancel
  const cancelEditField = () => {
    setEditingField(null);
    setEditValue('');
    setSaveError(null);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading profile...</div>
      </div>
    );
  }

  // Error state
  if (error || !userProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="text-white text-xl">
          {error || 'Failed to load profile'}
        </div>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          Return Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex overflow-hidden relative">
      {/* Ambient Background Glow */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-br from-purple-600/10 to-transparent rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-to-tl from-purple-600/10 to-transparent rounded-full blur-3xl opacity-50" />
      </div>

      {/* Sidebar */}
      <ProfileSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        userProfile={userProfile}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'profile' ? (
          <ProfileTab
            userProfile={userProfile}
            editingField={editingField}
            editValue={editValue}
            setEditValue={setEditValue}
            startEditField={startEditField}
            saveEditField={saveEditField}
            cancelEditField={cancelEditField}
            isSaving={isSaving}
            saveError={saveError}
          />
        ) : (
          <AccountTab
            userProfile={userProfile}
            isUnlocked={isAccountUnlocked}
            passwordInput={passwordInput}
            setPasswordInput={setPasswordInput}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            passwordError={passwordError}
            onUnlock={handleUnlockAccount}
            editingField={editingField}
            editValue={editValue}
            setEditValue={setEditValue}
            startEditField={startEditField}
            saveEditField={saveEditField}
            cancelEditField={cancelEditField}
            onLogout={handleLogout}
          />
        )}
      </main>
    </div>
  );
}
