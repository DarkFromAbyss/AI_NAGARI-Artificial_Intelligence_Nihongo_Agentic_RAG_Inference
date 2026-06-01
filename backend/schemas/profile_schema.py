"""Pydantic schemas for profile field validation and updates."""

from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime
import re
from html import escape


class ProfileFieldUpdate(BaseModel):
    """Schema for updating a single profile field with validation.
    
    Validates the field name and value before sending to database.
    """
    model_config = ConfigDict(str_strip_whitespace=True)

    field: str = Field(
        ...,
        description="Field name (full_name, birth_year, occupation, interests, preferred_language)"
    )
    value: Optional[str] = Field(
        None,
        description="New value for the field (can be None to clear the field)"
    )

    @field_validator('field', mode='after')
    @classmethod
    def validate_field_name(cls, v: str) -> str:
        """Validate that field name is one of the allowed profile fields."""
        allowed_fields = {
            'full_name',
            'birth_year',
            'occupation',
            'interests',
            'preferred_language'
        }
        if v not in allowed_fields:
            raise ValueError(
                f"Invalid field '{v}'. Allowed fields are: {', '.join(sorted(allowed_fields))}"
            )
        return v


class ProfileUpdateResponse(BaseModel):
    """Response after successful profile field update."""
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None


class ProfileValidationError(BaseModel):
    """Error response from profile validation failure."""
    success: bool = False
    error: str
    field: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


# ============ Field-Specific Validators ============

