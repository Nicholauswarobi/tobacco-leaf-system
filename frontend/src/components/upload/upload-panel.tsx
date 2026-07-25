"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import {
  Camera,
  ImagePlus,
  X,
  Loader2,
  Sparkles,
  CheckCircle2,
  Leaf,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { api, NotATobaccoLeafError } from "@/lib/api";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";
import type { VerificationResult } from "@/types";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

interface UploadPanelProps {
  mode?: "disease" | "quality";
}

export function UploadPanel({ mode = "disease" }: UploadPanelProps) {
  const router = useRouter();
  const setLatest = useAppStore((s) => s.setLatest);
  const setPredicting = useAppStore((s) => s.setPredicting);
  const setError = useAppStore((s) => s.setError);
  const isPredicting = useAppStore((s) => s.isPredicting);
  const error = useAppStore((s) => s.error);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Rejection by the Tobacco Verification gate is not an error — the system
  // worked and the image simply is not a leaf. Tracked separately so it can be
  // shown as guidance instead of a red failure banner.
  const [rejection, setRejection] = useState<VerificationResult | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const acceptFile = useCallback(
    (f: File) => {
      if (f.size > MAX_BYTES) {
        setError(`File too large (${(f.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB.`);
        return;
      }
      setError(null);
      setRejection(null);
      setFile(f);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(f));
    },
    [previewUrl, setError]
  );

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) acceptFile(accepted[0]);
    },
    [acceptFile]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxFiles: 1,
    maxSize: MAX_BYTES,
    noClick: !!file,
  });

  const onCameraClick = () => cameraInputRef.current?.click();
  const onCameraChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0];
    if (f) acceptFile(f);
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setError(null);
    setRejection(null);
  };

  const submit = async () => {
    if (!file) return;
    setPredicting(true);
    setError(null);
    setRejection(null);
    try {
      let result;
      if (mode === "quality") {
        result = await api.predictQuality(file);
      } else {
        result = await api.predictDisease(file);
      }
      setLatest(result);
      router.push("/result");
    } catch (e: unknown) {
      if (e instanceof NotATobaccoLeafError) {
        // Verification stopped the pipeline before any analysis ran.
        setRejection(
          e.verification ?? {
            is_tobacco: false,
            label: "Not Tobacco",
            confidence: 0,
            message: e.message,
            method: "verification_model",
            threshold: 0,
            all_probabilities: [],
          }
        );
      } else {
        setError(e instanceof Error ? e.message : "Prediction failed");
      }
    } finally {
      setPredicting(false);
    }
  };

  const analysisType = mode === "quality" ? "quality grading" : "disease detection";
  const checklist = mode === "quality"
    ? [
        "Quality grade (A/B/C) with market value",
        "Confidence score for the grade",
        "Curing and uniformity assessment",
        "Saved to history for export later",
      ]
    : [
        "Disease class with probabilities",
        "Recommended actions for diagnosis",
        "Confidence scores for each disease",
        "Saved to history for export later",
      ];

  return (
    <div className="grid gap-8 lg:grid-cols-5">
      {/* Left: drop zone */}
      <div className="lg:col-span-3">
        <div
          {...getRootProps()}
          className={cn(
            "relative rounded-3xl border-2 border-dashed transition-all",
            "min-h-[420px] flex items-center justify-center p-8",
            isDragActive
              ? "border-leaf-700 bg-leaf-50 dark:border-leaf-300 dark:bg-leaf-900/20"
              : "border-[var(--border)] bg-[var(--bg-elev)]"
          )}
        >
          <input {...getInputProps()} />

          {previewUrl ? (
            <div className="relative w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Preview"
                className="max-h-[420px] w-full rounded-2xl object-contain"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  reset();
                }}
                className="absolute top-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                aria-label="Remove image"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full bg-leaf-700 px-3 py-1.5 text-xs text-parchment">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Ready to analyze
              </div>
            </div>
          ) : (
            <div className="text-center max-w-md">
              <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-leaf-100 text-leaf-700 dark:bg-leaf-800/40 dark:text-leaf-300">
                <ImagePlus className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-display text-2xl tracking-tight">
                Drop a leaf photo here
              </h3>
              <p className="mt-2 text-sm text-[var(--fg-muted)]">
                JPG, PNG, or WebP up to 10 MB. For best results use natural
                light, fill the frame, and capture the upper leaf surface.
              </p>

              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={open} variant="primary">
                  <ImagePlus className="h-4 w-4" />
                  Choose file
                </Button>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCameraClick();
                  }}
                  variant="outline"
                >
                  <Camera className="h-4 w-4" />
                  Use camera
                </Button>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={onCameraChange}
                  className="hidden"
                />
              </div>
            </div>
          )}
        </div>

        {rejection && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100"
          >
            <div className="flex items-start gap-3">
              <Leaf className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold">{rejection.message}</p>
                {rejection.detail && (
                  <p className="mt-1.5 text-amber-800/90 dark:text-amber-200/80">
                    {rejection.detail}
                  </p>
                )}
                <p className="mt-2 text-amber-800/90 dark:text-amber-200/80">
                  Tip: fill the frame with a single leaf, use natural light, and
                  photograph the upper surface against a plain background.
                </p>
                <Button
                  onClick={reset}
                  variant="outline"
                  className="mt-3"
                >
                  Try another image
                </Button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        )}
      </div>

      {/* Right: actions */}
      <div className="lg:col-span-2">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elev)] p-7 sticky top-24">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--fg-muted)]">
            Step 02
          </p>
          <h2 className="mt-2 font-display text-3xl tracking-tight">
            Run analysis
          </h2>
          <p className="mt-3 text-sm text-[var(--fg-muted)] leading-relaxed">
            Run {analysisType} on your image. The model will return results, 
            confidence scores, and actionable insights.
          </p>

          <ul className="mt-6 space-y-2.5 text-sm">
            {checklist.map((s) => (
              <li key={s} className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-leaf-700 dark:text-leaf-300 shrink-0" />
                <span className="text-[var(--fg-muted)]">{s}</span>
              </li>
            ))}
          </ul>

          <Button
            onClick={submit}
            disabled={!file || isPredicting}
            isLoading={isPredicting}
            size="lg"
            className="mt-7 w-full"
          >
            {isPredicting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing leaf…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Run analysis
              </>
            )}
          </Button>

          <p className="mt-4 text-center text-xs text-[var(--fg-muted)]">
            Average inference: ~1 second
          </p>
        </div>
      </div>
    </div>
  );
}
