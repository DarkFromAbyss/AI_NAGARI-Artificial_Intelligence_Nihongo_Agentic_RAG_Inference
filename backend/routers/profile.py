"""Profile API routes for fetching and updating user profile information."""

from fastapi import APIRouter, HTTPException, status, Header, Depends
from pydantic import BaseModel, Field, ValidationError as PydanticValidationError
from typing import Optional, Dict, Any
import sqlite3
from pathlib import Path

from services.profile_service import ProfileService
from schemas.profile_schema import ProfileFieldUpdate, ProfileUpdateResponse, ProfileValidationError, FieldValidator
from exceptions import ValidationError
from core.logger import get_logger
from core.config import settings

logger = get_logger(__name__)

router = APIRouter(prefix="/api/profile", tags=["profile"])
profile_service = ProfileService()

# Database setup
ROOT = Path(__file__).parent.parent.parent
DATABASE_PATH = ROOT / "database" / "ai_naragi.db"


# ============ Request/Response Schemas ============

class ProfileResponse(BaseModel):
    """Complete user profile response."""
    id: int
    username: str
    email: str
    full_name: Optional[str]
    birth_year: Optional[int] = None
    occupation: Optional[str] = None
    interests: Optional[str] = None
    preferred_language: Optional[str] = None
    is_active: bool


class SuccessResponse(BaseModel):
    """Generic success response."""
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None


class ErrorResponse(BaseModel):
    """Generic error response with field-level error support."""
    success: bool = False
    error: str
    field: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


# ============ Helper Functions ============

def get_user_id_from_session(authorization: str) -> int:
    """Extract user_id from session token.
    
    Args:
        authorization: Authorization header value (format: "Bearer <token>")
        
    Returns:
        User ID if valid session, raises HTTPException otherwise
    """
    try:
        # Parse Bearer token
        parts = authorization.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise ValueError("Invalid authorization format")
        
        session_token = parts[1]
        
        # Query sessions table
        conn = sqlite3.connect(DATABASE_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        query = """
            SELECT user_id, is_active, expires_at
            FROM sessions
            WHERE session_token = ?
        """
        cursor.execute(query, (session_token,))
        session = cursor.fetchone()
        conn.close()
        
        if not session:
            logger.warning(f"[PROFILE_API] Invalid session token provided")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired session token"
            )
        
        if not session['is_active']:
            logger.warning(f"[PROFILE_API] Session is inactive: {session_token[:20]}...")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session is inactive"
            )
        
        return session['user_id']
        
    except HTTPException:
        raise
    except (ValueError, IndexError) as e:
        logger.error(f"[PROFILE_API] Error parsing authorization: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format"
        )


# ============ API Endpoints ============

