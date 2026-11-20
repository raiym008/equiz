import os

DATA_DIR = os.getenv("DATA_DIR", "data")
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{os.path.join(DATA_DIR, 'equiz.db')}",
)

# Қауіпсіздік және шектеулер
SECRET_KEY = os.getenv("SECRET_KEY", "change-this-secret-key-in-production")
# Егер бос болса — локалды режимде әкімші панель ашық тұрады;
# Production-да орнатсаңыз — әкімші маршруттары X-Admin-Key талап етеді
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "")

MAX_UPLOAD_SIZE_MB = int(os.getenv("MAX_UPLOAD_SIZE_MB", "10"))
SUBMIT_GRACE_SECONDS = int(os.getenv("SUBMIT_GRACE_SECONDS", "15"))