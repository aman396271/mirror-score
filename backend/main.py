from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


class AnalyzeRequest(BaseModel):
    image_base64: str


class SubScore(BaseModel):
    score: float
    label: str


class AnalyzeResponse(BaseModel):
    scoreTotal: float
    ageRange: str
    subScores: dict[str, SubScore]
    freeSummary: list[str]
    isLocked: bool


app = FastAPI(title="MirrorScore API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root() -> dict[str, str]:
    return {"status": "ok", "service": "MirrorScore API"}


@app.get("/health")
def read_health() -> dict[str, str]:
    return {"status": "healthy"}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze_image(request: AnalyzeRequest) -> AnalyzeResponse:
    _ = request.image_base64
    return AnalyzeResponse(
        scoreTotal=7.85,
        ageRange="24-28岁",
        subScores={
            "imageQuality": SubScore(score=8.1, label="图像质量"),
            "facePose": SubScore(score=7.6, label="脸部姿态"),
            "expression": SubScore(score=7.9, label="表情状态"),
            "contour": SubScore(score=7.7, label="轮廓清晰度"),
            "style": SubScore(score=8.0, label="风格完成度"),
        },
        freeSummary=[
            "使用均匀的正面光源，减少脸部阴影",
            "拍摄角度略高于眼平线，画面更干净",
            "选用简洁背景，让脸部成为视觉焦点",
        ],
        isLocked=True,
    )
