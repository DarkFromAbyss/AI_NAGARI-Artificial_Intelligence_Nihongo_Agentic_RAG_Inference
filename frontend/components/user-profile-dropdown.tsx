'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { LogOut, Settings, User } from 'lucide-react';
import './user-profile-dropdown.css';

interface UserProfileDropdownProps {
  isAuthenticated?: boolean;
  userName?: string;
  userAvatar?: string | null;
  onLogout?: () => void;
  isModelActive?: boolean;
}

export function UserProfileDropdown({
  isAuthenticated = false,
  userName = 'Guest',
  userAvatar = null,
  onLogout,
  isModelActive = false,
}: UserProfileDropdownProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }

    // Add event listener only when dropdown is open
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDropdownOpen(!isDropdownOpen);
  };

  const closeDropdown = () => {
    setIsDropdownOpen(false);
  };

  const handleLogout = async () => {
    closeDropdown();

    // Grab token first for best-effort backend logout
    const token = (() => {
      try {
        return window.localStorage.getItem('session_token');
      } catch {
        return null;
      }
    })();

    // Clear local auth state immediately
    try {
      window.localStorage.removeItem('session_token');
      window.localStorage.removeItem('user_display_name');
      window.localStorage.removeItem('user_email');
    } catch {
      // ignore
    }

    // Note: token might already be removed above; keep request best-effort and non-blocking.
    if (token) {
      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/auth/logout`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_token: token }),
          }
        );
      } catch (e) {
        console.warn('[Logout] backend logout request failed:', e);
      }
    }

    if (onLogout) {
      onLogout();
    }

    // Hard refresh to ensure header reverts instantly
    window.location.href = '/';
  };


  return (
    <>
      {/* User profile dropdown - Displays in both Model ON and Model OFF states */}
      <div className="user-profile-dropdown-container" ref={dropdownRef}>
        {/* User Profile Button - Horizontal Rectangle */}
        <button
          className="user-profile-btn"
          onClick={toggleDropdown}
          aria-label="User profile menu"
          aria-expanded={isDropdownOpen}
        >
          {/* Left side: Username text */}
          <span className="user-name-text">
            {isAuthenticated ? userName.split(' ')[0] : 'Guest'}
          </span>

          {/* Right side: Avatar/Logo */}
          {userAvatar && isAuthenticated ? (
            <img
              src={userAvatar}
              alt={userName}
              className="user-avatar-image"
            />
          ) : (
            <div className="user-avatar-placeholder">
              <User size={20} />
            </div>
          )}
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div className="user-dropdown-menu">
            {isAuthenticated ? (
              <>
                {/* Authenticated User Menu */}
                <div className="dropdown-header">
                  <div className="user-info">
                    {userAvatar ? (
                      <img
                        src={userAvatar}
                        alt={userName}
                        className="dropdown-avatar"
                      />
                    ) : (
                      <div className="dropdown-avatar-placeholder">
                        <User size={24} />
                      </div>
                    )}
                    <div className="user-details">
                      <p className="user-name-full">{userName}</p>
                      <p className="user-status">Logged in</p>
                    </div>
                  </div>
                </div>

                <hr className="dropdown-divider" />

                <Link
                  href="/profile"
                  className="dropdown-menu-item"
                  onClick={closeDropdown}
                >
                  <Settings size={16} />
                  <span>Profile Settings</span>
                </Link>

                <button
                  className="dropdown-menu-item logout-item"
                  onClick={handleLogout}
                >
                  <LogOut size={16} />
                  <span>Log Out</span>
                </button>
              </>
            ) : (
              <>
                {/* Guest User Menu */}
                <div className="dropdown-header guest">
                  <div className="guest-avatar-placeholder">
                    <User size={28} />
                  </div>
                  <p className="guest-text">Welcome, Guest!</p>
                </div>

                <hr className="dropdown-divider" />

                <Link
                  href="/login"
                  className="dropdown-menu-item login-item"
                  onClick={closeDropdown}
                >
                  <span>Log In</span>
                </Link>

                <Link
                  href="/register"
                  className="dropdown-menu-item signup-item"
                  onClick={closeDropdown}
                >
                  <span>Sign Up</span>
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}