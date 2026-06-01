'use client';

import React, { useState } from 'react';
import { Lock, Eye, EyeOff, Mail, User, Check, X } from 'lucide-react';

interface UserProfile {
  id: number;
  username: string;
  email: string;
  full_name: string;
  birth_year?: number | null;
  occupation?: string | null;
  interests?: string | null;
  preferred_language?: string | null;
  timezone?: string | null;
}

interface EditingField {
  field: string;
  value: string;
}

interface AccountTabProps {
  userProfile: UserProfile;
  isUnlocked: boolean;
  passwordInput: string;
  setPasswordInput: (value: string) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  passwordError: string;
  onUnlock: () => void;
  editingField: EditingField | null;
  editValue: string;
  setEditValue: (value: string) => void;
  startEditField: (field: string, value: any) => void;
  saveEditField: () => void;
  cancelEditField: () => void;
  onLogout: () => void;
}

export function AccountTab({
  userProfile,
  isUnlocked,
  passwordInput,
  setPasswordInput,
  showPassword,
  setShowPassword,
  passwordError,
  onUnlock,
  editingField,
  editValue,
  setEditValue,
  startEditField,
  saveEditField,
  cancelEditField,
  onLogout,
}: AccountTabProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-start pt-8 pb-8">
      <div className="w-full max-w-2xl px-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Account Security</h1>
          <p className="text-slate-400/80">
            Secure settings — password verification required
          </p>
        </div>

        {!isUnlocked ? (
          // Locked State - Password Verification Gateway
          <PasswordVerificationGate
            passwordInput={passwordInput}
            setPasswordInput={setPasswordInput}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            passwordError={passwordError}
            onUnlock={onUnlock}
          />
        ) : (
          // Unlocked State - Account Information
          <UnlockedAccountView
            userProfile={userProfile}
            editingField={editingField}
            editValue={editValue}
            setEditValue={setEditValue}
            startEditField={startEditField}
            saveEditField={saveEditField}
            cancelEditField={cancelEditField}
            onLogout={onLogout}
          />
        )}
      </div>
    </div>
  );
}

// Password Verification Gate Component
interface PasswordVerificationGateProps {
  passwordInput: string;
  setPasswordInput: (value: string) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  passwordError: string;
  onUnlock: () => void;
}

