from pydantic_settings import BaseSettings
from pydantic import SecretStr

class Settings(BaseSettings):
    # API
    app_name: str = "Paylancer"
    debug: bool = True
    version: str = "1.0.0"
    
    # Database
    database_url: str
    db_echo: bool = False
    
    # Security
    secret_key: SecretStr
    access_token_expire_minutes: int = 30
    
    # CORS
    cors_origins: list = ["*"]
    cors_credentials: bool = True
    
    # Logging
    log_level: str = "INFO"
    
    class Config:
        env_file = ".env"

settings = Settings()