'use client';

import React, { useMemo } from 'react';
import { User, Check, X } from 'lucide-react';

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

interface ProfileTabProps {
  userProfile: UserProfile;
  editingField: EditingField | null;
  editValue: string;
  setEditValue: (value: string) => void;
  startEditField: (field: string, value: any) => void;
  saveEditField: () => void;
  cancelEditField: () => void;
  isSaving?: boolean;
  saveError?: string | null;
}

export function ProfileTab({
  userProfile,
  editingField,
  editValue,
  setEditValue,
  startEditField,
  saveEditField,
  cancelEditField,
  isSaving = false,
  saveError = null,
}: ProfileTabProps) {
  const getInitials = (fullName: string) => {
    return fullName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  // Word counter for interests
  const wordCount = useMemo(() => {
    const text = editValue.trim();
    if (!text) return 0;
    return text.split(/\s+/).length;
  }, [editValue]);

  const isWordCountExceeded = wordCount >= 500;

  return (
    <div className="min-h-screen flex flex-col items-center justify-start pt-8 pb-8">
      <div className="w-full max-w-2xl px-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Your Profile</h1>
          <p className="text-slate-400/80">
            Manage your personal information and public details
          </p>
        </div>

        {/* Profile Card */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-purple-300/10 rounded-2xl p-6 mb-6 shadow-2xl shadow-black/40 hover:border-purple-300/15 transition-all duration-300 relative overflow-hidden group">
          {/* Ambient Glow Background */}
          <div className="absolute -top-32 -right-32 w-96 h-96 bg-gradient-to-br from-purple-600/5 to-transparent rounded-full blur-3xl -z-10 group-hover:opacity-75 transition-opacity duration-500" />
          
          <div className="flex items-center gap-5">
            {/* Avatar with Hover Upload */}
            <div className="relative group/avatar flex-shrink-0">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-black/50 border border-purple-300/20">
                {getInitials(userProfile.full_name)}
              </div>
              <button className="absolute bottom-0 right-0 bg-slate-700/80 hover:bg-slate-600 text-white p-2 rounded-full shadow-lg transition-all duration-300 opacity-0 group-hover/avatar:opacity-100 transform group-hover/avatar:scale-110 border border-purple-300/20">
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" />
                </svg>
              </button>
            </div>

            {/* Profile Info */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">
                {userProfile.full_name}
              </h2>
              <p className="text-sm text-slate-300/70">{userProfile.email}</p>
            </div>
          </div>
        </div>

        {/* Personal Information Grid */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-purple-300/10 rounded-2xl p-6 shadow-2xl shadow-black/40 relative overflow-hidden group">
          {/* Ambient Glow Background */}
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-gradient-to-br from-purple-600/5 to-transparent rounded-full blur-3xl -z-10 group-hover:opacity-75 transition-opacity duration-500" />
          
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-5">
            Personal Information
          </h3>
          {saveError && (
            <div className="mb-5 p-3 bg-rose-500/20 border border-rose-500/30 rounded-lg">
              <p className="text-sm text-rose-300">{saveError}</p>
            </div>
          )}

          <div className="space-y-3">
            {/* Full Name */}
            <ProfileField
              icon={User}
              label="FULL NAME"
              value={userProfile.full_name}
              field="full_name"
              isEditing={editingField?.field === 'full_name'}
              editValue={editValue}
              setEditValue={setEditValue}
              onEdit={() => startEditField('full_name', userProfile.full_name)}
              onSave={saveEditField}
              onCancel={cancelEditField}
              isSaving={isSaving}
            />

            {/* Birth Year - Date Picker */}
            <BirthYearField
              icon={User}
              label="BIRTH YEAR"
              value={userProfile.birth_year}
              field="birth_year"
              isEditing={editingField?.field === 'birth_year'}
              editValue={editValue}
              setEditValue={setEditValue}
              onEdit={() => startEditField('birth_year', userProfile.birth_year)}
              onSave={saveEditField}
              onCancel={cancelEditField}
              isSaving={isSaving}
            />

            {/* Occupation */}
            <ProfileField
              icon={User}
              label="OCCUPATION"
              value={userProfile.occupation}
              placeholder="Not set"
              field="occupation"
              isEditing={editingField?.field === 'occupation'}
              editValue={editValue}
              setEditValue={setEditValue}
              onEdit={() =>
                startEditField('occupation', userProfile.occupation)
              }
              onSave={saveEditField}
              onCancel={cancelEditField}
              isSaving={isSaving}
            />

            {/* Interests - Expanded Textarea with Word Count */}
            <InterestsField
              icon={User}
              label="INTERESTS"
              value={userProfile.interests}
              field="interests"
              isEditing={editingField?.field === 'interests'}
              editValue={editValue}
              setEditValue={setEditValue}
              wordCount={editingField?.field === 'interests' ? wordCount : 0}
              isWordCountExceeded={isWordCountExceeded}
              onEdit={() => startEditField('interests', userProfile.interests)}
              onSave={saveEditField}
              onCancel={cancelEditField}
              isSaving={isSaving}
            />

            {/* Preferred Language - Select Dropdown */}
            <LanguageField
              icon={User}
              label="PREFERRED LANGUAGE"
              value={userProfile.preferred_language}
              field="preferred_language"
              isEditing={editingField?.field === 'preferred_language'}
              editValue={editValue}
              setEditValue={setEditValue}
              onEdit={() =>
                startEditField(
                  'preferred_language',
                  userProfile.preferred_language
                )
              }
              onSave={saveEditField}
              onCancel={cancelEditField}
              isSaving={isSaving}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Profile Field Component (Default for text inputs)
interface ProfileFieldProps {
  icon: React.ComponentType<{ size: number }>;
  label: string;
  value: string | null | undefined;
  placeholder?: string;
  field: string;
  type?: string;
  isEditing: boolean;
  editValue: string;
  setEditValue: (value: string) => void;
  onEdit: () => void;
  onSave: () => void;
  isSaving?: boolean;
  onCancel: () => void;
}

function ProfileField({
  icon: Icon,
  label,
  value,
  placeholder = 'Not set',
  field,
  type = 'text',
  isEditing,
  editValue,
  setEditValue,
  onEdit,
  onSave,
  isSaving = false,
  onCancel,
}: ProfileFieldProps) {
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
              type={type}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="mt-1 w-full bg-slate-800/50 border border-purple-300/20 rounded-lg px-2 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-300/40 focus:ring-2 focus:ring-purple-300/10 transition-all duration-300"
              placeholder={placeholder}
            />
          ) : (
            <p
              className={`mt-1 text-sm font-medium truncate ${
                value
                  ? 'text-white'
                  : 'text-slate-500 italic'
              }`}
            >
              {value || placeholder}
            </p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
        {isEditing ? (
          <>
            <button
              onClick={onSave}
              disabled={isSaving}
              className="p-1.5 hover:bg-emerald-500/20 text-emerald-400 rounded transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Save"
            >
              <Check size={16} />
            </button>
            <button
              onClick={onCancel}
              disabled={isSaving}
              className="p-1.5 hover:bg-rose-500/20 text-rose-400 rounded transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
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

// Birth Year Field Component - Date Picker
interface BirthYearFieldProps {
  icon: React.ComponentType<{ size: number }>;
  label: string;
  value: number | null | undefined;
  field: string;
  isEditing: boolean;
  editValue: string;
  setEditValue: (value: string) => void;
  onEdit: () => void;
  onSave: () => void;
  isSaving?: boolean;
  onCancel: () => void;
}

function BirthYearField({
  icon: Icon,
  label,
  value,
  field,
  isEditing,
  editValue,
  setEditValue,
  onEdit,
  onSave,
  isSaving = false,
  onCancel,
}: BirthYearFieldProps) {
  const displayValue = value ? value.toString() : null;

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
              type="date"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="mt-1 w-full bg-slate-800/50 border border-purple-300/20 rounded-lg px-2 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-300/40 focus:ring-2 focus:ring-purple-300/10 transition-all duration-300 cursor-pointer"
            />
          ) : (
            <p
              className={`mt-1 text-sm font-medium ${
                displayValue
                  ? 'text-white'
                  : 'text-slate-500 italic'
              }`}
            >
              {displayValue || 'Not set'}
            </p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
        {isEditing ? (
          <>
            <button
              onClick={onSave}
              disabled={isSaving}
              className="p-1.5 hover:bg-emerald-500/20 text-emerald-400 rounded transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Save"
            >
              <Check size={16} />
            </button>
            <button
              onClick={onCancel}
              disabled={isSaving}
              className="p-1.5 hover:bg-rose-500/20 text-rose-400 rounded transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
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

// Interests Field Component - Expanded Textarea with Word Counter
interface InterestsFieldProps {
  icon: React.ComponentType<{ size: number }>;
  label: string;
  value: string | null | undefined;
  field: string;
  isEditing: boolean;
  editValue: string;
  setEditValue: (value: string) => void;
  wordCount: number;
  isWordCountExceeded: boolean;
  onEdit: () => void;
  onSave: () => void;
  isSaving?: boolean;
  onCancel: () => void;
}

function InterestsField({
  icon: Icon,
  label,
  value,
  field,
  isEditing,
  editValue,
  setEditValue,
  wordCount,
  isWordCountExceeded,
  onEdit,
  onSave,
  isSaving = false,
  onCancel,
}: InterestsFieldProps) {
  return (
    <div className="p-3 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-all duration-300 border border-purple-300/10 hover:border-purple-300/20">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center text-slate-300 flex-shrink-0 border border-purple-300/10 mt-3">
            <Icon size={16} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {label}
            </p>
            {isEditing ? (
              <div className="mt-2 relative">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className={`w-full h-24 bg-slate-800/50 border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all duration-300 resize-none ${
                    isWordCountExceeded
                      ? 'border-rose-500/40 focus:border-rose-500/60 focus:ring-rose-300/10'
                      : 'border-purple-300/20 focus:border-purple-300/40 focus:ring-purple-300/10'
                  }`}
                  placeholder="Enter your interests (hobbies, keywords, etc.)"
                />
                <div className={`absolute bottom-2 right-2 text-xs font-medium ${
                  isWordCountExceeded
                    ? 'text-rose-400'
                    : 'text-slate-400'
                }`}>
                  {wordCount} / 500 words
                </div>
              </div>
            ) : (
              <p
                className={`mt-1 text-sm font-medium whitespace-pre-wrap break-words ${
                  value
                    ? 'text-white'
                    : 'text-slate-500 italic'
                }`}
              >
                {value || 'Not set'}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
          {isEditing ? (
            <>
              <button
                onClick={onSave}
                disabled={isSaving || isWordCountExceeded}
                className="p-1.5 hover:bg-emerald-500/20 text-emerald-400 rounded transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                title={isWordCountExceeded ? "Word count exceeded" : "Save"}
              >
                <Check size={16} />
              </button>
              <button
                onClick={onCancel}
                disabled={isSaving}
                className="p-1.5 hover:bg-rose-500/20 text-rose-400 rounded transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
  );
}

// Preferred Language Field Component - Select Dropdown
interface LanguageFieldProps {
  icon: React.ComponentType<{ size: number }>;
  label: string;
  value: string | null | undefined;
  field: string;
  isEditing: boolean;
  editValue: string;
  setEditValue: (value: string) => void;
  onEdit: () => void;
  onSave: () => void;
  isSaving?: boolean;
  onCancel: () => void;
}

const LANGUAGE_OPTIONS = [
  { code: 'vi', name: 'Vietnamese (Tiếng Việt)' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: 'Japanese (日本語)' },
];

function LanguageField({
  icon: Icon,
  label,
  value,
  field,
  isEditing,
  editValue,
  setEditValue,
  onEdit,
  onSave,
  isSaving = false,
  onCancel,
}: LanguageFieldProps) {
  const displayValue = value
    ? LANGUAGE_OPTIONS.find((opt) => opt.code === value)?.name || value
    : null;

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
            <select
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="mt-1 w-full bg-slate-800/50 border border-purple-300/20 rounded-lg px-2 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-300/40 focus:ring-2 focus:ring-purple-300/10 transition-all duration-300 cursor-pointer"
            >
              <option value="">-- Select Language --</option>
              {LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          ) : (
            <p
              className={`mt-1 text-sm font-medium truncate ${
                displayValue
                  ? 'text-white'
                  : 'text-slate-500 italic'
              }`}
            >
              {displayValue || 'Not set'}
            </p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
        {isEditing ? (
          <>
            <button
              onClick={onSave}
              disabled={isSaving}
              className="p-1.5 hover:bg-emerald-500/20 text-emerald-400 rounded transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Save"
            >
              <Check size={16} />
            </button>
            <button
              onClick={onCancel}
              disabled={isSaving}
              className="p-1.5 hover:bg-rose-500/20 text-rose-400 rounded transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
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