class FieldValidator:
    """Centralized validation logic for each profile field."""

    # Field constraints
    CONSTRAINTS = {
        'full_name': {
            'max_length': 100,
            'min_length': 1,
            'description': 'Full name'
        },
        'birth_year': {
            'min_year': 1900,
            'max_year': datetime.now().year - 10,  # Minimum age: 10 years
            'description': 'Birth year'
        },
        'occupation': {
            'max_length': 100,
            'description': 'Occupation'
        },
        'interests': {
            'max_length': 500,
            'description': 'Interests'
        },
        'preferred_language': {
            'max_length': 10,
            'allowed_values': ['en', 'vi', 'ja'],
            'description': 'Preferred language'
        }
    }

    # Regex pattern for detecting dangerous characters/scripts
    DANGEROUS_PATTERN = re.compile(
        r'<script|javascript:|onerror=|onload=|<iframe|<embed|<object|<svg',
        re.IGNORECASE
    )

    @staticmethod
    def validate_full_name(value: Optional[str]) -> Optional[str]:
        """Validate and sanitize full name.
        
        Args:
            value: Full name to validate
            
        Returns:
            Validated and sanitized full name
            
        Raises:
            ValueError: If validation fails
        """
        from exceptions import InvalidFullNameError

        if value is None:
            return None

        # Strip whitespace
        value = str(value).strip()

        # Check empty
        if not value:
            raise InvalidFullNameError(
                "Full name cannot be empty or contain invalid characters."
            )

        # Check length
        max_len = FieldValidator.CONSTRAINTS['full_name']['max_length']
        if len(value) > max_len:
            raise InvalidFullNameError(
                f"Full name exceeds maximum length of {max_len} characters."
            )

        # Check for dangerous patterns
        if FieldValidator.DANGEROUS_PATTERN.search(value):
            raise InvalidFullNameError(
                "Full name cannot contain invalid or script-like characters."
            )

        # Check for valid character ranges (alphanumeric, spaces, common punctuation)
        if not re.match(r"^[\w\s\-\.,'àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđñ]+$", value, re.UNICODE):
            raise InvalidFullNameError(
                "Full name contains invalid characters."
            )

        return value

    @staticmethod
    def validate_birth_year(value: Optional[str]) -> Optional[int]:
        """Validate and parse birth year from various date formats.
        
        Accepts:
        - DD/MM/YYYY format
        - YYYY-MM-DD format
        - YYYY format (direct year)
        
        Args:
            value: Birth year/date string to parse
            
        Returns:
            4-digit year as integer
            
        Raises:
            InvalidBirthYearError: If format is invalid or year is unrealistic
        """
        from exceptions import InvalidBirthYearError

        if value is None:
            return None

        value = str(value).strip()

        if not value:
            return None

        year = None

        # Try parsing DD/MM/YYYY format
        if '/' in value:
            parts = value.split('/')
            if len(parts) == 3:
                try:
                    day, month, year_str = parts
                    year = int(year_str)
                except (ValueError, IndexError):
                    pass

        # Try parsing YYYY-MM-DD format
        elif '-' in value:
            parts = value.split('-')
            if len(parts) == 3:
                try:
                    year_str = parts[0]
                    year = int(year_str)
                except (ValueError, IndexError):
                    pass

        # Try parsing as direct year (YYYY format)
        elif value.isdigit() and len(value) == 4:
            try:
                year = int(value)
            except ValueError:
                pass

        # Validation failed - couldn't parse
        if year is None:
            raise InvalidBirthYearError()

        # Validate year is within realistic range
        min_year = FieldValidator.CONSTRAINTS['birth_year']['min_year']
        max_year = FieldValidator.CONSTRAINTS['birth_year']['max_year']

        if year < min_year or year > max_year:
            raise InvalidBirthYearError(
                f"Birth year must be between {min_year} and {max_year}."
            )

        return year

    @staticmethod
    def validate_occupation(value: Optional[str]) -> Optional[str]:
        """Validate and sanitize occupation field.
        
        Args:
            value: Occupation to validate
            
        Returns:
            Validated and sanitized occupation
            
        Raises:
            ValueError: If validation fails
        """
        from exceptions import FieldTooLongError

        if value is None:
            return None

        value = str(value).strip()

        if not value:
            return None

        # Check length
        max_len = FieldValidator.CONSTRAINTS['occupation']['max_length']
        if len(value) > max_len:
            raise FieldTooLongError(
                field='occupation',
                max_length=max_len
            )

        # Check for dangerous patterns
        if FieldValidator.DANGEROUS_PATTERN.search(value):
            raise ValueError("Occupation contains invalid characters.")

        # HTML encode to prevent XSS
        value = escape(value)

        return value

    @staticmethod
    def validate_interests(value: Optional[str]) -> Optional[str]:
        """Validate and sanitize interests field.
        
        Args:
            value: Interests to validate (comma-separated or free text)
            
        Returns:
            Validated and sanitized interests
            
        Raises:
            ValueError: If validation fails
        """
        from exceptions import FieldTooLongError

        if value is None:
            return None

        value = str(value).strip()

        if not value:
            return None

        # Check length
        max_len = FieldValidator.CONSTRAINTS['interests']['max_length']
        if len(value) > max_len:
            raise FieldTooLongError(
                field='interests',
                max_length=max_len
            )

        # Check for dangerous patterns
        if FieldValidator.DANGEROUS_PATTERN.search(value):
            raise ValueError("Interests contain invalid characters.")

        # HTML encode to prevent XSS
        value = escape(value)

        return value

    @staticmethod
    def validate_preferred_language(value: Optional[str]) -> Optional[str]:
        """Validate preferred language code.
        
        Args:
            value: Language code to validate
            
        Returns:
            Validated language code
            
        Raises:
            ValueError: If language code is invalid
        """
        if value is None:
            return None

        value = str(value).strip().lower()

        if not value:
            return None

        allowed = FieldValidator.CONSTRAINTS['preferred_language']['allowed_values']
        if value not in allowed:
            raise ValueError(
                f"Invalid language code. Allowed values: {', '.join(allowed)}"
            )

        return value

    @staticmethod
    def validate_field(field: str, value: Optional[str]) -> Optional[Any]:
        """Validate a profile field using appropriate validator.
        
        Args:
            field: Field name
            value: Field value to validate
            
        Returns:
            Validated and sanitized value
            
        Raises:
            ValueError or custom ValidationError: If validation fails
        """
        from exceptions import InvalidFieldError

        validators = {
            'full_name': FieldValidator.validate_full_name,
            'birth_year': FieldValidator.validate_birth_year,
            'occupation': FieldValidator.validate_occupation,
            'interests': FieldValidator.validate_interests,
            'preferred_language': FieldValidator.validate_preferred_language,
        }

        if field not in validators:
            raise InvalidFieldError(field)

        try:
            return validators[field](value)
        except ValueError as e:
            # Re-raise validation errors with field context
            raise
