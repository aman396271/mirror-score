"use client";

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";

type DetailItem = {
  score: number;
  label: string;
  comment: string;
};

type LockedTip = {
  title: string;
  content: string;
};

type AnalyzeResult = {
  totalScore: number;
  ageRange: string;
  gender: string;
  details: {
    eyes: DetailItem;
    eyeDistance: DetailItem;
    nose: DetailItem;
    mouth: DetailItem;
    faceShape: DetailItem;
    skinTone: DetailItem;
    proportion: DetailItem;
    hairStyle: DetailItem;
  };
  freeTips: string[];
  lockedTips: LockedTip[];
  orderId: string;
  isPaid: boolean;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const LOADING_MESSAGES = [
  "AI \u6b63\u5728\u626b\u63cf\u9762\u90e8\u7279\u5f81...",
  "\u6b63\u5728\u5206\u6790\u4e94\u5b98\u6bd4\u4f8b\u4e0e\u5bf9\u79f0\u6027...",
  "\u6b63\u5728\u8bc4\u4f30\u80a4\u8272\u4e0e\u80a4\u8d28...",
  "\u6b63\u5728\u8ba1\u7b97\u773c\u8ddd\u4e0e\u8138\u578b\u5339\u914d\u5ea6...",
  "\u6b63\u5728\u751f\u6210\u4e2a\u6027\u5316\u6539\u5584\u5efa\u8bae...",
  "\u5373\u5c06\u5b8c\u6210\uff0c\u8bf7\u7a0d\u5019...",
];

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [canRetry, setCanRetry] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showPayModal, setShowPayModal] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [paidTips, setPaidTips] = useState<LockedTip[]>([]);
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState("");

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!isSubmitting) return;
    setLoadingMsgIdx(0);
    setProgress(0);

    const msgTimer = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 3000);

    const progTimer = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return p;
        const step = p < 40 ? 3 : p < 70 ? 1.5 : 0.5;
        return Math.min(p + step, 90);
      });
    }, 400);

    return () => {
      clearInterval(msgTimer);
      clearInterval(progTimer);
    };
  }, [isSubmitting]);

  const validateFile = (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return "Only JPG, PNG, and WEBP files are supported.";
    }

    if (file.size > MAX_FILE_SIZE) {
      return "File size must be 10MB or less.";
    }

    return "";
  };

  const resetToUpload = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(null);
    setPreviewUrl("");
    setErrorMessage("");
    setCanRetry(false);
    setResult(null);
    setIsSubmitting(false);
    setIsPaid(false);
    setPaidTips([]);
    setShowPayModal(false);
    setPayLoading(false);
    setPayError("");
  };

  const updateSelectedFile = (file: File) => {
    const validationMessage = validateFile(file);
    if (validationMessage) {
      setSelectedFile(null);
      setResult(null);
      setErrorMessage(validationMessage);
      setCanRetry(false);
      setIsPaid(false);
      setPaidTips([]);
      setShowPayModal(false);
      setPayLoading(false);
      setPayError("");

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl("");
      }

      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
    setErrorMessage("");
    setCanRetry(false);
    setIsPaid(false);
    setPaidTips([]);
    setShowPayModal(false);
    setPayLoading(false);
    setPayError("");
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    updateSelectedFile(file);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    updateSelectedFile(file);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setErrorMessage("Please upload an image before starting analysis.");
      setCanRetry(false);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setCanRetry(false);
    setShowPayModal(false);
    setIsPaid(false);
    setPaidTips([]);
    setPayLoading(false);
    setPayError("");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(`${apiUrl}/analyze`, {
        method: "POST",
        body: formData,
      });

      const responseData = (await response.json()) as AnalyzeResult | { detail?: string };

      if (!response.ok) {
        throw new Error(
          typeof responseData === "object" && responseData && "detail" in responseData
            ? responseData.detail || "Analysis request failed."
            : "Analysis request failed.",
        );
      }

      setProgress(100);
      await new Promise((r) => setTimeout(r, 300));

      const analyzeResult = responseData as AnalyzeResult;
      setResult(analyzeResult);
      setIsPaid(analyzeResult.isPaid);
      setPaidTips(analyzeResult.isPaid ? analyzeResult.lockedTips : []);
      setErrorMessage("");
      setCanRetry(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Analysis failed. Please try again later.",
      );
      setCanRetry(true);
      setResult(null);
      setIsPaid(false);
      setPaidTips([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!result) return;
    setPayLoading(true);
    setPayError("");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const res = await fetch(`${apiUrl}/confirm-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: result.orderId }),
      });
      const data = (await res.json()) as { success?: boolean; lockedTips?: LockedTip[] };

      if (res.ok && data.success) {
        setPaidTips(data.lockedTips ?? []);
        setIsPaid(true);
        setResult((current) => (current ? { ...current, isPaid: true } : current));
        setShowPayModal(false);
      } else {
        setPayError("\u9a8c\u8bc1\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5");
      }
    } catch {
      setPayError("\u7f51\u7edc\u9519\u8bef\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5");
    } finally {
      setPayLoading(false);
    }
  };

  const genderLabel =
    result?.gender === "female"
      ? "\u5973"
      : result?.gender === "male"
        ? "\u7537"
        : result?.gender ?? "--";

  const detailEntries = result ? Object.entries(result.details) : [];

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-10 text-white">
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">MirrorScore</h1>
          <p className="mt-2 text-sm text-neutral-300">
            {"\u81ea\u62cd\u4e0a\u955c\u8868\u73b0\u5206\u6790\u5e73\u53f0"}
          </p>
        </div>

        {!result ? (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20">
            <div
              className={`rounded-2xl border border-dashed px-6 py-10 text-center transition ${
                isDragging
                  ? "border-white bg-white/10"
                  : "border-white/20 bg-black/20"
              } ${isSubmitting ? "pointer-events-none opacity-70" : ""}`}
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
              <p className="text-lg font-semibold">
                {"\u70b9\u51fb\u4e0a\u4f20\u6216\u62d6\u62fd\u56fe\u7247\u5230\u8fd9\u91cc"}
              </p>
              <p className="mt-2 text-sm text-neutral-300">
                JPG / PNG / WEBP, up to 10MB
              </p>
            </div>

            {previewUrl ? (
              <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Selected preview"
                  className="h-auto w-full object-cover"
                />
              </div>
            ) : null}

            {errorMessage ? (
              <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4">
                <p className="text-sm text-red-200">{errorMessage}</p>
                {canRetry ? (
                  <button
                    type="button"
                    className="mt-3 rounded-full border border-red-300/30 px-4 py-2 text-sm font-medium text-red-100 transition hover:bg-red-400/10"
                    onClick={handleAnalyze}
                  >
                    {"\u91cd\u8bd5"}
                  </button>
                ) : null}
              </div>
            ) : null}

            {isSubmitting ? (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-5">
                <p className="text-center text-sm font-medium text-white">
                  {LOADING_MESSAGES[loadingMsgIdx]}
                </p>
                <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-white transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-3 flex justify-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="inline-block h-1.5 w-1.5 rounded-full bg-white/60"
                      style={{ animation: `pulse 1.2s ease-in-out ${i * 0.4}s infinite` }}
                    />
                  ))}
                </div>
                <p className="mt-3 text-center text-xs text-neutral-500">
                  {"\u5206\u6790\u901a\u5e38\u9700\u8981 10-15 \u79d2"}
                </p>
              </div>
            ) : (
              <button
                type="button"
                className="mt-5 w-full rounded-full bg-white px-4 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200"
                onClick={handleAnalyze}
              >
                {"\u5f00\u59cb\u5206\u6790"}
              </button>
            )}
          </section>
        ) : (
          <>
            <section className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-6 shadow-2xl shadow-black/20">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-5xl font-bold tracking-tight">
                    {result.totalScore.toFixed(2)}
                    <span className="ml-1 text-xl text-emerald-100/80">/10</span>
                  </p>
                  <p className="mt-2 text-sm text-emerald-100">
                    {"\u7efc\u5408\u5f97\u5206"}
                  </p>
                </div>
                <div className="text-right text-sm text-emerald-50">
                  <p>
                    {"\u89c6\u89c9\u5e74\u9f84"}: {result.ageRange}
                  </p>
                  <p className="mt-1">
                    {"\u6027\u522b"}: {genderLabel}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold">
                {"\u516b\u7ef4\u5206\u6790"}
              </h2>
              <div className="mt-4 flex flex-col gap-4">
                {detailEntries.map(([key, item]) => {
                  const colorClass =
                    item.score >= 8
                      ? "bg-emerald-400"
                      : item.score >= 6
                        ? "bg-amber-400"
                        : "bg-red-400";
                  const textClass =
                    item.score >= 8
                      ? "text-emerald-300"
                      : item.score >= 6
                        ? "text-amber-300"
                        : "text-red-300";

                  return (
                    <div
                      key={key}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-white">{item.label}</p>
                        <p className={`text-sm font-semibold ${textClass}`}>
                          {item.score.toFixed(2)}
                        </p>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-white/10">
                        <div
                          className={`h-2 rounded-full ${colorClass}`}
                          style={{ width: `${Math.min(Math.max(item.score, 0), 10) * 10}%` }}
                        />
                      </div>
                      <p className="mt-3 text-sm leading-6 text-neutral-300">
                        {item.comment}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">
                  {"\u514d\u8d39\u5efa\u8bae"}
                </h2>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-200">
                  {"\u514d\u8d39"}
                </span>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                {result.freeTips.map((tip, index) => (
                  <div
                    key={`${index + 1}-${tip}`}
                    className="flex gap-4 rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <span className="text-sm font-semibold text-emerald-300">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <p className="text-sm leading-6 text-neutral-200">{tip}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">
                  {"\u6df1\u5ea6\u5206\u6790\u62a5\u544a"}
                </h2>
                {isPaid ? (
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-200">
                    {"\u5df2\u89e3\u9501"}
                  </span>
                ) : (
                  <span className="rounded-full border border-amber-400/30 bg-amber-400/15 px-3 py-1 text-xs font-medium text-amber-200">
                    {"\u4ed8\u8d39"}
                  </span>
                )}
              </div>

              {isPaid ? (
                <div className="mt-4 flex flex-col gap-3">
                  {paidTips.map((tip, index) => (
                    <div
                      key={`${index + 1}-${tip.title}`}
                      className="rounded-2xl border border-emerald-300/15 bg-black/20 p-4"
                    >
                      <p className="text-sm font-semibold text-emerald-200">{tip.title}</p>
                      <p className="mt-2 text-sm leading-6 text-neutral-200">{tip.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="mt-4 flex flex-col gap-3">
                    {result.lockedTips.map((tip, index) => (
                      <div
                        key={`${index + 1}-${tip.title}`}
                        className="rounded-2xl border border-white/10 bg-black/20 p-4"
                      >
                        <p className="text-sm font-semibold text-amber-100">{tip.title}</p>
                        <p className="mt-2 text-sm leading-6 text-white/75 blur-sm select-none">
                          {tip.content ||
                            "\u652f\u4ed8\u540e\u53ef\u67e5\u770b\u5b8c\u6574\u4e2a\u6027\u5316\u5efa\u8bae\u5185\u5bb9\uff0c\u5305\u542b\u5177\u4f53\u6267\u884c\u65b9\u6cd5\u3001\u539f\u56e0\u8bf4\u660e\u4e0e\u6548\u679c\u9884\u671f\u3002"}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5">
                    <button
                      type="button"
                      className="w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-neutral-950 shadow-lg shadow-black/30 transition hover:bg-amber-50"
                      onClick={() => {
                        setPayError("");
                        setShowPayModal(true);
                      }}
                    >
                      {"\u89e3\u9501\u5b8c\u6574\u5efa\u8bae \u00a59.9"}
                    </button>
                    <p className="mt-2 text-center text-xs text-amber-100/80">
                      {"\u652f\u4ed8\u540e\u5373\u53ef\u67e5\u770b 5 \u6761\u6df1\u5ea6\u4e2a\u6027\u5316\u5efa\u8bae"}
                    </p>
                  </div>
                </>
              )}
            </section>

            <button
              type="button"
              className="rounded-full border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              onClick={resetToUpload}
            >
              {"\u91cd\u65b0\u5206\u6790"}
            </button>
          </>
        )}
      </div>

      {showPayModal && result ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => {
            setShowPayModal(false);
          }}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-3xl bg-white p-6 text-neutral-950 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-end">
              <button
                type="button"
                className="rounded-full p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700"
                onClick={() => {
                  setShowPayModal(false);
                }}
              >
                X
              </button>
            </div>

            <h2 className="text-center text-xl font-semibold text-neutral-950">
              {"\u89e3\u9501\u5b8c\u6574\u5206\u6790\u5efa\u8bae"}
            </h2>
            <p className="mt-3 text-center text-4xl font-bold text-emerald-600">
              {"\u00a59.9"}
            </p>

            <div className="mt-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/alipay-qr.png"
                alt="Alipay QR code"
                className="mx-auto w-[200px]"
              />
            </div>

            <p className="mt-4 text-center text-sm text-neutral-600">
              {"\u8bf7\u7528\u652f\u4ed8\u5b9d\u626b\u7801\u652f\u4ed8 9.9 \u5143"}
            </p>
            <p className="mt-2 text-center text-xs text-neutral-400">
              {"\u8ba2\u5355\u53f7\uff1a"}
              {result.orderId}
            </p>

            <button
              type="button"
              className="mt-5 w-full rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-300"
              onClick={handleConfirmPayment}
              disabled={payLoading}
            >
              {payLoading ? "\u9a8c\u8bc1\u4e2d..." : "\u6211\u5df2\u5b8c\u6210\u652f\u4ed8"}
            </button>

            {payError ? (
              <p className="mt-3 text-center text-sm text-red-500">{payError}</p>
            ) : null}

            <p className="mt-4 text-center text-xs text-neutral-500">
              {"\u652f\u4ed8\u9047\u5230\u95ee\u9898\uff1f\u8054\u7cfb\u5fae\u4fe1\uff1amirrorscore_support"}
            </p>
          </div>
        </div>
      ) : null}
    </main>
  );
}
