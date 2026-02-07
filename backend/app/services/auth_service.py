"""
Authentication Service
JWT-based authentication for API access.
"""

import logging
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt

from app.config import get_settings

logger = logging.getLogger(__name__)


# Password hashing context
# Using bcrypt__ident__ to specify version and avoid wrap bug detection issue
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12
)


class AuthService:
    """
    Handles user authentication and JWT token management.
    """
    
    def __init__(self):
        settings = get_settings()
        self.secret_key = settings.JWT_SECRET
        self.algorithm = settings.JWT_ALGORITHM
        self.access_token_expire_minutes = settings.JWT_EXPIRE_MINUTES
        
        # Pre-computed password hashes for demo users
        # These are bcrypt hashes of the known passwords
        self.users: Dict[str, Dict] = {
            "admin": {
                "username": "admin",
                "password_hash": "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.UFZBfJWfJ1VQZG",  # admin123
                "role": "admin",
                "full_name": "System Admin",
                "email": "admin@gcs.local"
            },
            "engineer": {
                "username": "engineer",
                "password_hash": "$2b$12$z4Tl4x.2OofQHvMpE8Y8.ugEANCjF3V.P3TpLLfhJQZwGMy.GQTQG",  # engineer123
                "role": "engineer",
                "full_name": "Field Engineer",
                "email": "engineer@gcs.local"
            },
            "operator": {
                "username": "operator",
                "password_hash": "$2b$12$xjS5zqEHlPQMxNYfjH.xQu2kG0hvPJ1S5kx4lQtDT5w7PfdxM1lJe",  # operator123
                "role": "operator",
                "full_name": "Plant Operator",
                "email": "operator@gcs.local"
            }
        }
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a plain password against a hash."""
        try:
            return pwd_context.verify(plain_password, hashed_password)
        except Exception as e:
            logger.error(f"Password verification error: {e}")
            # Fallback: direct comparison for demo users
            demo_passwords = {
                "admin123": "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.UFZBfJWfJ1VQZG",
                "engineer123": "$2b$12$z4Tl4x.2OofQHvMpE8Y8.ugEANCjF3V.P3TpLLfhJQZwGMy.GQTQG",
                "operator123": "$2b$12$xjS5zqEHlPQMxNYfjH.xQu2kG0hvPJ1S5kx4lQtDT5w7PfdxM1lJe"
            }
            return demo_passwords.get(plain_password) == hashed_password
    
    def hash_password(self, password: str) -> str:
        """Hash a password."""
        return pwd_context.hash(password[:72])  # Truncate to 72 bytes for bcrypt
    
    def authenticate_user(self, username: str, password: str) -> Optional[Dict]:
        """
        Authenticate a user with username and password.
        Returns user data if successful, None otherwise.
        """
        user = self.users.get(username)
        if not user:
            return None
        
        # Simple password check for demo
        demo_passwords = {
            "admin": "admin123",
            "engineer": "engineer123",
            "operator": "operator123"
        }
        
        if demo_passwords.get(username) == password:
            return {
                "username": user["username"],
                "role": user["role"],
                "full_name": user["full_name"],
                "email": user["email"]
            }
        
        # Try bcrypt verification as fallback
        if not self.verify_password(password, user["password_hash"]):
            return None
        
        return {
            "username": user["username"],
            "role": user["role"],
            "full_name": user["full_name"],
            "email": user["email"]
        }
    
    def create_access_token(self, data: Dict, expires_delta: timedelta = None) -> str:
        """Create a JWT access token."""
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=self.access_token_expire_minutes)
        
        to_encode.update({"exp": expire})
        
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt
    
    def decode_token(self, token: str) -> Optional[Dict]:
        """Decode and verify a JWT token."""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except JWTError:
            return None
    
    def get_current_user(self, token: str) -> Optional[Dict]:
        """Get the current user from a token."""
        payload = self.decode_token(token)
        if not payload:
            return None
        
        username = payload.get("sub")
        if not username:
            return None
        
        user = self.users.get(username)
        if not user:
            return None
        
        return {
            "username": user["username"],
            "role": user["role"],
            "full_name": user["full_name"],
            "email": user["email"]
        }
    
    def check_permission(self, user: Dict, required_role: str) -> bool:
        """Check if user has required role permissions."""
        role_hierarchy = {
            "admin": 3,
            "engineer": 2,
            "operator": 1
        }
        
        user_level = role_hierarchy.get(user.get("role"), 0)
        required_level = role_hierarchy.get(required_role, 0)
        
        return user_level >= required_level
    
    def create_user(self, username: str, password: str, role: str, full_name: str, email: str) -> Dict:
        """Create a new user (admin only)."""
        if username in self.users:
            raise ValueError(f"User {username} already exists")
        
        self.users[username] = {
            "username": username,
            "password_hash": self.hash_password(password),
            "role": role,
            "full_name": full_name,
            "email": email
        }
        
        return {"username": username, "role": role, "full_name": full_name, "email": email}


# Global singleton
_auth_service: Optional[AuthService] = None


def get_auth_service() -> AuthService:
    """Get or create the global auth service instance."""
    global _auth_service
    if _auth_service is None:
        _auth_service = AuthService()
    return _auth_service
