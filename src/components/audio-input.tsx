'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Pick an audio file OR record live with the microphone (🎙).
 * Reports the chosen Blob/File to the parent; upload happens on submit.
 */
export function AudioInput({
  existingUrl, onChange,
}: {
  existingUrl?: string | null;
  onChange: (file: Blob | null, keepExisting: boolean) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [keep, setKeep] = useState(!!existingUrl);
  const [err, setErr] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const choose = (blob: Blob | null) => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(blob ? URL.createObjectURL(blob) : null);
    setKeep(false);
    onChange(blob, false);
  };

  async function start() {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        choose(new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' }));
      };
      rec.start();
      recorder.current = rec;
      setRecording(true);
    } catch {
      setErr('ማይክሮፎን መጠቀም አልተፈቀደም።');
    }
  }
  function stop() {
    recorder.current?.stop();
    setRecording(false);
  }

  return (
    <div className="field">
      <span className="label">ድምፅ (አማራጭ)</span>
      {keep && existingUrl && (
        <div className="btn-row">
          <audio controls src={existingUrl} preload="none" />
          <button type="button" className="btn sm danger" onClick={() => { setKeep(false); onChange(null, false); }}>
            ድምፁን አስወግድ
          </button>
        </div>
      )}
      <div className="btn-row">
        <input type="file" accept="audio/*" disabled={recording}
          onChange={(e) => choose(e.target.files?.[0] ?? null)} />
        {recording ? (
          <button type="button" className="btn sm danger" onClick={stop}>⏹ አቁም</button>
        ) : (
          <button type="button" className="btn sm secondary" onClick={start}>🎙 ቅዳ</button>
        )}
      </div>
      {recording && <span className="hint" style={{ color: 'var(--danger)' }}>● በመቅዳት ላይ…</span>}
      {preview && <audio controls src={preview} />}
      {err && <span className="alert error">{err}</span>}
    </div>
  );
}
