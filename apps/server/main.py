from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Abhaya Core API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SystemStatus(BaseModel):
    status: int
    service: str
    spatial_engine: bool

@app.get("/api/health", response_model=SystemStatus)
async def health_check():
    return SystemStatus(
        status=200,
        service="Abhaya FastAPI Backend Operational",
        spatial_engine=True
    )
