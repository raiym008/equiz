from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import run_safe_migrations
from routes import router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Сервер қосылған сайын ескі базаны өшірмей, жаңа бағандарды қауіпсіз тексереді
    run_safe_migrations()
    yield


app = FastAPI(
    title="eQuiz Backend API",
    version="2.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
def root():
    return {"message": "eQuiz Backend v2.1 жұмыс істеп тұр!"}