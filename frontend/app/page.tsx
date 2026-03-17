"use client";

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";

type DetailItem = {
  score: number;
  label: string;
  comment: string;
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
  lockedTips: string[];
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [canRetry, setCanRetry] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

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
  };

  const updateSelectedFile = (file: File) => {
    const validationMessage = validateFile(file);
    if (validationMessage) {
      setSelectedFile(null);
      setResult(null);
      setErrorMessage(validationMessage);
      setCanRetry(false);

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

      setResult(responseData as AnalyzeResult);
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
    } finally {
      setIsSubmitting(false);
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

            <button
              type="button"
              className="mt-5 w-full rounded-full bg-white px-4 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-500 disabled:text-neutral-200"
              onClick={handleAnalyze}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "AI \u6b63\u5728\u5206\u6790\u4f60\u7684\u7167\u7247..."
                : "\u5f00\u59cb\u5206\u6790"}
            </button>
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

            <section className="relative overflow-hidden rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">
                  {"\u6df1\u5ea6\u5206\u6790\u62a5\u544a"}
                </h2>
                <span className="rounded-full border border-amber-400/30 bg-amber-400/15 px-3 py-1 text-xs font-medium text-amber-200">
                  {"\u4ed8\u8d39"}
                </span>
              </div>

              <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="space-y-3 blur-sm select-none">
                  {result.lockedTips.map((tip, index) => (
                    <div
                      key={`${index + 1}-${tip}`}
                      className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/70"
                    >
                      {tip}
                    </div>
                  ))}
                </div>

                <div className="absolute inset-0 bg-neutral-950/45" />

                <div className="absolute inset-0 flex items-center justify-center px-6">
                  <button
                    type="button"
                    className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-neutral-950 shadow-lg shadow-black/30 transition hover:bg-amber-50"
                    onClick={() =>
                      window.alert("\u529f\u80fd\u5373\u5c06\u4e0a\u7ebf\uff0c\u656c\u8bf7\u671f\u5f85")
                    }
                  >
                    {"\u89e3\u9501\u5b8c\u6574\u5efa\u8bae \u00a59.9"}
                  </button>
                </div>
              </div>
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
    </main>
  );
}
