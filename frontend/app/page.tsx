"use client";

import Image from "next/image";
import {
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
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
  "AI 正在研究你的五官比例…",
  "正在分析最适合你的风格方向…",
  "好的分析需要一点时间，就像好咖啡需要慢慢萃取 ☕",
  "正在匹配你的个性化提升建议…",
  "你的专属报告即将生成…",
  "最后润色中，马上就好 ✨",
];
const REVEAL_SEQUENCE = [
  { key: "header", delay: 0 },
  { key: "basicInfo", delay: 400 },
  { key: "teaser", delay: 900 },
  { key: "freeTip", delay: 1400 },
  { key: "cta", delay: 2000 },
] as const;

type VisibleSectionKey = (typeof REVEAL_SEQUENCE)[number]["key"];

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
  if (gender === "female") return "女性";
  if (gender === "male") return "男性";
  return gender;
};

const getBarColor = (score: number, accent: string) => {
  if (score >= 7.5) return accent;
  if (score >= 6) return "#f59e0b";
  return "#fb7185";
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function RevealSection({
  show,
  className,
  children,
}: {
  show: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(show);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setMounted(true);
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }

    setVisible(false);
    const timer = setTimeout(() => setMounted(false), 500);
    return () => clearTimeout(timer);
  }, [show]);

  if (!mounted) return null;

  return (
    <div
      className={className}
      style={{ opacity: visible ? 1 : 0, transition: "opacity 0.5s" }}
    >
      {children}
    </div>
  );
}

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
  const [visibleSections, setVisibleSections] = useState<Set<VisibleSectionKey>>(new Set());

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

  useEffect(() => {
    if (!safeResult || fullResult) {
      setVisibleSections(new Set());
      return;
    }

    setVisibleSections(new Set());

    const timers = REVEAL_SEQUENCE.map(({ key, delay }) =>
      setTimeout(() => {
        setVisibleSections((current) => {
          const next = new Set(current);
          next.add(key);
          return next;
        });
      }, delay),
    );

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [safeResult, fullResult]);

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
    setVisibleSections(new Set());
    resetPaymentState();
  };

  const validateFile = (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return "请上传 JPG、PNG 或 WEBP 格式的照片";
    }

    if (file.size > MAX_FILE_SIZE) {
      return "照片大小请控制在 10MB 以内";
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
      setVisibleSections(new Set());
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
    setVisibleSections(new Set());
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
      setErrorMessage("先上传一张清晰自拍，我们再开始分析");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSafeResult(null);
    setFullResult(null);
    setScoreDisplay(0);
    setVisibleSections(new Set());
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
        throw new Error(getErrorMessage(data, "分析暂时出了点小问题，请稍后再试"));
      }

      setProgress(100);
      await sleep(250);
      setSafeResult(data as SafeResult);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "分析暂时出了点小问题，请稍后再试",
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
      throw new Error(getErrorMessage(data, "支付状态查询失败，请稍后重试"));
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
        throw new Error(getErrorMessage(data, "创建订单失败，请稍后重试"));
      }

      if (data.isPaid) {
        await fetchPaymentStatus(safeResult.orderId);
        return;
      }

      if (!data.qrCode) {
        throw new Error("二维码生成失败，请重新打开支付");
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
        error instanceof Error ? error.message : "创建订单失败，请稍后重试",
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
          自拍上传区
        </p>
        <h2
          className="mt-4 text-3xl font-semibold text-white md:text-4xl"
          style={{ fontFamily: '"Georgia", "Times New Roman", serif' }}
        >
          每张脸都有独特魅力 ✨
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-8 text-stone-200">
          上传自拍，解锁你的专属颜值报告
        </p>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-stone-400">
          点击上传或拖拽照片到这里
        </p>

        <div className="mt-8 grid gap-3 text-left text-sm text-stone-300 sm:grid-cols-3">
          {["正脸更清晰", "自然光更出片", "单张照片就够"].map((item) => (
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
            <span>通常需要 10-15 秒，请给 AI 一点点时间</span>
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
          开始我的面部分析
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
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
            {previewUrl ? (
              <Image
                src={previewUrl}
                alt="你的照片"
                width={80}
                height={80}
                unoptimized
                className="h-20 w-20 rounded-full border-2 border-white object-cover shadow-[0_12px_30px_rgba(0,0,0,0.25)]"
              />
            ) : null}

            <div>
              <p className="text-xs font-medium uppercase tracking-[0.4em] text-white/60">
                你的气质等级
              </p>
              <h2
                className="mt-3 text-4xl font-semibold text-white md:text-5xl"
                style={{ fontFamily: '"Georgia", "Times New Roman", serif' }}
              >
                {safeResult.levelLabel}
              </h2>
            </div>
          </div>

          <p className="mt-4 max-w-xl text-sm leading-7 text-white/82">
            {safeResult.levelDescription}
          </p>

          {fullResult ? (
            <div className="mt-5 inline-flex items-center rounded-full bg-emerald-500/18 px-4 py-2 text-sm font-medium text-emerald-100">
              你的专属颜值报告已解锁！
            </div>
          ) : null}
        </div>

        <div className="min-w-[240px] rounded-[1.75rem] border border-white/15 bg-black/20 px-6 py-5 text-center backdrop-blur sm:text-right">
          <p className="text-xs font-medium uppercase tracking-[0.4em] text-white/45">
            完整评分
          </p>
          <p className="mt-4 text-6xl font-semibold leading-none text-white">
            {fullResult ? scoreDisplay.toFixed(2) : "???"}
          </p>
          <p className="mt-3 text-sm text-white/72">
            {fullResult ? "完整评分已经为你揭晓" : "解锁后立刻揭晓你的精确评分"}
          </p>
        </div>
      </div>
    </section>
  ) : null;

  const renderBasicInfo = safeResult ? (
    <section className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-[1.75rem] border border-white/10 bg-white/6 px-5 py-5 backdrop-blur">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-white/45">
          视觉年龄感
        </p>
        <p className="mt-3 text-3xl font-semibold text-white">{safeResult.ageRange}</p>
      </div>
      <div className="rounded-[1.75rem] border border-white/10 bg-white/6 px-5 py-5 backdrop-blur">
        <p className="text-xs font-medium uppercase tracking-[0.35em] text-white/45">
          性别识别
        </p>
        <p className="mt-3 text-3xl font-semibold text-white">{genderLabel}</p>
      </div>
    </section>
  ) : null;

  const renderTeaserStage =
    safeResult && !fullResult ? (
      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="flex flex-col gap-6">
          <RevealSection show={visibleSections.has("header")}>{renderSummaryCard}</RevealSection>
          <RevealSection show={visibleSections.has("basicInfo")}>{renderBasicInfo}</RevealSection>

          <RevealSection show={visibleSections.has("teaser")}>
            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-[1.8rem] border border-white/10 bg-white/6 p-5 backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-semibold text-white">你天然的优势</h3>
                  <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-white/60">
                    继续发光
                  </span>
                </div>
                <div className="mt-5 flex flex-col gap-3">
                  {safeResult.teaser.strongPoints.map((item) => (
                    <div
                      key={item}
                      className="flex gap-3 rounded-[1.25rem] border border-white/8 bg-black/18 px-4 py-4"
                    >
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs text-white/80">
                        优
                      </span>
                      <p className="text-sm leading-7 text-stone-200">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-white/10 bg-white/6 p-5 backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-semibold text-white">你的提升空间</h3>
                  <span className="rounded-full border border-amber-300/25 bg-amber-200/10 px-3 py-1 text-xs text-amber-100/80">
                    慢慢优化
                  </span>
                </div>
                <div className="mt-5 flex flex-col gap-3">
                  {safeResult.teaser.weakPoints.map((item) => (
                    <div
                      key={item}
                      className="flex gap-3 rounded-[1.25rem] border border-white/8 bg-black/18 px-4 py-4"
                    >
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-300/16 text-xs text-amber-100">
                        进
                      </span>
                      <p className="text-sm leading-7 text-stone-200">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </RevealSection>
        </div>

        <div className="flex flex-col gap-6">
          <RevealSection show={visibleSections.has("freeTip")}>
            <section className="rounded-[1.8rem] border border-white/10 bg-white/6 p-5 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-semibold text-white">先送你一条实用建议</h3>
                <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100">
                  免费试看
                </span>
              </div>
              <p className="mt-5 text-base leading-8 text-stone-100">
                {safeResult.teaser.oneFreeTip}
              </p>
              <p className="mt-4 text-sm text-stone-400">
                还有 {Math.max(safeResult.lockedContent.tipCount - 1, 0)} 条个性化提升方案等你解锁
              </p>
            </section>
          </RevealSection>

          <RevealSection show={visibleSections.has("cta")}>
            <div className="flex flex-col gap-6">
              <section className="rounded-[1.8rem] border border-amber-300/20 bg-[linear-gradient(180deg,rgba(251,191,36,0.16),rgba(15,10,4,0.28))] p-5 backdrop-blur">
                <button
                  type="button"
                  className="w-full rounded-full bg-amber-400 px-5 py-4 text-base font-bold text-black shadow-[0_18px_45px_rgba(251,191,36,0.24)] animate-pulse transition hover:brightness-105"
                  onClick={handleOpenPayModal}
                >
                  解锁我的完整颜值报告 ¥9.9
                </button>
                <p className="mt-4 text-sm leading-7 text-amber-50/90">
                  比一杯咖啡还便宜，但可能改变你的自拍方式 ☕
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.2rem] border border-white/10 bg-black/15 px-4 py-3 text-sm text-stone-100">
                    {safeResult.lockedContent.itemCount} 项细分维度评分
                  </div>
                  <div className="rounded-[1.2rem] border border-white/10 bg-black/15 px-4 py-3 text-sm text-stone-100">
                    {safeResult.lockedContent.tipCount} 条完整提升建议
                  </div>
                </div>
              </section>

              <section className="rounded-[1.8rem] border border-white/10 bg-white/6 p-5 backdrop-blur">
                <p className="text-sm text-stone-300">已有 2,847 位用户解锁了完整报告</p>
                <p className="mt-3 text-2xl font-semibold text-white">
                  用户反馈：看完建议后，自拍好看多了
                </p>
              </section>
            </div>
          </RevealSection>
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
                完整报告
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
                <h3 className="text-2xl font-semibold text-white">立即可用的小技巧 ✨</h3>
                <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100">
                  {fullResult.freeTips.length} 条
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
                <h3 className="text-2xl font-semibold text-white">你的专属提升方案</h3>
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
          换张照片再试试 →
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
              先看见自己的亮点，再解锁完整颜值报告
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-300">
              上传自拍，先收下一份关于天然优势与风格方向的温柔分析；如果你喜欢，再解锁完整的
              8 维评分与个性化提升方案。
            </p>
          </div>

          <div className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-stone-200">
            ¥9.9 解锁完整颜值报告
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
                  用支付宝扫一扫
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
              <p className="text-sm text-stone-500">当前价格</p>
              <p className="mt-2 text-5xl font-semibold text-stone-900">¥9.9</p>

              <div className="mx-auto mt-6 flex h-[220px] w-[220px] items-center justify-center rounded-[1.5rem] border border-stone-200 bg-stone-50">
                {paySuccess ? (
                  <div className="text-center text-emerald-600">
                    <div className="text-6xl font-semibold">✓</div>
                    <p className="mt-3 text-sm font-medium">支付成功，正在为你解锁报告</p>
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
                支付成功后自动解锁，通常在 3 秒内完成
              </p>
            </div>

            <div className="mt-4 rounded-[1.35rem] bg-stone-100 px-4 py-4 text-sm leading-7 text-stone-600">
              <p>订单编号：{safeResult.orderId}</p>
              <p>二维码 60 秒内有效，系统会每 3 秒自动检查一次支付状态。</p>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
