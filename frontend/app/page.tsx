"use client";

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SubScore = {
  score: number;
  label: string;
};

type AnalyzeResponse = {
  scoreTotal: number;
  ageRange: string;
  subScores: {
    imageQuality: SubScore;
    facePose: SubScore;
    expression: SubScore;
    contour: SubScore;
    style: SubScore;
  };
  freeSummary: string[];
  isLocked: boolean;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function Home() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
      return "File size must be 5MB or less.";
    }

    return "";
  };

  const updateSelectedFile = (file: File) => {
    const validationMessage = validateFile(file);
    if (validationMessage) {
      setSelectedFile(null);
      setErrorMessage(validationMessage);

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
    setErrorMessage("");
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

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const resultValue = reader.result;
        if (typeof resultValue !== "string") {
          reject(new Error("Unable to read file."));
          return;
        }

        const [, base64 = ""] = resultValue.split(",");
        resolve(base64);
      };

      reader.onerror = () => reject(new Error("Unable to read file."));
      reader.readAsDataURL(file);
    });

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setErrorMessage("Please upload an image before starting analysis.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const imageBase64 = await fileToBase64(selectedFile);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const response = await fetch(`${apiUrl}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image_base64: imageBase64 }),
      });

      if (!response.ok) {
        throw new Error("Analysis request failed.");
      }

      const data = (await response.json()) as AnalyzeResponse;
      router.push(`/result?data=${encodeURIComponent(JSON.stringify(data))}`);
    } catch {
      setErrorMessage("Analysis failed. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-10 text-white">
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">MirrorScore</h1>
          <p className="mt-2 text-sm text-neutral-300">
            {"\u81ea\u62cd\u4e0a\u955c\u8868\u73b0\u5206\u6790\u5e73\u53f0"}
          </p>
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20">
          <div
            className={`rounded-2xl border border-dashed px-6 py-10 text-center transition ${
              isDragging
                ? "border-white bg-white/10"
                : "border-white/20 bg-black/20"
            }`}
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
            <p className="text-lg font-semibold">Click to upload or drag here</p>
            <p className="mt-2 text-sm text-neutral-300">
              JPG / PNG / WEBP, up to 5MB
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
            <p className="mt-4 text-sm text-red-300">{errorMessage}</p>
          ) : null}

          <button
            type="button"
            className="mt-5 w-full rounded-full bg-white px-4 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-500 disabled:text-neutral-200"
            onClick={handleAnalyze}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "\u5206\u6790\u4e2d..."
              : "\u5f00\u59cb\u5206\u6790"}
          </button>
        </section>
      </div>
    </main>
  );
}
