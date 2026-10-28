from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "pdf_mcq_exam"

    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"

    jwt_secret: str = "dev-secret-change-me"
    jwt_expire_minutes: int = 1440
    teacher_invite_code: str = ""

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    embedding_model: str = "BAAI/bge-small-en-v1.5"
    chunk_size: int = 1200
    chunk_overlap: int = 200
    verify_questions: bool = True

    submission_grace_minutes: int = 30

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
