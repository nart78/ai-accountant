"""
Application configuration settings loaded from environment variables.
"""
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List


class Settings(BaseSettings):
    """Application settings from environment variables."""

    # Application
    app_name: str = "AI Accountant"
    app_version: str = "0.1.0"
    debug: bool = False
    environment: str = "production"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # Database
    database_url: str = Field(..., env="DATABASE_URL")
    database_echo: bool = False

    # Ollama
    ollama_base_url: str = Field(default="http://localhost:11434", env="OLLAMA_BASE_URL")

    # Accounting Integration
    wave_api_key: str = Field(default="", env="WAVE_API_KEY")
    wave_business_id: str = Field(default="", env="WAVE_BUSINESS_ID")

    # Payroll
    payroll_api_key: str = Field(default="", env="PAYROLL_API_KEY")
    payroll_company_id: str = Field(default="", env="PAYROLL_COMPANY_ID")

    # Security & Auth
    secret_key: str = Field(..., env="SECRET_KEY")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    auth_username: str = Field(default="johnny", env="AUTH_USERNAME")
    auth_password_hash: str = Field(..., env="AUTH_PASSWORD_HASH")

    # File Upload
    upload_dir: str = "../uploads/documents"
    max_upload_size: int = 10485760  # 10MB
    allowed_extensions: List[str] = ["pdf", "png", "jpg", "jpeg", "csv", "xlsx"]

    # Canadian Tax Settings
    tax_year: int = 2024
    gst_filing_frequency: str = "quarterly"  # monthly, quarterly, annual
    province: str = "ON"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Email
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = Field(default="", env="SMTP_USER")
    smtp_password: str = Field(default="", env="SMTP_PASSWORD")
    notification_email: str = Field(default="", env="NOTIFICATION_EMAIL")

    # AI Settings
    ai_model: str = "llama3.2-vision:11b"
    ai_temperature: float = 0.1
    ai_max_tokens: int = 4000

    # Logging
    log_level: str = "INFO"

    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
settings = Settings()
