import { useEffect, useState } from 'react';

export interface UserAuth {
  isAuthenticated: boolean;
  userId: string | null;
  username: string | null;
  email: string | null;
  displayName: string | null;
}

/**
 * Hook to check authentication status and get user info from localStorage
 */
export function useAuth(): UserAuth {
  const [auth, setAuth] = useState<UserAuth>({
    isAuthenticated: false,
    userId: null,
    username: null,
    email: null,
    displayName: null,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const userId = window.localStorage.getItem('user_id');
    const displayName = window.localStorage.getItem('user_display_name');
    const email = window.localStorage.getItem('user_email');
    const sessionToken = window.localStorage.getItem('session_token');

    const isValid = userId && userId.trim() && userId !== 'anonymous' && sessionToken;

    console.log('[useAuth] Current authentication state:', {
      userId: userId,
      displayName: displayName,
      email: email,
      hasSessionToken: !!sessionToken,
      isAuthenticated: !!isValid,
    });

    setAuth({
      isAuthenticated: !!isValid,
      userId: userId || null,
      username: displayName || null,
      email: email || null,
      displayName: displayName || null,
    });
  }, []);

  return auth;
}
