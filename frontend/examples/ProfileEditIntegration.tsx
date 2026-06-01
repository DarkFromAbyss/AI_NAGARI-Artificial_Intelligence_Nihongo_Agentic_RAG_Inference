/**
 * INTEGRATION EXAMPLE: Complete Profile Edit Workflow
 * 
 * This file demonstrates how all the components work together to provide
 * a complete, production-ready profile editing experience.
 * 
 * Copy and adapt this code to your profile page implementation.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import EditableProfileField from '@/components/EditableProfileField';
import { useProfileUpdate } from '@/hooks/useProfileUpdate';

/**
 * ============ EXAMPLE 1: Simple Integration ============
 * 
 * Minimal implementation showing basic usage
 */
export function SimpleProfileEditExample() {
  const [profile, setProfile] = useState<any>(null);
  const { updateField, error, loading, clearError } = useProfileUpdate();

  const handleUpdate = async (fieldName: string, value: string) => {
    const success = await updateField(fieldName, value);
    if (success) {
      // Update local state
      setProfile((prev: any) => ({
        ...prev,
        [fieldName]: value,
      }));
    }
  };

  return (
    <div>
      <EditableProfileField
        label="Full Name"
        fieldName="full_name"
        currentValue={profile?.full_name}
        onUpdateSuccess={(value) => handleUpdate('full_name', value)}
      />
    </div>
  );
}

/**
 * ============ EXAMPLE 2: Advanced Integration with Error Handling ============
 * 
 * Complete implementation with error recovery and user feedback
 */
export function AdvancedProfileEditExample() {
  const [profile, setProfile] = useState<any>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const { updateField, error, loading, success } = useProfileUpdate();

  // Handle field updates with proper error recovery
  const handleFieldUpdate = useCallback(
    async (fieldName: string, value: string) => {
      setGlobalError(null);

      try {
        const success = await updateField(fieldName, value);

        if (success) {
          setProfile((prev: any) => ({
            ...prev,
            [fieldName]: value,
          }));

          // Optional: Show global success notification
          console.log(`✓ ${fieldName} updated successfully`);
        } else if (error) {
          // Field-level error will be shown in component
          console.error(`✗ Failed to update ${fieldName}:`, error.message);
        }
      } catch (err) {
        setGlobalError(
          err instanceof Error ? err.message : 'An unexpected error occurred'
        );
      }
    },
    [updateField, error]
  );

  // List of all editable fields
  const editableFields = [
    {
      label: 'Full Name',
      fieldName: 'full_name',
      type: 'text' as const,
      maxLength: 100,
      helpText: 'Your first and last name',
    },
    {
      label: 'Birth Year',
      fieldName: 'birth_year',
      type: 'text' as const,
      helpText: 'Format: YYYY, DD/MM/YYYY, or YYYY-MM-DD',
    },
    {
      label: 'Occupation',
      fieldName: 'occupation',
      type: 'text' as const,
      maxLength: 100,
      helpText: 'Your current job or role',
    },
    {
      label: 'Interests',
      fieldName: 'interests',
      type: 'text' as const,
      maxLength: 500,
      helpText: 'Your interests (comma-separated)',
    },
    {
      label: 'Preferred Language',
      fieldName: 'preferred_language',
      type: 'select' as const,
      options: [
        { value: 'en', label: 'English' },
        { value: 'vi', label: 'Tiếng Việt (Vietnamese)' },
        { value: 'ja', label: '日本語 (Japanese)' },
      ],
    },
  ];

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem' }}>
      <h1>Edit Your Profile</h1>

      {globalError && (
        <div
          style={{
            padding: '1rem',
            marginBottom: '1rem',
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            borderRadius: '0.5rem',
          }}
        >
          {globalError}
        </div>
      )}

      {editableFields.map((field) => (
        <div key={field.fieldName} style={{ marginBottom: '1.5rem' }}>
          <EditableProfileField
            label={field.label}
            fieldName={field.fieldName}
            currentValue={profile?.[field.fieldName]}
            type={field.type}
            maxLength={field.maxLength}
            helpText={field.helpText}
            options={field.options}
            onUpdateSuccess={(value) =>
              handleFieldUpdate(field.fieldName, value)
            }
          />
        </div>
      ))}
    </div>
  );
}

/**
 * ============ EXAMPLE 3: With Local Optimistic Updates ============
 * 
 * Shows the value immediately while update is in progress
 */
