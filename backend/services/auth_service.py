"""Authentication service for user registration and login operations."""

import os

import sqlite3
import secrets
import hashlib
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Tuple, Dict, Any

import bcrypt 
from core.logger import get_logger

ROOT = Path(__file__).parent.parent.parent
DATABASE_PATH = ROOT / "database" / "ai_naragi.db"


# Configure password hashing with bcrypt

logger = get_logger(__name__)


class AuthenticationService:
    """Service for handling user authentication including registration and login."""

    def __init__(self, db_path: str = DATABASE_PATH):
        """Initialize authentication service with database path.
        
        Args:
            db_path: Path to SQLite database
        """
        self.db_path = Path(db_path)
        if not self.db_path.exists():
            raise FileNotFoundError(f"Database not found at {self.db_path}")

    def _get_connection(self) -> sqlite3.Connection:
        """Get database connection.
        
        Returns:
            SQLite connection object
        """
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def hash_password(self, password: str) -> str:
        """Hash password using bcrypt directly."""
        # bcrypt yêu cầu dữ liệu đầu vào dạng bytes
        password_bytes = password.encode('utf-8')
        # Tạo muối (salt) để tăng tính bảo mật
        salt = bcrypt.gensalt()
        # Băm mật khẩu
        hashed = bcrypt.hashpw(password_bytes, salt)
        # Chuyển kết quả băm từ bytes về lại string để lưu vào SQLite
        return hashed.decode('utf-8')

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify password against hash directly."""
        try:
            password_bytes = plain_password.encode('utf-8')
            hashed_bytes = hashed_password.encode('utf-8')
            # Kiểm tra mật khẩu khớp với chuỗi băm trong DB không
            return bcrypt.checkpw(password_bytes, hashed_bytes)
        except Exception as e:
            logger.error(f"[AUTH_SERVICE] Password verification failed: {str(e)}")
            return False

    def generate_session_token(self) -> str:
        """Generate secure session token.
        
        Returns:
            Secure random token
        """
        return secrets.token_urlsafe(32)

    def register_user(
        self,
        username: str,
        email: str,
        password: str,
        full_name: Optional[str] = None
    ) -> Tuple[bool, Optional[Dict[str, Any]], Optional[Dict[str, str]]]:
        """Register a new user.
        
        Args:
            username: Unique username
            email: Email address
            password: Plain text password (will be hashed)
            full_name: Optional full name
            
        Returns:
            Tuple of (success, user_data, errors)
            - success: True if registration successful
            - user_data: User info if successful, None otherwise
            - errors: Dict of field-specific errors if unsuccessful, None otherwise
        """
        errors: Dict[str, str] = {}
        logger.debug(f"[AUTH_SERVICE] Starting user registration for: {username}")

        try:
            conn = self._get_connection()
            logger.debug(f"[AUTH_SERVICE] Database connection established")
            cursor = conn.cursor()

            # Check if username already exists
            logger.debug(f"[AUTH_SERVICE] Checking if username '{username}' already exists...")
            cursor.execute(
                "SELECT id FROM users WHERE LOWER(username) = LOWER(?)",
                (username,)
            )
            if cursor.fetchone():
                errors['username'] = "This username is already registered"
                logger.warning(f"[AUTH_SERVICE] Username '{username}' already exists in database")

            # Check if email already exists
            logger.debug(f"[AUTH_SERVICE] Checking if email '{email}' already exists...")
            cursor.execute(
                "SELECT id FROM users WHERE LOWER(email) = LOWER(?)",
                (email,)
            )
            if cursor.fetchone():
                errors['email'] = "This email is already registered"
                logger.warning(f"[AUTH_SERVICE] Email '{email}' already exists in database")

            # If there are validation errors, return them
            if errors:
                conn.close()
                logger.info(f"[AUTH_SERVICE] Registration validation failed: {errors}")
                return False, None, errors

            # Hash password
            logger.debug(f"[AUTH_SERVICE] Hashing password for user: {username}")
            password_hash = self.hash_password(password)
            logger.debug(f"[AUTH_SERVICE] Password hashed successfully")

            # Insert user into users table
            logger.debug(f"[AUTH_SERVICE] Inserting user into users table: {username}")
            cursor.execute(
                """
                INSERT INTO users (username, email, full_name, is_active, created_at, updated_at)
                VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                (username, email, full_name)
            )
            conn.commit()
            user_id = cursor.lastrowid
            logger.info(f"[AUTH_SERVICE] User inserted into users table: ID={user_id}, username={username}")

            # Insert password hash into user_credentials table
            logger.debug(f"[AUTH_SERVICE] Inserting password credentials for user ID: {user_id}")
            cursor.execute(
                """
                INSERT INTO user_credentials (user_id, password_hash, created_at, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                (user_id, password_hash)
            )
            conn.commit()
            logger.info(f"[AUTH_SERVICE] Password credentials inserted for user ID: {user_id}")

            # Fetch the created user
            logger.debug(f"[AUTH_SERVICE] Fetching created user data: ID={user_id}")
            cursor.execute(
                """
                SELECT id, username, email, full_name, is_active, created_at FROM users
                WHERE id = ?
                """,
                (user_id,)
            )
            user_row = cursor.fetchone()
            conn.close()

            if not user_row:
                logger.error(f"[AUTH_SERVICE] Failed to fetch created user: ID={user_id}")
                errors['general'] = "Failed to retrieve created user data"
                return False, None, errors

            user_data = {
                'id': user_row['id'],
                'username': user_row['username'],
                'email': user_row['email'],
                'full_name': user_row['full_name'],
                'is_active': user_row['is_active'],
                'created_at': user_row['created_at']
            }

            logger.info(f"[AUTH_SERVICE] User registered successfully: {username} (ID: {user_id})")
            return True, user_data, None

        except sqlite3.IntegrityError as e:
            logger.error(f"[AUTH_SERVICE] Database integrity error during registration: {str(e)}")
            logger.error(f"[AUTH_SERVICE] This may indicate duplicate username/email or foreign key violation")
            errors['general'] = "Registration failed due to a database error"
            return False, None, errors
        except sqlite3.OperationalError as e:
            logger.error(f"[AUTH_SERVICE] Database operational error during registration: {str(e)}")
            errors['general'] = "Database error - please try again"
            return False, None, errors
        except Exception as e:
            logger.error(f"[AUTH_SERVICE] Unexpected error during registration: {type(e).__name__}: {str(e)}")
            import traceback
            logger.error(f"[AUTH_SERVICE] Traceback: {traceback.format_exc()}")
            errors['general'] = "An unexpected error occurred during registration"
            return False, None, errors

    def login_user(
        self,
        username_or_email: str,
        password: str
    ) -> Tuple[bool, Optional[Dict[str, Any]], Optional[Dict[str, str]], Optional[str]]:
        """Authenticate user and create session.
        
        Args:
            username_or_email: Username or email
            password: Plain text password
            
        Returns:
            Tuple of (success, user_data, errors, session_token)
            - success: True if login successful
            - user_data: User info if successful, None otherwise
            - errors: Dict of field-specific errors if unsuccessful, None otherwise
            - session_token: Session token if successful, None otherwise
        """
        errors: Dict[str, str] = {}

        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            # Find user by username or email
            cursor.execute(
                """
                SELECT u.id, u.username, u.email, u.full_name, u.is_active, u.created_at,
                       uc.password_hash
                FROM users u
                LEFT JOIN user_credentials uc ON u.id = uc.user_id
                WHERE LOWER(u.username) = LOWER(?) OR LOWER(u.email) = LOWER(?)
                """,
                (username_or_email, username_or_email)
            )
            user_row = cursor.fetchone()

            # User not found
            if not user_row:
                errors['username_or_email'] = "Username or email not found"
                conn.close()
                return False, None, errors, None

            # Check if user is active
            if not user_row['is_active']:
                errors['general'] = "This account has been deactivated"
                conn.close()
                return False, None, errors, None

            # Verify password
            password_hash = user_row['password_hash']
            if not password_hash or not self.verify_password(password, password_hash):
                errors['password'] = "Incorrect password"
                conn.close()
                logger.warning(f"Failed login attempt for user: {user_row['username']}")
                return False, None, errors, None

            # Generate session token
            session_token = self.generate_session_token()
            expires_at = datetime.now() + timedelta(days=7)

            # Create session
            cursor.execute(
                """
                INSERT INTO sessions (user_id, session_token, is_active, expires_at, created_at)
                VALUES (?, ?, 1, ?, CURRENT_TIMESTAMP)
                """,
                (user_row['id'], session_token, expires_at.isoformat())
            )
            conn.commit()

            # Log activity
            cursor.execute(
                """
                INSERT INTO activity_log (user_id, action_type, resource_type, details, created_at)
                VALUES (?, 'login', 'session', 'User logged in', CURRENT_TIMESTAMP)
                """,
                (user_row['id'],)
            )
            conn.commit()
            conn.close()

            user_data = {
                'id': user_row['id'],
                'username': user_row['username'],
                'email': user_row['email'],
                'full_name': user_row['full_name'],
                'is_active': user_row['is_active'],
                'created_at': user_row['created_at']
            }

            logger.info(f"User logged in successfully: {user_row['username']}")
            return True, user_data, None, session_token

        except Exception as e:
            logger.error(f"Unexpected error during login: {str(e)}")
            errors['general'] = "An unexpected error occurred during login"
            return False, None, errors, None

    def verify_session_token(self, session_token: str) -> Tuple[bool, Optional[int]]:
        """Verify if session token is valid and active.
        
        Args:
            session_token: Session token to verify
            
        Returns:
            Tuple of (is_valid, user_id)
        """
        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            cursor.execute(
                """
                SELECT user_id, is_active, expires_at FROM sessions
                WHERE session_token = ?
                """,
                (session_token,)
            )
            session_row = cursor.fetchone()
            conn.close()

            if not session_row:
                return False, None

            if not session_row['is_active']:
                return False, None

            # Check if session has expired
            expires_at = datetime.fromisoformat(session_row['expires_at'])
            if datetime.now() > expires_at:
                return False, None

            return True, session_row['user_id']

        except Exception as e:
            logger.error(f"Error verifying session token: {str(e)}")
            return False, None

    def logout_user(self, session_token: str) -> bool:
        """Invalidate a session token (logout).
        
        Args:
            session_token: Session token to invalidate
            
        Returns:
            True if logout successful, False otherwise
        """
        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            cursor.execute(
                "UPDATE sessions SET is_active = 0 WHERE session_token = ?",
                (session_token,)
            )
            conn.commit()
            
            # Get user_id to log activity
            cursor.execute(
                "SELECT user_id FROM sessions WHERE session_token = ?",
                (session_token,)
            )
            result = cursor.fetchone()
            if result:
                user_id = result['user_id']
                cursor.execute(
                    """
                    INSERT INTO activity_log (user_id, action_type, resource_type, details, created_at)
                    VALUES (?, 'logout', 'session', 'User logged out', CURRENT_TIMESTAMP)
                    """,
                    (user_id,)
                )
                conn.commit()
            
            conn.close()
            return True

        except Exception as e:
            logger.error(f"Error during logout: {str(e)}")
            return False
