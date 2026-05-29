"""Authentication API routes for user registration and login."""

from fastapi import APIRouter, HTTPException, status
from pydantic import ValidationError

from schemas.auth_schema import (
    RegistrationRequest,
    LoginRequest,
    RegistrationResponse,
    LoginResponse,
    ErrorResponse,
    ValidationErrorResponse,
    UserResponse
)
from services.auth_service import AuthenticationService
from core.logger import get_logger

router = APIRouter(prefix="/api/auth", tags=["authentication"])
logger = get_logger(__name__)

# Initialize authentication service
auth_service = AuthenticationService()


@router.post(
    "/register",
    response_model=RegistrationResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Registration validation failed"},
        500: {"model": ErrorResponse, "description": "Server error"}
    },
    status_code=status.HTTP_201_CREATED
)
async def register(request: RegistrationRequest):
    """Register a new user account.
    
    Args:
        request: Registration request containing username, email, password, and optional full_name
        
    Returns:
        RegistrationResponse with user data if successful
        
    Raises:
        HTTPException: If registration fails with structured error details
    """
    logger.info("=" * 50)
    logger.info("[REGISTRATION] Incoming registration request")
    logger.info(f"  - Username: {request.username}")
    logger.info(f"  - Email: {request.email}")
    logger.info(f"  - Full Name: {request.full_name or 'Not provided'}")
    logger.info("=" * 50)
    
    try:
        logger.debug(f"[REGISTRATION] Processing registration for username: {request.username}")
        
        success, user_data, errors = auth_service.register_user(
            username=request.username,
            email=request.email,
            password=request.password,
            full_name=request.full_name
        )

        if not success:
            logger.warning(f"[REGISTRATION] Registration failed for {request.email}")
            logger.warning(f"  - Errors: {errors}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "success": False,
                    "errors": errors
                }
            )

        logger.info(f"[REGISTRATION] User created successfully: {request.username} (ID: {user_data['id']})")
        logger.info(f"  - Email: {user_data['email']}")
        logger.info(f"  - Full Name: {user_data['full_name']}")
        
        user_response = UserResponse(**user_data)
        return RegistrationResponse(
            success=True,
            message="User registered successfully",
            user=user_response
        )

    except ValidationError as e:
        logger.error(f"[REGISTRATION] Pydantic validation error during registration")
        logger.error(f"  - Error details: {str(e)}")
        errors = {}
        for error in e.errors():
            field = error['loc'][0] if error['loc'] else 'general'
            errors[str(field)] = error['msg']
            logger.error(f"    - Field '{field}': {error['msg']}")
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "errors": errors
            }
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"[REGISTRATION] Unexpected error during registration: {type(e).__name__}")
        logger.error(f"  - Exception message: {str(e)}")
        import traceback
        logger.error(f"  - Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "errors": {"general": "An unexpected error occurred during registration"}
            }
        )


@router.post(
    "/login",
    response_model=LoginResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Login failed - invalid credentials or user not found"},
        500: {"model": ErrorResponse, "description": "Server error"}
    }
)
async def login(request: LoginRequest):
    """Authenticate user and create a session.
    
    Args:
        request: Login request containing username/email and password
        
    Returns:
        LoginResponse with user data and session token if successful
        
    Raises:
        HTTPException: If login fails with structured error details
    """
    try:
        success, user_data, errors, session_token = auth_service.login_user(
            username_or_email=request.username_or_email,
            password=request.password
        )

        if not success:
            logger.warning(f"Login failed for {request.username_or_email}: {errors}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "success": False,
                    "errors": errors
                }
            )

        user_response = UserResponse(**user_data)
        return LoginResponse(
            success=True,
            message="Login successful",
            user=user_response,
            session_token=session_token
        )

    except ValidationError as e:
        logger.error(f"Validation error during login: {str(e)}")
        errors = {}
        for error in e.errors():
            field = error['loc'][0] if error['loc'] else 'general'
            errors[str(field)] = error['msg']
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "errors": errors
            }
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Unexpected error during login: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "errors": {"general": "An unexpected error occurred during login"}
            }
        )


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK
)
async def logout(session_token: str):
    """Logout user by invalidating their session token.
    
    Args:
        session_token: Session token to invalidate
        
    Returns:
        Success message if logout successful
        
    Raises:
        HTTPException: If logout fails
    """
    try:
        success = auth_service.logout_user(session_token)

        if not success:
            logger.warning(f"Logout failed for token: {session_token}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "success": False,
                    "errors": {"general": "Failed to logout"}
                }
            )

        return {
            "success": True,
            "message": "Logout successful"
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Unexpected error during logout: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "errors": {"general": "An unexpected error occurred during logout"}
            }
        )


@router.post(
    "/verify-session",
    status_code=status.HTTP_200_OK
)
async def verify_session(session_token: str):
    """Verify if a session token is valid and active.
    
    Args:
        session_token: Session token to verify
        
    Returns:
        Session validity status and user_id if valid
        
    Raises:
        HTTPException: If verification fails
    """
    try:
        is_valid, user_id = auth_service.verify_session_token(session_token)

        if not is_valid:
            return {
                "success": False,
                "valid": False,
                "message": "Session is invalid or expired"
            }

        return {
            "success": True,
            "valid": True,
            "user_id": user_id,
            "message": "Session is valid"
        }

    except Exception as e:
        logger.error(f"Error verifying session: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "success": False,
                "errors": {"general": "An error occurred while verifying session"}
            }
        )
