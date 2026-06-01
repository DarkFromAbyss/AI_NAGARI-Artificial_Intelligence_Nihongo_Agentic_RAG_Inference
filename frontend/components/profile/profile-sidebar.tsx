'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { LogOut, User, Settings } from 'lucide-react';

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

interface ProfileSidebarProps {
  activeTab: 'profile' | 'account';
  onTabChange: (tab: 'profile' | 'account') => void;
  userProfile: UserProfile;
  onLogout: () => void;
}

export function ProfileSidebar({
  activeTab,
  onTabChange,
  userProfile,
  onLogout,
}: ProfileSidebarProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogoutClick = async () => {
    setIsLoggingOut(true);
    await onLogout();
  };

  const getInitials = (fullName: string) => {
    return fullName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  return (
    <aside className="w-56 bg-slate-900/50 backdrop-blur-xl border-r border-purple-300/10 flex flex-col shadow-2xl shadow-black/40 relative overflow-hidden">
      {/* Ambient Glow Background */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-br from-purple-600/5 to-transparent rounded-full blur-3xl -z-10" />
      
      {/* Header */}
      <div className="p-6 border-b border-purple-300/10">
        {/* NARAGI Logo */}
        <Link
          href="/"
          className="group flex items-center gap-2 p-2 -ml-2 mb-6 rounded-lg hover:bg-slate-800/50 transition-all duration-300"
        >
          <span className="text-lg font-bold bg-gradient-to-r from-slate-300 to-slate-100 bg-clip-text text-transparent">
            NARAGI
          </span>
        </Link>

        {/* User Avatar & Info */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-slate-700/50 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 border border-purple-300/20">
            {getInitials(userProfile.full_name)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {userProfile.full_name}
            </p>
            <p className="text-xs text-slate-400/60 truncate">
              {userProfile.email}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-400/50 uppercase tracking-wider px-3 py-2">
          Navigation
        </p>

        {/* Profile Tab Button */}
        <button
          onClick={() => onTabChange('profile')}
          className="w-full transition-all duration-300 ease-in-out"
        >
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ease-in-out ${
              activeTab === 'profile'
                ? 'bg-gradient-to-r from-slate-700 to-slate-600 text-white shadow-lg shadow-slate-700/30 transform translate-x-2 border border-purple-300/20'
                : 'text-slate-300 bg-slate-800/30 hover:bg-slate-800/50 shadow-md hover:shadow-lg hover:shadow-slate-700/20 border border-purple-300/10 hover:border-purple-300/15'
            }`}
          >
            <User size={18} className="flex-shrink-0" />
            <div className="text-left min-w-0">
              <p className="text-sm font-semibold">Profile</p>
              <p
                className={`text-xs truncate ${
                  activeTab === 'profile'
                    ? 'text-slate-100'
                    : 'text-slate-400/70'
                }`}
              >
                Personal info
              </p>
            </div>
          </div>
        </button>

        {/* Account Tab Button */}
        <button
          onClick={() => onTabChange('account')}
          className="w-full transition-all duration-300 ease-in-out"
        >
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ease-in-out ${
              activeTab === 'account'
                ? 'bg-gradient-to-r from-slate-700 to-slate-600 text-white shadow-lg shadow-slate-700/30 transform translate-x-2 border border-purple-300/20'
                : 'text-slate-300 bg-slate-800/30 hover:bg-slate-800/50 shadow-md hover:shadow-lg hover:shadow-slate-700/20 border border-purple-300/10 hover:border-purple-300/15'
            }`}
          >
            <Settings size={18} className="flex-shrink-0" />
            <div className="text-left min-w-0">
              <p className="text-sm font-semibold">Account</p>
              <p
                className={`text-xs truncate ${
                  activeTab === 'account'
                    ? 'text-slate-100'
                    : 'text-slate-400/70'
                }`}
              >
                Security settings
              </p>
            </div>
          </div>
        </button>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-purple-300/10 space-y-3">
        <button
          onClick={handleLogoutClick}
          disabled={isLoggingOut}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-rose-700/40 border border-purple-300/10"
        >
          <LogOut size={18} />
          {isLoggingOut ? 'Logging out...' : 'Log Out'}
        </button>

        <div className="text-center">
          <p className="text-xs text-slate-400/50">Profile Manager</p>
          <p className="text-xs text-slate-500/30">v1.0</p>
        </div>
      </div>
    </aside>
  );
}
