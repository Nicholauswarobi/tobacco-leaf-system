"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import {
  Camera,
  ImagePlus,
  X,
  Sparkles,
  CheckCircle2,
  Leaf,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { api, NotATobaccoLeafError, WrongSectionError } from "@/lib/api";
import { useAppStore } from "@/store/app-store";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { VerificationResult } from "@/types";
import { AnalysisProgress, type AnalysisPhase } from "./analysis-progress";

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
  const { t } = useI18n();
  const setLatest = useAppStore((s) => s.setLatest);
  const setPredicting = useAppStore((s) => s.setPredicting);
  const setError = useAppStore((s) => s.setError);
  const isPredicting = useAppStore((s) => s.isPredicting);
  const error = useAppStore((s) => s.error);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Rejection by the Tobacco Verification gate is not an error, the system
  // worked and the image simply is not a leaf. Tracked separately so it can be
  // shown as guidance instead of a red failure banner.
  const [rejection, setRejection] = useState<VerificationResult | null>(null);
  // A real tobacco leaf that belongs in the other section. Separate from
  // `rejection` because the answer is "switch tabs", not "take a new photo",
  // and the file the user already picked stays valid.
  const [misrouted, setMisrouted] = useState<WrongSectionError | null>(null);
  // Split from `isPredicting` because the two phases need different UI: a real
  // percentage while bytes are moving, an indeterminate sweep once the server
  // has the photo and there is nothing left to measure.
  const [phase, setPhase] = useState<AnalysisPhase>("sending");
  const [uploaded, setUploaded] = useState(0);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const actionRef = useRef<HTMLDivElement>(null);

  // On a phone the photo fills the screen, so the progress readout can start
  // life below the fold: the user taps and appears to get nothing back.
  useEffect(() => {
    if (isPredicting) {
      actionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isPredicting]);

  const acceptFile = useCallback(
    (f: File) => {
      if (f.size > MAX_BYTES) {
        setError(
          t("upload.tooLarge", { size: (f.size / 1024 / 1024).toFixed(1) })
        );
        return;
      }
      setError(null);
      setRejection(null);
      setMisrouted(null);
      setFile(f);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(f));
    },
    [previewUrl, setError, t]
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
    // Clearing the value lets the same photo be chosen twice in a row;
    // otherwise the second selection is identical and `change` never fires.
    e.target.value = "";
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setError(null);
    setRejection(null);
    setMisrouted(null);
  };

  const submit = async () => {
    if (!file) return;

    // Order matters: the store's `setError` also clears `isPredicting`, since
    // an error ends a run. Calling it *after* setPredicting(true) therefore
    // switched the loading state straight back off, which is why the old
    // button's spinner never appeared either. Clear first, then start.
    setError(null);
    setRejection(null);
    setMisrouted(null);
    setPhase("sending");
    setUploaded(0);
    setPredicting(true);

    // Once the last byte is in, the wait is the model's, not the network's.
    const onProgress = (fraction: number) => {
      setUploaded(fraction);
      if (fraction >= 1) setPhase("working");
    };

    try {
      let result;
      if (mode === "quality") {
        result = await api.predictQuality(file, onProgress);
      } else {
        result = await api.predictDisease(file, onProgress);
      }
      setLatest(result);
      router.push("/result");
    } catch (e: unknown) {
      if (e instanceof WrongSectionError) {
        // The leaf is fine: it just belongs in the other analysis.
        setMisrouted(e);
      } else if (e instanceof NotATobaccoLeafError) {
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
        // Whatever the API said, the reader can only act on plain language,
        // but swallowing it entirely leaves "the check did not finish" with no
        // way to tell a dropped connection from a rejected request, so the
        // real cause goes to the console for whoever is debugging.
        console.error("[TobaccoScan] prediction request failed:", e);
        setError(t("upload.failed"));
      }
    } finally {
      setPredicting(false);
    }
  };

  return (
    // One column, centred. The old two-column split put the action in a card
    // beside the photo, which on a phone stacked into a second screenful the
    // user had to scroll to before anything could happen.
    <div className="mx-auto w-full max-w-2xl">
      <div>
        <div
          {...getRootProps()}
          className={cn(
            "relative rounded-md border-2 border-dashed transition-all",
            "flex items-center justify-center",
            // Sized to its contents now that the buttons sit outside it:
            // the old minimum was set when they lived inside, and left a tall
            // empty box behind once they moved.
            previewUrl
              ? "p-2"
              : "min-h-[180px] sm:min-h-[220px] p-3 sm:p-3",
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
                className="max-h-[34vh] w-full rounded object-contain sm:max-h-[420px]"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  reset();
                }}
                className="absolute top-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-sm bg-black/60 text-white hover:bg-black/80"
                aria-label={t("upload.remove")}
              >
                <X className="h-4 w-4" />
              </button>
              <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded bg-leaf-700 px-2 py-1 text-xs text-parchment">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t("upload.ready")}
              </div>
            </div>
          ) : (
            <div className="text-center max-w-md">
              <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded bg-leaf-100 text-leaf-700 dark:bg-leaf-800/40 dark:text-leaf-300">
                <ImagePlus className="h-6 w-6" />
              </div>
              <h3 className="mt-3 font-display text-lg sm:text-xl tracking-tight">
                {t("upload.dropTitle")}
              </h3>
              <p className="mt-1.5 text-sm text-[var(--fg-muted)]">
                {t("upload.dropBody")}
              </p>
            </div>
          )}
        </div>

        {/*
          Both controls live OUTSIDE the dropzone root, and so does the camera
          input. Inside it, `cameraInput.click()` dispatched a click that
          bubbled up to react-dropzone's root handler, which opened the file
          picker as well, so tapping "Use camera" showed the upload dialog,
          and cancelling it revealed the camera dialog queued behind. Stopping
          propagation on the button could not help: the programmatic click on
          the input is a separate event.
        */}
        {!previewUrl && (
          <div className="mt-2 flex flex-col sm:flex-row gap-2 justify-center">
            <Button onClick={open} variant="primary" className="w-full sm:w-auto">
              <ImagePlus className="h-4 w-4" />
              {t("upload.choose")}
            </Button>
            <Button
              onClick={onCameraClick}
              variant="outline"
              className="w-full sm:w-auto"
            >
              <Camera className="h-4 w-4" />
              {t("upload.camera")}
            </Button>
          </div>
        )}

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onCameraChange}
          className="hidden"
        />

        {/* The action, directly under the photo it acts on. */}
        {file && (
          <div className="mt-2" ref={actionRef}>
            {isPredicting ? (
              <AnalysisProgress phase={phase} uploaded={uploaded} mode={mode} />
            ) : (
              <>
                <Button
                  onClick={submit}
                  size="lg"
                  className="w-full"
                >
                  <Sparkles className="h-4 w-4" />
                  {t("upload.run")}
                </Button>
                <p className="mt-2 text-center text-xs text-[var(--fg-muted)]">
                  {t("upload.speed")}
                </p>
              </>
            )}
          </div>
        )}

        {misrouted && (
          <div
            role="alert"
            className="mt-3 rounded border border-sky-300 bg-sky-50 px-3 py-2.5 text-sm text-sky-900 dark:border-sky-800/50 dark:bg-sky-950/30 dark:text-sky-100"
          >
            <div className="flex items-start gap-2">
              <Leaf className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold">{t("upload.wrongSectionTitle")}</p>
                <p className="mt-1.5 text-sky-800/90 dark:text-sky-200/80">
                  {misrouted.suggestedMode === "quality"
                    ? t("quality.lead")
                    : t("disease.lead")}
                </p>
                <Button
                  variant="outline"
                  className="mt-2"
                  onClick={() =>
                    router.push(
                      misrouted.suggestedMode === "quality"
                        ? "/quality"
                        : "/disease"
                    )
                  }
                >
                  {t("upload.goTo", {
                    section:
                      misrouted.suggestedMode === "quality"
                        ? t("nav.quality")
                        : t("nav.disease"),
                  })}
                </Button>
              </div>
            </div>
          </div>
        )}

        {rejection && (
          <div
            role="alert"
            className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100"
          >
            <div className="flex items-start gap-2">
              <Leaf className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold">{rejection.message}</p>
                {rejection.detail && (
                  <p className="mt-1.5 text-amber-800/90 dark:text-amber-200/80">
                    {rejection.detail}
                  </p>
                )}
                <p className="mt-2 text-amber-800/90 dark:text-amber-200/80">
                  {t("upload.notLeafTip")}
                </p>
                <Button
                  onClick={reset}
                  variant="outline"
                  className="mt-2"
                >
                  {t("upload.tryAnother")}
                </Button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
