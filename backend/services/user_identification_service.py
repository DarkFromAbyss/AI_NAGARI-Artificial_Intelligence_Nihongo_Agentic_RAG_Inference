"""Service for identifying users and logging their activity to the database."""

import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any
from core.logger import get_logger

ROOT = Path(__file__).parent.parent.parent
DATABASE_PATH = ROOT / "database" / "ai_naragi.db"

logger = get_logger(__name__)


class UserIdentificationService:
    """Service for identifying users from database and logging their activity."""

    def __init__(self, db_path: str = DATABASE_PATH):
        """Initialize user identification service with database path.
        
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

    def identify_user(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Identify user from database by user ID.
        
        Args:
            user_id: User ID (either database ID or 'anonymous')
            
        Returns:
            Dict with complete user profile or None if user not found
        """
        if user_id == 'anonymous' or not user_id:
            logger.info("[UserIdentification] Anonymous user detected")
            return {
                'id': 'anonymous',
                'username': 'Anonymous',
                'email': 'anonymous@system',
                'full_name': 'Anonymous User',
                'is_active': True,
                'created_at': None,
                'birth_year': None,
                'occupation': None,
                'interests': None,
                'preferred_language': 'en',
                'is_anonymous': True
            }

        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            # Query both users and user_profiles tables
            cursor.execute("""
                SELECT 
                    u.id,
                    u.username,
                    u.email,
                    u.full_name,
                    u.is_active,
                    u.created_at,
                    up.birth_year,
                    up.occupation,
                    up.interests,
                    up.preferred_language,
                    up.current_level
                FROM users u
                LEFT JOIN user_profiles up ON u.id = up.user_id
                WHERE u.id = ?
                LIMIT 1
            """, (user_id,))

            row = cursor.fetchone()
            conn.close()

            if not row:
                logger.warning(f"[UserIdentification] User not found in database: {user_id}")
                return None

            user_data = {
                'id': row['id'],
                'username': row['username'],
                'email': row['email'],
                'full_name': row['full_name'] or 'Unknown',
                'is_active': row['is_active'],
                'created_at': row['created_at'],
                'birth_year': row['birth_year'],
                'occupation': row['occupation'],
                'interests': row['interests'],
                'preferred_language': row['preferred_language'] or 'en',
                'current_level': row['current_level'],
                'is_anonymous': False
            }

            logger.info(
                f"[UserIdentification] User identified successfully | "
                f"ID: {user_data['id']} | "
                f"Username: {user_data['username']} | "
                f"Email: {user_data['email']} | "
                f"Full Name: {user_data['full_name']}"
            )

            return user_data

        except Exception as e:
            logger.error(f"[UserIdentification] Error identifying user {user_id}: {str(e)}")
            return None

    def log_user_activity(
        self,
        user_id: str,
        action_type: str,
        resource_type: Optional[str] = None,
        resource_id: Optional[int] = None,
        details: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> bool:
        """Log user activity to the activity_log table.
        
        Args:
            user_id: User ID (database ID or string)
            action_type: Type of action (e.g., 'chat_message', 'login', 'profile_update')
            resource_type: Type of resource being accessed (optional)
            resource_id: ID of resource being accessed (optional)
            details: Additional details about the action (optional)
            ip_address: IP address of the request (optional)
            
        Returns:
            True if logging successful, False otherwise
        """
        try:
            # Convert user_id to int if it's not 'anonymous'
            numeric_user_id = None if user_id == 'anonymous' else int(user_id) if user_id.isdigit() else None

            conn = self._get_connection()
            cursor = conn.cursor()

            cursor.execute("""
                INSERT INTO activity_log 
                (user_id, action_type, resource_type, resource_id, details, ip_address, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                numeric_user_id,
                action_type,
                resource_type,
                resource_id,
                details,
                ip_address,
                datetime.utcnow().isoformat()
            ))

            conn.commit()
            conn.close()

            logger.info(
                f"[UserActivity] Activity logged | "
                f"User: {user_id} | "
                f"Action: {action_type} | "
                f"Resource: {resource_type or 'N/A'}"
            )

            return True

        except Exception as e:
            logger.error(f"[UserActivity] Error logging activity: {str(e)}")
            return False

    def log_chat_message(
        self,
        user_id: str,
        message_id: str,
        message_preview: str,
        ip_address: Optional[str] = None
    ) -> bool:
        """Log a chat message to activity log.
        
        Args:
            user_id: User ID
            message_id: Unique message ID
            message_preview: First 100 characters of the message
            ip_address: IP address of the request
            
        Returns:
            True if logging successful
        """
        details = f"message_id={message_id}|preview={message_preview}"
        return self.log_user_activity(
            user_id=user_id,
            action_type='chat_message',
            resource_type='chat',
            details=details,
            ip_address=ip_address
        )

    def get_user_stats(self, user_id: str) -> Dict[str, Any]:
        """Get user statistics from activity log.
        
        Args:
            user_id: User ID
            
        Returns:
            Dict with user statistics
        """
        if user_id == 'anonymous':
            return {'total_messages': 0, 'total_activities': 0}

        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            # Get total messages
            cursor.execute(
                "SELECT COUNT(*) as count FROM activity_log WHERE user_id = ? AND action_type = 'chat_message'",
                (int(user_id) if user_id.isdigit() else None,)
            )
            messages_row = cursor.fetchone()
            total_messages = messages_row['count'] if messages_row else 0

            # Get total activities
            cursor.execute(
                "SELECT COUNT(*) as count FROM activity_log WHERE user_id = ?",
                (int(user_id) if user_id.isdigit() else None,)
            )
            activities_row = cursor.fetchone()
            total_activities = activities_row['count'] if activities_row else 0

            conn.close()

            return {
                'total_messages': total_messages,
                'total_activities': total_activities
            }

        except Exception as e:
            logger.error(f"[UserStats] Error fetching user stats: {str(e)}")
            return {'total_messages': 0, 'total_activities': 0}
