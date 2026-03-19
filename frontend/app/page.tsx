"use client";

import Image from "next/image";
import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import { QRCodeSVG as QRCode } from "qrcode.react";

type SafeResult = {
  orderId: string;
  isPaid: false;
  scoreLevel: string;
  levelColor: string;
  levelLabel: string;
  levelDescription: string;
  ageRange: string;
  gender: string;
  teaser: {
    strongPoints: string[];
    weakPoints: string[];
    oneFreeTip: string;
  };
  lockedContent: {
    itemCount: number;
    tipCount: number;
    message: string;
  };
};

type FullResult = {
  isPaid: true;
  totalScore: number;
  details: Record<string, { score: number; label: string; comment: string }>;
  freeTips: string[];
  lockedTips: { title: string; content: string }[];
};

type CreateOrderResponse = {
  qrCode?: string;
  isPaid?: boolean;
  detail?: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const POLL_INTERVAL = 3000;
const QR_EXPIRE_SECONDS = 60;
const DETAIL_ORDER = [
  "eyes",
  "eyeDistance",
  "nose",
  "mouth",
  "faceShape",
  "skinTone",
  "proportion",
  "hairStyle",
];
const LOADING_MESSAGES = [
  "AI 正在识别五官结构与面部轮廓…",
  "正在评估上镜气质、比例与视觉年龄…",
  "正在提炼亮点与关键短板…",
  "正在生成适合你的改善建议…",
  "即将完成，请稍候…",
];

const getApiUrl = (path: string) => `${API_BASE}${path}`;

const getErrorMessage = (payload: unknown, fallback: string) => {
  if (payload && typeof payload === "object") {
    const message = "detail" in payload ? payload.detail : "message" in payload ? payload.message : "";
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return fallback;
};

const getGenderLabel = (gender: string) => {
  if (gender === "female") return "女";
  if (gender === "male") return "男";
  return gender;
};

const getBarColor = (score: number, accent: string) => {
  if (score >= 7.5) return accent;
  if (score >= 6) return "#f59e0b";
  return "#fb7185";
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const modalCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [safeResult, setSafeResult] = useState<SafeResult | null>(null);
  const [fullResult, setFullResult] = useState<FullResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");
  const [qrExpired, setQrExpired] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);
  const [scoreDisplay, setScoreDisplay] = useState(0);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const accentColor = safeResult?.levelColor ?? "#f59e0b";
  const genderLabel = safeResult ? getGenderLabel(safeResult.gender) : "--";

  const detailEntries = fullResult
    ? (() => {
        const seen = new Set<string>();
        const ordered = DETAIL_ORDER.flatMap((key) => {
          const item = fullResult.details[key];
          if (!item) return [];
          seen.add(key);
          return [[key, item] as const];
        });
        const rest = Object.entries(fullResult.details).filter(([key]) => !seen.has(key));
        return [...ordered, ...rest];
      })()
    : [];

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const stopModalCloseTimer = () => {
    if (modalCloseTimerRef.current) {
      clearTimeout(modalCloseTimerRef.current);
      modalCloseTimerRef.current = null;
    }
  };

  const resetPaymentState = () => {
    stopPolling();
    stopModalCloseTimer();
    setShowPayModal(false);
    setQrCodeUrl("");
    setQrLoading(false);
    setQrError("");
    setQrExpired(false);
    setPaySuccess(false);
  };

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      stopPolling();
      stopModalCloseTimer();
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!isSubmitting) return;

    setLoadingMessageIndex(0);
    setProgress(0);

    const messageTimer = setInterval(() => {
      setLoadingMessageIndex((current) => (current + 1) % LOADING_MESSAGES.length);
    }, 2200);

    const progressTimer = setInterval(() => {
      setProgress((current) => {
        if (current >= 92) return current;
        const nextStep = current < 36 ? 4 : current < 68 ? 2 : 0.8;
        return Math.min(current + nextStep, 92);
      });
    }, 350);

    return () => {
      clearInterval(messageTimer);
      clearInterval(progressTimer);
    };
  }, [isSubmitting]);

  useEffect(() => {
    if (!fullResult) {
      setScoreDisplay(0);
      return;
    }

    setScoreDisplay(0);
    const total = fullResult.totalScore;
    let current = 0;

    const timer = setInterval(() => {
      current = Math.min(total, Number((current + 0.1).toFixed(2)));
      setScoreDisplay(current);
      if (current >= total) {
        clearInterval(timer);
      }
    }, 30);

    return () => clearInterval(timer);
  }, [fullResult]);

  const resetToUpload = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    if (inputRef.current) {
      inputRef.current.value = "";
    }

    setSelectedFile(null);
    setPreviewUrl("");
    setIsDragging(false);
    setErrorMessage("");
    setSafeResult(null);
    setFullResult(null);
    setIsSubmitting(false);
    setScoreDisplay(0);
    setLoadingMessageIndex(0);
    setProgress(0);
    resetPaymentState();
  };

  const validateFile = (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return "仅支持 JPG、PNG、WEBP 格式图片";
    }

    if (file.size > MAX_FILE_SIZE) {
      return "图片大小不能超过 10MB";
    }

    return "";
  };

  const handleSelectFile = (file: File) => {
    const validationMessage = validateFile(file);
    if (validationMessage) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setSelectedFile(null);
      setPreviewUrl("");
      setErrorMessage(validationMessage);
      setSafeResult(null);
      setFullResult(null);
      setScoreDisplay(0);
      resetPaymentState();
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setErrorMessage("");
    setSafeResult(null);
    setFullResult(null);
    setScoreDisplay(0);
    resetPaymentState();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    handleSelectFile(file);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    handleSelectFile(file);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setErrorMessage("请先上传一张清晰正脸照片");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSafeResult(null);
    setFullResult(null);
    setScoreDisplay(0);
    resetPaymentState();

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(getApiUrl("/analyze"), {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as SafeResult | { detail?: string };

      if (!response.ok) {
        throw new Error(getErrorMessage(data, "分析失败，请稍后重试"));
      }

      setProgress(100);
      await sleep(250);
      setSafeResult(data as SafeResult);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "分析失败，请稍后重试",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const closePayModal = () => {
    stopPolling();
    stopModalCloseTimer();
    setShowPayModal(false);
    setQrLoading(false);
  };

  const finalizePayment = (data: FullResult) => {
    stopPolling();
    stopModalCloseTimer();
    setPaySuccess(true);
    setQrLoading(false);
    setQrError("");
    setQrExpired(false);
    setFullResult(data);
    modalCloseTimerRef.current = setTimeout(() => {
      setShowPayModal(false);
      setPaySuccess(false);
    }, 500);
  };

  const fetchPaymentStatus = async (orderId: string) => {
    const response = await fetch(getApiUrl(`/check-payment/${orderId}`), {
      method: "GET",
      cache: "no-store",
    });
    const data = (await response.json()) as FullResult | { isPaid?: boolean; detail?: string };

    if (!response.ok) {
      throw new Error(getErrorMessage(data, "支付状态查询失败"));
    }

    if ("isPaid" in data && data.isPaid) {
      finalizePayment(data as FullResult);
      return true;
    }

    return false;
  };

  const handleOpenPayModal = async () => {
    if (!safeResult || qrLoading) return;

    stopPolling();
    stopModalCloseTimer();
    setShowPayModal(true);
    setQrLoading(true);
    setQrCodeUrl("");
    setQrError("");
    setQrExpired(false);
    setPaySuccess(false);

    try {
      const response = await fetch(getApiUrl("/create-order"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId: safeResult.orderId }),
      });
      const data = (await response.json()) as CreateOrderResponse;

      if (!response.ok) {
        throw new Error(getErrorMessage(data, "创建订单失败，请重试"));
      }

      if (data.isPaid) {
        await fetchPaymentStatus(safeResult.orderId);
        return;
      }

      if (!data.qrCode) {
        throw new Error("二维码生成失败，请重试");
      }

      setQrCodeUrl(data.qrCode);

      let elapsed = 0;
      pollTimerRef.current = setInterval(() => {
        elapsed += POLL_INTERVAL / 1000;
        if (elapsed >= QR_EXPIRE_SECONDS) {
          stopPolling();
          setQrExpired(true);
          return;
        }

        void fetchPaymentStatus(safeResult.orderId).catch(() => {
          setQrError("");
        });
      }, POLL_INTERVAL);
    } catch (error) {
      setQrError(
        error instanceof Error ? error.message : "创建订单失败，请重试",
      );
    } finally {
      setQrLoading(false);
    }
  };

  const renderUploadStage = (
    <section className="mx-auto w-full max-w-3xl rounded-[2rem] border border-white/10 bg-white/6 p-4 shadow-[0_32px_80px_rgba(0,0,0,0.35)] backdrop-blur">
      <div
        className={`rounded-[1.6rem] border border-dashed px-6 py-12 text-center transition ${
          isDragging ? "border-amber-300 bg-amber-200/10" : "border-white/15 bg-black/20"
        } ${isSubmitting ? "pointer-events-none opacity-80" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={handleFileChange}
        />
        <p className="text-xs font-medium uppercase tracking-[0.4em] text-white/45">
          上传照片
        </p>
        <h2
          className="mt-4 text-3xl font-semibold text-white md:text-4xl"
          style={{ fontFamily: '"Georgia", "Times New Roman", serif' }}
        >
          先看等级，再决定是否解锁完整分数
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-stone-300">
          拖拽或点击上传一张清晰正脸照片，系统会先展示你的综合等级、亮点和短板，再决定是否支付查看精确评分。
        </p>

        <div className="mt-8 grid gap-3 text-left text-sm text-stone-300 sm:grid-cols-3">
          {["正脸无遮挡", "光线均匀自然", "单张照片即可"].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      {previewUrl ? (
        <div className="mt-4 overflow-hidden rounded-[1.6rem] border border-white/10 bg-black/30">
          <Image
            src={previewUrl}
            alt="上传预览"
            width={960}
            height={960}
            unoptimized
            className="h-auto w-full object-cover"
          />
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-4 rounded-[1.5rem] border border-red-400/25 bg-red-500/10 px-5 py-4 text-sm text-red-100">
          {errorMessage}
        </div>
      ) : null}

      {isSubmitting ? (
        <div className="mt-4 rounded-[1.6rem] border border-white/10 bg-black/25 px-5 py-5">
          <p className="text-sm font-medium text-white">{LOADING_MESSAGES[loadingMessageIndex]}</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-white transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-stone-400">
            <span>分析通常需要 10-15 秒</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="mt-4 w-full rounded-full bg-amber-400 px-5 py-4 text-base font-bold text-black transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handleAnalyze}
          disabled={!selectedFile}
        >
          开始分析
        </button>
      )}
    </section>
  );

  const renderSummaryCard = safeResult ? (
    <section
      className="rounded-[2rem] border p-6 shadow-[0_32px_80px_rgba(0,0,0,0.35)] backdrop-blur"
      style={{
        background: `linear-gradient(135deg, ${safeResult.levelColor}33, ${safeResult.levelColor}22)`,
        borderColor: `${safeResult.levelColor}44`,
      }}
    >
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.4em] text-white/60">
            AI 综合评估
          </p>
          <h2
            className="mt-4 text-4xl font-semibold text-white md:text-5xl"
            style={{ fontFamily: '"Georgia", "Times New Roman", serif' }}
          >
            {safeResult.levelLabel}
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-white/82">
            {safeResult.levelDescription}
          </p>
          {fullResult ? (
            <div className="mt-5 inline-flex items-center rounded-full bg-emerald-500/18 px-4 py-2 text-sm font-medium text-emerald-100">
              ✓ 分析报告已解锁
            </div>
          ) : null}
        </div>

        <div className="min-w-[240px] rounded-[1.75rem] border border-white/15 bg-black/20 px-6 py-5 text-right backdrop-blur">
          <p className="text-xs font-medium uppercase tracking-[0.4em] text-white/45">
            综合分数
          </p>
          <p className="mt-4 text-6xl font-semibold leading-none text-white">
            {fullResult ? scoreDisplay.toFixed(2) : "???"}
          </p>
          <p className="mt-3 text-sm text-white/72">
            {fullResult ? "已显示完整精确评分" : "完成支付即可查看精确分数"}
          </p>
        </div>
      </div>
    </section>
  ) : null;

  const renderBasicInfo = safeResult ? (
    <section className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-[1.75rem] border border-white/10 bg-white/6 px-5 py-5 backdrop-blur">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-white/45">
          视觉年龄
        </p>
        <p className="mt-3 text-3xl font-semibold text-white">{safeResult.ageRange}</p>
      </div>
      <div className="rounded-[1.75rem] border border-white/10 bg-white/6 px-5 py-5 backdrop-blur">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-white/45">
          性别判断
        </p>
        <p className="mt-3 text-3xl font-semibold text-white">{genderLabel}</p>
      </div>
    </section>
  ) : null;

  const renderTeaserStage =
    safeResult && !fullResult ? (
      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="flex flex-col gap-6">
          {renderSummaryCard}
          {renderBasicInfo}

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-[1.8rem] border border-white/10 bg-white/6 p-5 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-semibold text-white">你的亮点</h3>
                <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-white/60">
                  可继续放大
                </span>
              </div>
              <div className="mt-5 flex flex-col gap-3">
                {safeResult.teaser.strongPoints.map((item) => (
                  <div
                    key={item}
                    className="flex gap-3 rounded-[1.25rem] border border-white/8 bg-black/18 px-4 py-4"
                  >
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs text-white/80">
                      锁
                    </span>
                    <p className="text-sm leading-7 text-stone-200">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-white/10 bg-white/6 p-5 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-semibold text-white">待提升</h3>
                <span className="rounded-full border border-amber-300/25 bg-amber-200/10 px-3 py-1 text-xs text-amber-100/80">
                  优先处理
                </span>
              </div>
              <div className="mt-5 flex flex-col gap-3">
                {safeResult.teaser.weakPoints.map((item) => (
                  <div
                    key={item}
                    className="flex gap-3 rounded-[1.25rem] border border-white/8 bg-black/18 px-4 py-4"
                  >
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-300/16 text-xs text-amber-100">
                      改
                    </span>
                    <p className="text-sm leading-7 text-stone-200">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="rounded-[1.8rem] border border-white/10 bg-white/6 p-5 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-semibold text-white">免费建议</h3>
              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100">
                已赠送
              </span>
            </div>
            <p className="mt-5 text-base leading-8 text-stone-100">
              {safeResult.teaser.oneFreeTip}
            </p>
            <p className="mt-4 text-sm text-stone-400">
              还有 {Math.max(safeResult.lockedContent.tipCount - 1, 0)} 条专业建议未解锁
            </p>
          </section>

          <section className="rounded-[1.8rem] border border-amber-300/20 bg-[linear-gradient(180deg,rgba(251,191,36,0.16),rgba(15,10,4,0.28))] p-5 backdrop-blur">
            <button
              type="button"
              className="w-full rounded-full bg-amber-400 px-5 py-4 text-base font-bold text-black shadow-[0_18px_45px_rgba(251,191,36,0.24)] animate-pulse transition hover:brightness-105"
              onClick={handleOpenPayModal}
            >
              解锁完整分析报告 ¥0.1
            </button>
            <p className="mt-4 text-sm leading-7 text-amber-50/90">
              {safeResult.lockedContent.message}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.2rem] border border-white/10 bg-black/15 px-4 py-3 text-sm text-stone-100">
                {safeResult.lockedContent.itemCount} 项逐维打分
              </div>
              <div className="rounded-[1.2rem] border border-white/10 bg-black/15 px-4 py-3 text-sm text-stone-100">
                {safeResult.lockedContent.tipCount} 条完整建议
              </div>
            </div>
          </section>

          <section className="rounded-[1.8rem] border border-white/10 bg-white/6 p-5 backdrop-blur">
            <p className="text-sm text-stone-300">已有 2847 人解锁完整报告</p>
            <p className="mt-3 text-2xl font-semibold text-white">
              平均反馈更知道该先改哪里，提升方向更明确
            </p>
          </section>
        </div>
      </div>
    ) : null;

  const renderPaidStage =
    safeResult && fullResult ? (
      <div className="space-y-6">
        {renderSummaryCard}
        {renderBasicInfo}

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[1.9rem] border border-white/10 bg-white/6 p-6 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-2xl font-semibold text-white">8 维精细评分</h3>
              <span
                className="rounded-full px-3 py-1 text-xs font-medium text-white/80"
                style={{ backgroundColor: `${accentColor}24`, border: `1px solid ${accentColor}35` }}
              >
                完整版
              </span>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {detailEntries.map(([key, item]) => {
                const barColor = getBarColor(item.score, accentColor);
                return (
                  <article
                    key={key}
                    className="rounded-[1.5rem] border border-white/10 bg-black/18 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-lg font-semibold text-white">{item.label}</h4>
                        <p className="mt-1 text-xs uppercase tracking-[0.32em] text-white/38">
                          维度评分
                        </p>
                      </div>
                      <p className="text-3xl font-semibold" style={{ color: barColor }}>
                        {item.score.toFixed(1)}
                      </p>
                    </div>
                    <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(Math.max(item.score, 0), 10) * 10}%`,
                          background: `linear-gradient(90deg, ${barColor}, ${accentColor})`,
                        }}
                      />
                    </div>
                    <p className="mt-4 text-sm leading-7 text-stone-300">{item.comment}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <div className="flex flex-col gap-6">
            <section className="rounded-[1.9rem] border border-white/10 bg-white/6 p-6 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-2xl font-semibold text-white">免费建议</h3>
                <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100">
                  3 条
                </span>
              </div>
              <div className="mt-5 flex flex-col gap-3">
                {fullResult.freeTips.map((tip, index) => (
                  <div
                    key={`${index + 1}-${tip}`}
                    className="flex gap-4 rounded-[1.3rem] border border-white/10 bg-black/18 px-4 py-4"
                  >
                    <span className="text-sm font-semibold text-emerald-200">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <p className="text-sm leading-7 text-stone-200">{tip}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[1.9rem] border border-white/10 bg-white/6 p-6 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-2xl font-semibold text-white">深度建议</h3>
                <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100">
                  已解锁
                </span>
              </div>
              <div className="mt-5 flex flex-col gap-4">
                {fullResult.lockedTips.map((tip) => (
                  <article
                    key={tip.title}
                    className="rounded-[1.4rem] border border-emerald-300/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(0,0,0,0.16))] px-4 py-4"
                  >
                    <h4 className="text-lg font-semibold text-white">{tip.title}</h4>
                    <p className="mt-3 text-sm leading-7 text-stone-200">{tip.content}</p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </div>

        <button
          type="button"
          className="w-full rounded-full border border-white/10 bg-white/6 px-5 py-4 text-base font-semibold text-white transition hover:bg-white/10"
          onClick={resetToUpload}
        >
          重新分析
        </button>
      </div>
    ) : null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),transparent_30%),radial-gradient(circle_at_right,rgba(244,114,182,0.1),transparent_28%),linear-gradient(180deg,#171114_0%,#0e0c13_45%,#08070b_100%)] px-4 py-8 text-white md:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.45em] text-white/40">
              MirrorScore
            </p>
            <h1
              className="mt-3 text-4xl font-semibold text-white md:text-5xl"
              style={{ fontFamily: '"Georgia", "Times New Roman", serif' }}
            >
              先看等级，再解锁完整报告
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-300">
              结果页会先隐藏精确分数，仅展示等级、亮点与一条免费建议。支付后自动解锁 8 项逐维评分和完整优化方案。
            </p>
          </div>

          <div className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-stone-200">
            ¥0.1 解锁完整分析
          </div>
        </header>

        {safeResult === null ? renderUploadStage : null}
        {safeResult && !fullResult ? renderTeaserStage : null}
        {safeResult && fullResult ? renderPaidStage : null}
      </div>

      {showPayModal && safeResult ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 px-4 backdrop-blur-sm"
          onClick={closePayModal}
        >
          <div
            className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[#fff9ef] p-6 text-stone-900 shadow-[0_32px_90px_rgba(0,0,0,0.45)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.35em] text-stone-500">
                  支付解锁
                </p>
                <h2
                  className="mt-3 text-3xl font-semibold text-stone-900"
                  style={{ fontFamily: '"Georgia", "Times New Roman", serif' }}
                >
                  扫码查看完整分析
                </h2>
              </div>
              <button
                type="button"
                className="rounded-full border border-stone-200 px-3 py-2 text-sm text-stone-500 transition hover:bg-stone-100 hover:text-stone-700"
                onClick={closePayModal}
              >
                关闭
              </button>
            </div>

            <div className="mt-6 rounded-[1.7rem] border border-stone-200 bg-white px-5 py-6 text-center">
              <p className="text-sm text-stone-500">支付金额</p>
              <p className="mt-2 text-5xl font-semibold text-stone-900">¥0.1</p>

              <div className="mx-auto mt-6 flex h-[220px] w-[220px] items-center justify-center rounded-[1.5rem] border border-stone-200 bg-stone-50">
                {paySuccess ? (
                  <div className="text-center text-emerald-600">
                    <div className="text-6xl font-semibold">✓</div>
                    <p className="mt-3 text-sm font-medium">支付成功，正在解锁报告</p>
                  </div>
                ) : qrLoading ? (
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-stone-200 border-t-stone-700" />
                ) : qrError ? (
                  <div className="px-4 text-center">
                    <p className="text-sm leading-7 text-red-500">{qrError}</p>
                    <button
                      type="button"
                      className="mt-4 rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
                      onClick={handleOpenPayModal}
                    >
                      重新生成
                    </button>
                  </div>
                ) : qrExpired ? (
                  <div className="px-4 text-center">
                    <p className="text-sm leading-7 text-stone-600">二维码已过期，请重新生成</p>
                    <button
                      type="button"
                      className="mt-4 rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
                      onClick={handleOpenPayModal}
                    >
                      重新生成
                    </button>
                  </div>
                ) : qrCodeUrl ? (
                  <QRCode value={qrCodeUrl} size={180} />
                ) : (
                  <p className="px-4 text-sm text-stone-500">正在生成支付二维码…</p>
                )}
              </div>

              <p className="mt-5 text-sm leading-7 text-stone-600">
                请使用支付宝扫码支付，支付成功后自动解锁，无需手动刷新页面。
              </p>
            </div>

            <div className="mt-4 rounded-[1.35rem] bg-stone-100 px-4 py-4 text-sm leading-7 text-stone-600">
              <p>订单号：{safeResult.orderId}</p>
              <p>二维码 60 秒内有效，系统每 3 秒自动检查支付状态。</p>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
