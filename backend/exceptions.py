"""Custom exceptions for backend API operations."""

from typing import Optional, Dict, Any


class ValidationError(Exception):
    """Custom exception for input validation failures."""

    def __init__(self, message: str, field: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        """Initialize validation error.
        
        Args:
            message: Error message to display to the user
            field: Optional field name that caused the error
            details: Optional additional details about the error
        """
        self.message = message
        self.field = field
        self.details = details or {}
        super().__init__(self.message)


class InvalidBirthYearError(ValidationError):
    """Exception raised when birth year validation fails."""

    def __init__(self, message: str = "Invalid date format or year. Please provide a realistic birth year."):
        super().__init__(message, field="birth_year")


class InvalidFullNameError(ValidationError):
    """Exception raised when full name validation fails."""

    def __init__(self, message: str = "Full name cannot be empty or contain invalid characters."):
        super().__init__(message, field="full_name")


class FieldTooLongError(ValidationError):
    """Exception raised when field value exceeds maximum length."""

    def __init__(self, field: str, max_length: int, message: Optional[str] = None):
        msg = message or f"Input exceeds the maximum allowed length of {max_length} characters."
        super().__init__(msg, field=field, details={"max_length": max_length})


class InvalidFieldError(ValidationError):
    """Exception raised when field name is invalid."""

    def __init__(self, field: str, message: Optional[str] = None):
        msg = message or f"Field '{field}' is not a valid profile field."
        super().__init__(msg, field=field)


class DatabaseError(Exception):
    """Exception raised for database operation failures."""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.details = details or {}
        super().__init__(self.message)