function PasswordVerificationGate({
  passwordInput,
  setPasswordInput,
  showPassword,
  setShowPassword,
  passwordError,
  onUnlock,
}: PasswordVerificationGateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      {/* Security Icon */}
      <div className="w-20 h-20 rounded-xl bg-slate-800/50 border border-purple-300/20 flex items-center justify-center mb-6 shadow-lg shadow-black/30">
        <Lock className="w-10 h-10 text-slate-300" />
      </div>

      {/* Title & Description */}
      <h2 className="text-2xl font-bold text-white mb-2">Verify Your Identity</h2>
      <p className="text-slate-400/70 text-center mb-8 max-w-sm text-sm leading-relaxed">
        Enter your password to unlock sensitive account settings. This keeps your
        data secure.
      </p>

      {/* Password Input */}
      <div className="w-full max-w-md mb-5">
        <div className="relative mb-2">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={passwordInput}
            onChange={(e) => {
              setPasswordInput(e.target.value);
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                onUnlock();
              }
            }}
            placeholder="Enter your password"
            className={`w-full bg-slate-800/50 border-2 rounded-lg pl-10 pr-10 py-2 text-sm text-white placeholder-slate-500 focus:outline-none transition-all duration-300 ${
              passwordError
                ? 'border-rose-500/50 focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20'
                : 'border-purple-300/20 focus:border-purple-300/40 focus:ring-2 focus:ring-purple-300/10'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {passwordError && (
          <p className="text-rose-400 text-xs mt-1.5 text-center">{passwordError}</p>
        )}
      </div>

      {/* Unlock Button */}
      <button
        onClick={onUnlock}
        disabled={!passwordInput}
        className="w-full max-w-md bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white font-semibold py-2 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-slate-700/40 flex items-center justify-center gap-2 text-sm border border-purple-300/10"
      >
        <Lock size={16} />
        Unlock Account Settings
      </button>
    </div>
  );
}

// Unlocked Account View Component
interface UnlockedAccountViewProps {
  userProfile: UserProfile;
  editingField: EditingField | null;
  editValue: string;
  setEditValue: (value: string) => void;
  startEditField: (field: string, value: any) => void;
  saveEditField: () => void;
  cancelEditField: () => void;
  onLogout: () => void;
}

function UnlockedAccountView({
  userProfile,
  editingField,
  editValue,
  setEditValue,
  startEditField,
  saveEditField,
  cancelEditField,
  onLogout,
}: UnlockedAccountViewProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogoutClick = async () => {
    setIsLoggingOut(true);
    await onLogout();
  };

  return (
    <>
      {/* Account Information Card */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-purple-300/10 rounded-2xl p-6 mb-6 shadow-2xl shadow-black/40 relative overflow-hidden group">
        {/* Ambient Glow Background */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-gradient-to-br from-purple-600/5 to-transparent rounded-full blur-3xl -z-10 group-hover:opacity-75 transition-opacity duration-500" />
        
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-5">
          Account Information
        </h3>

        <div className="space-y-3">
          {/* Email Address (Read-only) */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 border border-purple-300/10">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center text-slate-300 flex-shrink-0 border border-purple-300/10">
                <Mail size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Email Address
                </p>
                <p className="mt-1 text-sm font-medium text-white truncate">
                  {userProfile.email}
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 text-xs font-semibold text-amber-300 bg-amber-500/20 rounded flex-shrink-0 ml-3 border border-purple-300/10">
              Cannot modify
            </span>
          </div>

          {/* Username */}
          <AccountEditField
            icon={User}
            label="USERNAME"
            value={userProfile.username}
            field="username"
            isEditing={editingField?.field === 'username'}
            editValue={editValue}
            setEditValue={setEditValue}
            onEdit={() => startEditField('username', userProfile.username)}
            onSave={saveEditField}
            onCancel={cancelEditField}
          />

          {/* Password */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-all duration-300 border border-purple-300/10 hover:border-purple-300/20">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center text-slate-300 flex-shrink-0 border border-purple-300/10">
                <Lock size={16} />
              </div>

              <div className="flex-1">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Password
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm font-medium text-white">
                    {showPassword
                      ? '••••••••'
                      : '••••••••'}
                  </p>
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff size={14} />
                    ) : (
                      <Eye size={14} />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => startEditField('password', '')}
              className="px-2 py-0.5 text-xs font-medium text-slate-300 bg-slate-700/40 hover:bg-slate-700/60 rounded transition-all duration-300 flex-shrink-0 ml-3 whitespace-nowrap border border-purple-300/10 hover:border-purple-300/20"
            >
              Change Password
            </button>
          </div>
        </div>
      </div>

      {/* Logout Button */}
      <button
        onClick={handleLogoutClick}
        disabled={isLoggingOut}
        className="w-full bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-semibold py-2 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-rose-700/40 text-sm border border-purple-300/10"
      >
        {isLoggingOut ? 'Logging out...' : 'Log Out'}
      </button>
    </>
  );
}

// Account Edit Field Component
interface AccountEditFieldProps {
  icon: React.ComponentType<{ size: number }>;
  label: string;
  value: string;
  field: string;
  isEditing: boolean;
  editValue: string;
  setEditValue: (value: string) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}

function AccountEditField({
  icon: Icon,
  label,
  value,
  field,
  isEditing,
  editValue,
  setEditValue,
  onEdit,
  onSave,
  onCancel,
}: AccountEditFieldProps) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-all duration-300 border border-purple-300/10 hover:border-purple-300/20">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center text-slate-300 flex-shrink-0 border border-purple-300/10">
          <Icon size={16} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {label}
          </p>
          {isEditing ? (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="mt-1 w-full bg-slate-800/50 border border-purple-300/20 rounded-lg px-2 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-300/40 focus:ring-2 focus:ring-purple-300/10 transition-all duration-300"
            />
          ) : (
            <p className="mt-1 text-sm font-medium text-white truncate">{value}</p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
        {isEditing ? (
          <>
            <button
              onClick={onSave}
              className="p-1.5 hover:bg-emerald-500/20 text-emerald-400 rounded transition-all duration-300"
              title="Save"
            >
              <Check size={16} />
            </button>
            <button
              onClick={onCancel}
              className="p-1.5 hover:bg-rose-500/20 text-rose-400 rounded transition-all duration-300"
              title="Cancel"
            >
              <X size={16} />
            </button>
          </>
        ) : (
          <button
            onClick={onEdit}
            className="px-2 py-0.5 text-xs font-medium text-slate-300 bg-slate-700/40 hover:bg-slate-700/60 rounded transition-all duration-300 whitespace-nowrap border border-purple-300/10 hover:border-purple-300/20"
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
}
