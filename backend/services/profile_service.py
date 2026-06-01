"""Profile management service for user profile data and modifications."""

import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple, Dict, Any

from core.logger import get_logger
from schemas.profile_schema import FieldValidator
from exceptions import ValidationError, DatabaseError, InvalidFieldError

ROOT = Path(__file__).parent.parent.parent
DATABASE_PATH = ROOT / "database" / "ai_naragi.db"

logger = get_logger(__name__)


class ProfileService:
    """Service for managing user profile data and updates."""

    def __init__(self, db_path: str = DATABASE_PATH):
        """Initialize profile service with database path.
        
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

    def get_user_profile(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Fetch complete user profile (users + user_profiles).
        
        Args:
            user_id: User ID
            
        Returns:
            Dict with user profile data or None if user not found
        """
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # JOIN users and user_profiles tables
            query = """
                SELECT 
                    u.id,
                    u.username,
                    u.email,
                    u.full_name,
                    u.is_active,
                    u.created_at as user_created_at,
                    u.updated_at as user_updated_at,
                    up.birth_year,
                    up.occupation,
                    up.interests,
                    up.current_level,
                    up.preferred_language,
                    up.created_at as profile_created_at,
                    up.updated_at as profile_updated_at
                FROM users u
                LEFT JOIN user_profiles up ON u.id = up.user_id
                WHERE u.id = ?
            """
            
            cursor.execute(query, (user_id,))
            row = cursor.fetchone()
            conn.close()
            
            if not row:
                logger.warning(f"[PROFILE_SERVICE] User not found: {user_id}")
                return None
            
            # Convert Row to Dict
            profile = dict(row)
            logger.debug(f"[PROFILE_SERVICE] User profile fetched for user_id: {user_id}")
            return profile
            
        except Exception as e:
            logger.error(f"[PROFILE_SERVICE] Error fetching user profile: {str(e)}")
            return None

    def update_profile_field(
        self,
        user_id: int,
        field: str,
        value: Optional[str]
    ) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
        """Update a specific profile field with validation.
        
        This method validates input, prevents SQL injection, and logs all updates.
        
        Args:
            user_id: User ID
            field: Field name to update (full_name, birth_year, occupation, interests, preferred_language)
            value: New value (can be None to set NULL)
            
        Returns:
            Tuple of (success: bool, error_message: Optional[str], data: Optional[Dict])
        """
        # Map field names to their table and column
        field_mapping = {
            'full_name': ('users', 'full_name'),
            'birth_year': ('user_profiles', 'birth_year'),
            'occupation': ('user_profiles', 'occupation'),
            'interests': ('user_profiles', 'interests'),
            'preferred_language': ('user_profiles', 'preferred_language'),
        }
        
        # ============ VALIDATION PHASE ============
        try:
            # 1. Validate field exists
            if field not in field_mapping:
                error_msg = f"Invalid field name: {field}"
                logger.warning(f"[PROFILE_SERVICE] {error_msg}")
                return False, "Invalid profile field.", None
            
            # 2. Validate and sanitize the value using FieldValidator
            validated_value = FieldValidator.validate_field(field, value)
            logger.debug(f"[PROFILE_SERVICE] Field '{field}' validated successfully")
            
        except ValidationError as e:
            logger.warning(f"[PROFILE_SERVICE] Validation error for field '{field}': {e.message}")
            return False, e.message, None
        except ValueError as e:
            logger.warning(f"[PROFILE_SERVICE] Validation error for field '{field}': {str(e)}")
            return False, str(e), None
        except Exception as e:
            error_msg = f"Unexpected validation error for field '{field}': {str(e)}"
            logger.error(f"[PROFILE_SERVICE] {error_msg}")
            return False, "An error occurred during validation.", None
        
        # ============ DATABASE EXECUTION PHASE ============
        table, column = field_mapping[field]
        conn = None
        
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # 3. Validate user exists
            cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
            if not cursor.fetchone():
                error_msg = f"User not found: {user_id}"
                logger.warning(f"[PROFILE_SERVICE] {error_msg}")
                conn.close()
                return False, "User not found.", None
            
            # 4. For user_profiles table, ensure profile exists
            if table == 'user_profiles':
                cursor.execute(
                    "SELECT id FROM user_profiles WHERE user_id = ?",
                    (user_id,)
                )
                if not cursor.fetchone():
                    # Create profile entry if it doesn't exist
                    try:
                        cursor.execute(
                            "INSERT INTO user_profiles (user_id) VALUES (?)",
                            (user_id,)
                        )
                        conn.commit()
                        logger.debug(f"[PROFILE_SERVICE] Created user_profile for user_id: {user_id}")
                    except Exception as e:
                        conn.close()
                        logger.error(f"[PROFILE_SERVICE] Failed to create user_profile: {str(e)}")
                        return False, "Failed to initialize profile data.", None
            
            # 5. Execute the UPDATE statement with proper parameterization
            where_column = 'id' if table == 'users' else 'user_id'
            update_query = f"""
                UPDATE {table}
                SET {column} = ?, updated_at = CURRENT_TIMESTAMP
                WHERE {where_column} = ?
            """
            
            cursor.execute(update_query, (validated_value, user_id))
            
            if cursor.rowcount == 0:
                conn.close()
                logger.warning(f"[PROFILE_SERVICE] No rows updated for user_id: {user_id}, field: {field}")
                return False, f"Could not update {field}.", None
            
            conn.commit()
            logger.info(f"[PROFILE_SERVICE] Updated {field} for user_id: {user_id} (rows affected: {cursor.rowcount})")
            
            # ============ ACTIVITY LOGGING PHASE ============
            # Log the activity
            if not self._log_activity(user_id, 'UPDATE_PROFILE', f"Updated field: {field}"):
                logger.warning(f"[PROFILE_SERVICE] Failed to log activity for user_id: {user_id}")
                # Don't fail the operation if logging fails, just warn
            
            conn.close()
            
            # Return success with the updated value
            return True, None, {
                "field": field,
                "value": validated_value,
                "updated_at": datetime.now().isoformat()
            }
            
        except sqlite3.IntegrityError as e:
            if conn:
                conn.close()
            error_msg = f"Database integrity error: {str(e)}"
            logger.error(f"[PROFILE_SERVICE] {error_msg}")
            return False, "Failed to update profile. Please try again.", None
            
        except sqlite3.OperationalError as e:
            if conn:
                conn.close()
            error_msg = f"Database operational error: {str(e)}"
            logger.error(f"[PROFILE_SERVICE] {error_msg}")
            return False, "Database error occurred. Please try again.", None
            
        except Exception as e:
            if conn:
                conn.close()
            error_msg = f"Unexpected error updating {field}: {str(e)}"
            logger.error(f"[PROFILE_SERVICE] {error_msg}")
            return False, "An unexpected error occurred. Please try again.", None

    def _log_activity(
        self,
        user_id: int,
        action_type: str,
        details: Optional[str] = None
    ) -> bool:
        """Log user activity.
        
        Args:
            user_id: User ID
            action_type: Type of action (e.g., 'UPDATE_PROFILE')
            details: Additional details about the action
            
        Returns:
            True if logged successfully
        """
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            cursor.execute(
                """
                INSERT INTO activity_log (user_id, action_type, resource_type, details, created_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                """,
                (user_id, action_type, 'profile', details)
            )
            conn.commit()
            conn.close()
            
            logger.debug(f"[PROFILE_SERVICE] Activity logged: {action_type} for user_id: {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"[PROFILE_SERVICE] Error logging activity: {str(e)}")
            return False

    def get_activity_log(
        self,
        user_id: int,
        limit: int = 50
    ) -> list:
        """Get activity log for a user.
        
        Args:
            user_id: User ID
            limit: Maximum number of records to fetch
            
        Returns:
            List of activity log entries
        """
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            query = """
                SELECT id, action_type, resource_type, details, created_at
                FROM activity_log
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ?
            """
            
            cursor.execute(query, (user_id, limit))
            rows = cursor.fetchall()
            conn.close()
            
            return [dict(row) for row in rows]
            
        except Exception as e:
            logger.error(f"[PROFILE_SERVICE] Error fetching activity log: {str(e)}")
            return []