export function OptimisticUpdateExample() {
  const [profile, setProfile] = useState<any>(null);
  const [optimisticValues, setOptimisticValues] = useState<Record<string, any>>({});
  const { updateField, error, loading } = useProfileUpdate();

  const handleOptimisticUpdate = async (fieldName: string, value: string) => {
    // Show value immediately
    setOptimisticValues((prev) => ({
      ...prev,
      [fieldName]: value,
    }));

    // Send to server
    const success = await updateField(fieldName, value);

    if (success) {
      // Update persisted state
      setProfile((prev: any) => ({
        ...prev,
        [fieldName]: value,
      }));
      // Clear optimistic value
      setOptimisticValues((prev) => {
        const newState = { ...prev };
        delete newState[fieldName];
        return newState;
      });
    } else {
      // Revert optimistic value on error
      setOptimisticValues((prev) => {
        const newState = { ...prev };
        delete newState[fieldName];
        return newState;
      });
    }
  };

  const displayValue = (fieldName: string) => {
    return optimisticValues[fieldName] ?? profile?.[fieldName];
  };

  return (
    <div>
      <EditableProfileField
        label="Full Name"
        fieldName="full_name"
        currentValue={displayValue('full_name')}
        onUpdateSuccess={(value) => handleOptimisticUpdate('full_name', value)}
      />
    </div>
  );
}

/**
 * ============ EXAMPLE 4: With Form Validation Before Submit ============
 * 
 * Validates input on the client before sending to server
 */
export function ClientSideValidationExample() {
  const [profile, setProfile] = useState<any>(null);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const { updateField } = useProfileUpdate();

  // Client-side validation rules (mirrors backend rules)
  const validateField = (fieldName: string, value: string): string | null => {
    switch (fieldName) {
      case 'full_name':
        if (!value.trim()) return 'Full name cannot be empty';
        if (value.length > 100) return 'Full name must be 100 characters or less';
        return null;

      case 'birth_year': {
        if (!value) return null; // Optional field
        const yearRegex = /^\d{4}(-\d{2}-\d{2})?$|^\d{2}\/\d{2}\/\d{4}$/;
        if (!yearRegex.test(value)) {
          return 'Birth year must be in format YYYY, DD/MM/YYYY, or YYYY-MM-DD';
        }
        return null;
      }

      case 'occupation':
        if (value.length > 100) return 'Occupation must be 100 characters or less';
        return null;

      case 'interests':
        if (value.length > 500) return 'Interests must be 500 characters or less';
        return null;

      default:
        return null;
    }
  };

  const handleFieldUpdate = async (fieldName: string, value: string) => {
    // Validate client-side first
    const validationError = validateField(fieldName, value);
    if (validationError) {
      setLocalErrors((prev) => ({
        ...prev,
        [fieldName]: validationError,
      }));
      return;
    }

    // Clear local error
    setLocalErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });

    // Send to server
    const success = await updateField(fieldName, value);
    if (success) {
      setProfile((prev: any) => ({
        ...prev,
        [fieldName]: value,
      }));
    }
  };

  return (
    <div>
      <EditableProfileField
        label="Full Name"
        fieldName="full_name"
        currentValue={profile?.full_name}
        onUpdateSuccess={(value) => handleFieldUpdate('full_name', value)}
      />
    </div>
  );
}

/**
 * ============ EXAMPLE 5: With Undo/Redo History ============
 * 
 * Tracks change history and allows reverting
 */
interface HistoryEntry {
  fieldName: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
  success: boolean;
}

export function UndoRedoExample() {
  const [profile, setProfile] = useState<any>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const { updateField } = useProfileUpdate();

  const handleFieldUpdate = async (fieldName: string, newValue: string) => {
    const oldValue = profile?.[fieldName];

    const success = await updateField(fieldName, newValue);

    if (success) {
      // Add to history
      setHistory((prev) =>
        prev.slice(0, historyIndex + 1) // Remove redo history
      );

      const entry: HistoryEntry = {
        fieldName,
        oldValue,
        newValue,
        timestamp: new Date(),
        success: true,
      };

      setHistory((prev) => [...prev, entry]);
      setHistoryIndex((prev) => prev + 1);

      // Update local state
      setProfile((prev: any) => ({
        ...prev,
        [fieldName]: newValue,
      }));
    }
  };

  const undo = () => {
    if (historyIndex > 0) {
      const entry = history[historyIndex];
      setProfile((prev: any) => ({
        ...prev,
        [entry.fieldName]: entry.oldValue,
      }));
      setHistoryIndex((prev) => prev - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const entry = history[historyIndex + 1];
      setProfile((prev: any) => ({
        ...prev,
        [entry.fieldName]: entry.newValue,
      }));
      setHistoryIndex((prev) => prev + 1);
    }
  };

  return (
    <div>
      <div>
        <button onClick={undo} disabled={historyIndex <= 0}>
          Undo
        </button>
        <button onClick={redo} disabled={historyIndex >= history.length - 1}>
          Redo
        </button>
      </div>

      <EditableProfileField
        label="Full Name"
        fieldName="full_name"
        currentValue={profile?.full_name}
        onUpdateSuccess={(value) => handleFieldUpdate('full_name', value)}
      />
    </div>
  );
}

export default SimpleProfileEditExample;
