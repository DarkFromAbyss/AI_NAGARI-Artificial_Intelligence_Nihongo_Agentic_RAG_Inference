/**
 * useProfileUpdate Hook
 * 
 * Manages individual profile field updates with validation error handling.
 * Provides real-time error feedback and loading states for each field.
 * 
 * Features:
 * - Field-specific error tracking
 * - Loading state management per field
 * - Server-side validation error display
 * - Automatic error clearing on retry
 * - TypeScript-first implementation
 */

'use client';

import { useState, useCallback } from 'react';

export interface ProfileUpdateError {
  field: string;
  message: string;
  details?: Record<string, any>;
}

export interface ProfileUpdateState {
  loading: boolean;
  error: ProfileUpdateError | null;
  success: boolean;
  successMessage: string | null;
}

interface UpdateProfileFieldResponse {
  success: boolean;
  message: string;
  error?: string;
  field?: string;
  details?: Record<string, any>;
  data?: {
    field_updated?: string;
    new_value?: any;
    [key: string]: any;
  };
}

/**
 * Hook for managing profile field updates
 * 
 * @returns Object containing update function, state, and utilities
 * 
 * @example
 * const { updateField, loading, error, clearError } = useProfileUpdate();
 * 
 * const handleSaveName = async () => {
 *   await updateField('full_name', inputValue);
 * };
 */
export function useProfileUpdate() {
  const [state, setState] = useState<ProfileUpdateState>({
    loading: false,
    error: null,
    success: false,
    successMessage: null,
  });

  /**
   * Clear error state (when user starts typing again)
   */
  const clearError = useCallback(() => {
    setState((prev) => ({
      ...prev,
      error: null,
    }));
  }, []);

  /**
   * Clear success message after auto-dismiss
   */
  const clearSuccess = useCallback(() => {
    setState((prev) => ({
      ...prev,
      success: false,
      successMessage: null,
    }));
  }, []);

  /**
   * Update a profile field via API
   * 
   * @param field - Field name (e.g., 'full_name', 'birth_year')
   * @param value - New value for the field
   * @throws Will not throw; errors are stored in state
   */
  const updateField = useCallback(
    async (field: string, value: string | null): Promise<boolean> => {
      // Clear previous errors on new attempt
      clearError();

      // Validate input
      if (!field) {
        setState((prev) => ({
          ...prev,
          error: {
            field: 'general',
            message: 'Invalid field name',
          },
        }));
        return false;
      }

      setState((prev) => ({
        ...prev,
        loading: true,
      }));

      try {
        // Get session token from localStorage or auth context
        const sessionToken = localStorage.getItem('session_token');
        if (!sessionToken) {
          throw new Error('No session token found');
        }

        const response = await fetch('/api/profile', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            field,
            value,
          }),
        });

        const data: UpdateProfileFieldResponse = await response.json();

        // ============ ERROR HANDLING ============
        if (!response.ok || !data.success) {
          const errorMessage = data.error || 'Failed to update profile field';
          const errorField = data.field || field;

          setState((prev) => ({
            ...prev,
            loading: false,
            error: {
              field: errorField,
              message: errorMessage,
              details: data.details,
            },
            success: false,
          }));

          console.error(
            `[Profile Update] Error updating ${errorField}: ${errorMessage}`
          );
          return false;
        }

        // ============ SUCCESS ============
        setState((prev) => ({
          ...prev,
          loading: false,
          success: true,
          successMessage: data.message || `${field} updated successfully`,
          error: null,
        }));

        console.log(`[Profile Update] Successfully updated ${field}`);

        // Auto-dismiss success after 3 seconds
        const timer = setTimeout(() => {
          clearSuccess();
        }, 3000);

        return true;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred';

        setState((prev) => ({
          ...prev,
          loading: false,
          error: {
            field,
            message: errorMessage,
          },
          success: false,
        }));

        console.error(
          `[Profile Update] Unexpected error updating ${field}:`,
          error
        );
        return false;
      }
    },
    [clearError, clearSuccess]
  );

  return {
    updateField,
    loading: state.loading,
    error: state.error,
    success: state.success,
    successMessage: state.successMessage,
    clearError,
    clearSuccess,
  };
}
