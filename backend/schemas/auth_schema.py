"""Pydantic schemas for authentication (login/registration) validation."""

from pydantic import BaseModel, Field, EmailStr, field_validator, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime
import re


class RegistrationRequest(BaseModel):
    """Request schema for user registration.
    
    Attributes:
        username: Unique username (3-50 characters, alphanumeric and underscore only)
        email: Valid email address
        password: Password (minimum 8 characters)
        full_name: Optional full name of the user
    """
    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "username": "john_doe",
                "email": "john@example.com",
                "password": "SecurePass123",
                "full_name": "John Doe"
            }
        }
    )
    
    username: str = Field(
        ...,
        min_length=3,
        max_length=50,
        description="Username (3-50 characters, alphanumeric and underscore only)"
    )
    email: EmailStr = Field(..., description="Valid email address")
    password: str = Field(
        ...,
        min_length=8,
        description="Password (minimum 8 characters)"
    )
    full_name: Optional[str] = Field(
        None,
        max_length=100,
        description="Full name of the user"
    )

    @field_validator('username', mode='after')
    @classmethod
    def validate_username(cls, v: str) -> str:
        """Validate username format."""
        if not v or not re.match(r'^[a-zA-Z0-9_]+$', v):
            raise ValueError('Username can only contain letters, numbers, and underscores')
        return v

    @field_validator('password', mode='after')
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password strength."""
        if not v or len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v


class LoginRequest(BaseModel):
    """Request schema for user login.
    
    Attributes:
        username_or_email: Username or email address
        password: User password
    """
    model_config = ConfigDict(
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "username_or_email": "john_doe",
                "password": "SecurePass123"
            }
        }
    )
    
    username_or_email: str = Field(
        ...,
        min_length=1,
        description="Username or email address"
    )
    password: str = Field(..., description="User password")


class UserResponse(BaseModel):
    """Response schema for user data.
    
    Attributes:
        id: User ID
        username: Username
        email: Email address
        full_name: Full name
        is_active: Whether user is active
        created_at: Account creation timestamp
    """
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    username: str
    email: str
    full_name: Optional[str]
    is_active: bool
    created_at: datetime


class RegistrationResponse(BaseModel):
    """Successful registration response.
    
    Attributes:
        success: Whether registration was successful
        message: Success message
        user: User data
    """
    success: bool = True
    message: str
    user: UserResponse


class LoginResponse(BaseModel):
    """Successful login response.
    
    Attributes:
        success: Whether login was successful
        message: Success message
        user: User data
        session_token: Session token for authentication
    """
    success: bool = True
    message: str
    user: UserResponse
    session_token: str


class ErrorResponse(BaseModel):
    """Error response with structured field-specific errors.
    
    Attributes:
        success: Always False for error responses
        errors: Dictionary mapping field names to error messages
    """
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "success": False,
            "errors": {
                "email": "This email is already registered",
                "password": "Password must contain at least one uppercase letter"
            }
        }
    })
    
    success: bool = False
    errors: Dict[str, str]


class ValidationErrorResponse(BaseModel):
    """Validation error response for input validation failures."""
    success: bool = False
    errors: Dict[str, Any]
