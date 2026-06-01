/**
 * EditableProfileField Component
 * 
 * Renders an editable profile field with inline editing, validation error display,
 * and loading states. Provides a complete UX for profile field updates.
 * 
 * Features:
 * - Inline edit mode with focused input
 * - Real-time error feedback below field
 * - Loading indicator during save
 * - Success feedback
 * - Cancel edit functionality
 * - Field-specific validation rules
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useProfileUpdate } from '@/hooks/useProfileUpdate';
import styles from '@/styles/profile-field.module.css';

export interface EditableProfileFieldProps {
  label: string;
  fieldName: string;
  currentValue: string | number | null | undefined;
  placeholder?: string;
  type?: 'text' | 'date' | 'number' | 'select';
  maxLength?: number;
  options?: Array<{ value: string; label: string }>;
  helpText?: string;
  required?: boolean;
  onUpdateSuccess?: (newValue: any) => void;
}

/**
 * EditableProfileField Component
 * 
 * @example
 * <EditableProfileField
 *   label="Full Name"
 *   fieldName="full_name"
 *   currentValue="John Doe"
 *   placeholder="Enter your full name"
 *   maxLength={100}
 *   onUpdateSuccess={(value) => console.log('Updated:', value)}
 * />
 */
export function EditableProfileField({
  label,
  fieldName,
  currentValue,
  placeholder,
  type = 'text',
  maxLength,
  options,
  helpText,
  required = false,
  onUpdateSuccess,
}: EditableProfileFieldProps) {
  // ============ STATE MANAGEMENT ============
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(
    currentValue ? String(currentValue) : ''
  );
  const { updateField, loading, error, success, successMessage, clearError } =
    useProfileUpdate();

  const inputRef = useRef<HTMLInputElement | null>(null);

  // ============ EFFECT HOOKS ============

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  // Reset to current value when exiting edit mode
  useEffect(() => {
    if (!isEditing) {
      setInputValue(currentValue ? String(currentValue) : '');
    }
  }, [currentValue, isEditing]);

  // Auto-dismiss success message
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setIsEditing(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [success]);

  // Clear error when user starts typing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setInputValue(e.target.value);
    if (error) {
      clearError();
    }
  };

  // ============ EVENT HANDLERS ============

  /**
   * Handle save/submit of the field update
   */
  const handleSave = async () => {
    // Validate required field
    if (required && !inputValue.trim()) {
      // The backend will return an error, but show local feedback too
      return;
    }

    const success = await updateField(fieldName, inputValue || null);

    if (success) {
      onUpdateSuccess?.(inputValue);
    }
  };

  /**
   * Handle cancel edit - revert to original value
   */
  const handleCancel = () => {
    setInputValue(currentValue ? String(currentValue) : '');
    setIsEditing(false);
    clearError();
  };

  /**
   * Handle Enter key to save, Escape to cancel
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  // ============ RENDER ============

  const isChanged = inputValue !== (currentValue ? String(currentValue) : '');

  return (
    <div className={styles.profileField}>
      {/* Field Label */}
      <div className={styles.fieldHeader}>
        <label className={styles.fieldLabel}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
        
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className={styles.editButton}
            aria-label={`Edit ${label}`}
            type="button"
          >
            Edit
          </button>
        )}
      </div>

      {/* Display Mode */}
      {!isEditing && (
        <div className={styles.displayValue}>
          <span className={styles.value}>
            {currentValue || <em className={styles.empty}>Not set</em>}
          </span>
        </div>
      )}

      {/* Edit Mode */}
      {isEditing && (
        <div className={styles.editContainer}>
          {/* Input Field */}
          <div className={styles.inputWrapper}>
            {type === 'select' && options ? (
              <select
                ref={inputRef as any}
                value={inputValue}
                onChange={handleInputChange}
                className={`${styles.input} ${error ? styles.inputError : ''}`}
                disabled={loading}
              >
                <option value="">{placeholder || 'Select an option'}</option>
                {options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                ref={inputRef}
                type={type}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                maxLength={maxLength}
                disabled={loading}
                className={`${styles.input} ${error ? styles.inputError : ''}`}
                aria-label={`${label} input`}
                aria-invalid={!!error}
                aria-describedby={error ? `${fieldName}-error` : undefined}
              />
            )}

            {/* Character count for text fields */}
            {maxLength && type !== 'select' && (
              <div className={styles.charCount}>
                {inputValue.length} / {maxLength}
              </div>
            )}
          </div>

          {/* Help Text */}
          {helpText && !error && (
            <p className={styles.helpText}>{helpText}</p>
          )}

          {/* Error Message - CRITICAL FEEDBACK */}
          {error && (
            <div
              className={styles.errorMessage}
              role="alert"
              id={`${fieldName}-error`}
            >
              <span className={styles.errorIcon}>⚠️</span>
              <span className={styles.errorText}>{error.message}</span>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className={styles.successMessage} role="status">
              <span className={styles.successIcon}>✓</span>
              <span className={styles.successText}>{successMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className={styles.actions}>
            <button
              onClick={handleSave}
              disabled={loading || !isChanged || (required && !inputValue.trim())}
              className={`${styles.button} ${styles.saveButton}`}
              type="button"
              aria-label="Save changes"
            >
              {loading ? (
                <>
                  <span className={styles.spinner}></span>
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </button>

            <button
              onClick={handleCancel}
              disabled={loading}
              className={`${styles.button} ${styles.cancelButton}`}
              type="button"
              aria-label="Cancel editing"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default EditableProfileField;
