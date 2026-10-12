"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { formatDuration } from "./upload";

/** Sprachmemos dürfen höchstens 10 Minuten lang sein (wie auf dem Server). */
const MAX_SECONDS = 10 * 60;

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const type of ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

/**
 * Knopf „Sprachmemo“: Aufnahme im Browser (Android: WebM/Opus, iPhone: MP4/AAC). Nach „Stopp“
 * kommt die Datei samt Dauer zurück. Bildschirm-Sperre beendet die Aufnahme auf manchen Geräten.
 */
export function VoiceRecorder({
  onRecorded,
  disabled,
}: {
  onRecorded: (file: File, durationSec: number) => void;
  disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const startedRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => recorderRef.current?.state === "recording" && recorderRef.current.stop();

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const start = async () => {
    const mimeType = pickMimeType();
    if (mimeType === null || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Dieses Gerät kann im Browser nicht aufnehmen.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error("Kein Zugriff aufs Mikrofon", {
        description: "Bitte im Browser das Mikrofon für diese Seite erlauben.",
      });
      return;
    }
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      setRecording(false);
      const duration = (Date.now() - startedRef.current) / 1000;
      const type = (recorder.mimeType || mimeType || "audio/webm").split(";")[0];
      const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
      const stamp = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
      if (duration < 1) return;
      onRecorded(
        new File(chunks, `Sprachmemo ${stamp.replace(":", "-")}.${ext}`, { type }),
        duration,
      );
    };
    recorderRef.current = recorder;
    startedRef.current = Date.now();
    setSeconds(0);
    recorder.start(1000);
    setRecording(true);
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedRef.current) / 1000);
      setSeconds(elapsed);
      if (elapsed >= MAX_SECONDS) stop();
    }, 500);
  };

  return recording ? (
    <Button type="button" variant="destructive" size="sm" onClick={stop}>
      <Square className="size-3.5 fill-current" aria-hidden />
      Stopp {formatDuration(seconds) ?? "0:00"}
    </Button>
  ) : (
    <Button type="button" variant="outline" size="sm" onClick={start} disabled={disabled}>
      <Mic className="size-4" aria-hidden />
      Sprachmemo
    </Button>
  );
}
