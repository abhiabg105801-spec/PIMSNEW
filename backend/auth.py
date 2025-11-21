# backend/auth.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
import secrets

# This is a dummy dependency.
# Replace this with your actual JWT or OAuth2 verification logic.
# For now, it accepts any username/password.
security = HTTPBasic()

async def verify_user(credentials: HTTPBasicCredentials = Depends(security)):
    """
    Verifies the hardcoded username and password.
    """
    
    # Hardcoded credentials
    correct_username = "admin"
    correct_password = "pims@123"

    # Use secrets.compare_digest to help prevent timing attacks
    is_correct_username = secrets.compare_digest(
        credentials.username, correct_username
    )
    is_correct_password = secrets.compare_digest(
        credentials.password, correct_password
    )

    if not (is_correct_username and is_correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Basic"},
        )
    
    # print(f"User '{credentials.username}' verified")
    return True