@router.get(
    "",
    response_model=SuccessResponse,
    responses={
        401: {"model": ErrorResponse, "description": "Unauthorized - Invalid session"},
        404: {"model": ErrorResponse, "description": "User not found"},
        500: {"model": ErrorResponse, "description": "Server error"}
    }
)
async def get_user_profile(authorization: str = Header(...)):
    """Fetch complete user profile (users + user_profiles data).
    
    Args:
        authorization: Authorization header with session token (format: "Bearer <token>")
        
    Returns:
        User profile data including personal information
    """
    logger.info("[PROFILE_API] Fetching user profile")
    
    try:
        # Validate session and get user_id
        user_id = get_user_id_from_session(authorization)
        
        # Fetch profile
        profile = profile_service.get_user_profile(user_id)
        
        if not profile:
            logger.warning(f"[PROFILE_API] User not found: {user_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found"
            )
        
        logger.info(f"[PROFILE_API] Profile fetched successfully for user_id: {user_id}")
        
        return SuccessResponse(
            success=True,
            message="User profile retrieved successfully",
            data={
                "id": profile['id'],
                "username": profile['username'],
                "email": profile['email'],
                "full_name": profile['full_name'],
                "birth_year": profile.get('birth_year'),
                "occupation": profile.get('occupation'),
                "interests": profile.get('interests'),
                "preferred_language": profile.get('preferred_language'),
                "is_active": profile['is_active']
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[PROFILE_API] Unexpected error fetching profile: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred"
        )


@router.patch(
    "",
    response_model=SuccessResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid field or value"},
        401: {"model": ErrorResponse, "description": "Unauthorized - Invalid session"},
        500: {"model": ErrorResponse, "description": "Server error"}
    }
)
async def update_profile_field(
    request: ProfileFieldUpdate,
    authorization: str = Header(...)
):
    """Update a specific user profile field with validation.
    
    This endpoint validates all inputs against strict rules before updating
    the database. It returns detailed error messages for validation failures.
    
    Args:
        request: Update request with field name and new value
        authorization: Authorization header with session token
        
    Returns:
        Updated profile data with success status
        
    Raises:
        HTTPException 400: Validation error with field-specific message
        HTTPException 401: Unauthorized/invalid session
        HTTPException 500: Database or unexpected error
    """
    logger.info(f"[PROFILE_API] Update profile field request: field={request.field}")
    
    try:
        # ============ AUTHENTICATION PHASE ============
        # Validate session and get user_id
        user_id = get_user_id_from_session(authorization)
        logger.debug(f"[PROFILE_API] User authenticated: user_id={user_id}")
        
        # ============ VALIDATION PHASE ============
        # Pydantic will validate field name against allowed list
        # Additional validation happens in profile_service
        logger.debug(f"[PROFILE_API] Field '{request.field}' passed schema validation")
        
        # ============ DATABASE UPDATE PHASE ============
        # Call service with validated data
        success, error_msg, response_data = profile_service.update_profile_field(
            user_id=user_id,
            field=request.field,
            value=request.value
        )
        
        # ============ ERROR HANDLING ============
        if not success:
            logger.warning(
                f"[PROFILE_API] Field update failed for user_id={user_id}: "
                f"field={request.field}, error={error_msg}"
            )
            
            # Return 400 Bad Request with field-specific error
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "success": False,
                    "error": error_msg,
                    "field": request.field,
                    "details": None
                }
            )
        
        # ============ SUCCESS RESPONSE PHASE ============
        # Fetch updated profile to return fresh data
        updated_profile = profile_service.get_user_profile(user_id)
        
        if not updated_profile:
            logger.error(f"[PROFILE_API] Could not fetch updated profile for user_id: {user_id}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "success": False,
                    "error": "Profile updated but could not retrieve updated data",
                    "field": None,
                    "details": None
                }
            )
        
        logger.info(
            f"[PROFILE_API] Field '{request.field}' updated successfully for user_id={user_id}"
        )
        
        return SuccessResponse(
            success=True,
            message=f"Profile field '{request.field}' updated successfully",
            data={
                "id": updated_profile['id'],
                "username": updated_profile['username'],
                "email": updated_profile['email'],
                "full_name": updated_profile['full_name'],
                "birth_year": updated_profile.get('birth_year'),
                "occupation": updated_profile.get('occupation'),
                "interests": updated_profile.get('interests'),
                "preferred_language": updated_profile.get('preferred_language'),
                "is_active": updated_profile['is_active'],
                "field_updated": request.field,
                "new_value": response_data.get('value') if response_data else None
            }
        )
        
    except PydanticValidationError as e:
        # Handle Pydantic schema validation errors
        logger.warning(f"[PROFILE_API] Schema validation error: {str(e)}")
        
        # Extract field name from pydantic error
        field_name = None
        error_detail = "Invalid request format"
        
        if e.errors():
            first_error = e.errors()[0]
            if 'loc' in first_error:
                field_name = str(first_error['loc'][0]) if first_error['loc'] else None
            error_detail = first_error.get('msg', error_detail)
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "error": error_detail,
                "field": field_name,
                "details": None
            }
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions from authentication or service
        raise
        
    except Exception as e:
        # Unexpected error
        logger.error(
            f"[PROFILE_API] Unexpected error updating profile for user_id: {str(e)}",
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "error": "An unexpected error occurred. Please try again.",
                "field": None,
                "details": None
            }
        )
