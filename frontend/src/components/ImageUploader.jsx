import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { ACCEPTED_TYPES, MAX_IMAGE_MB } from '../constants.js';

export default function ImageUploader({ file, onChange, disabled = false, hint, sample, sampleName = 'sample.jpg' }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);

  async function loadSample() {
    if (!sample || disabled) return;
    try {
      const res = await fetch(sample);
      const blob = await res.blob();
      const sampleFile = new File([blob], sampleName, { type: blob.type || 'image/jpeg' });
      accept(sampleFile);
    } catch {
      setError('Could not load sample image');
    }
  }

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function accept(candidate) {
    if (!candidate) return;
    if (!ACCEPTED_TYPES.includes(candidate.type)) {
      setError('Unsupported file. Choose a JPG, PNG, or WebP image.');
      return;
    }
    if (candidate.size > MAX_IMAGE_MB * 1024 * 1024) {
      setError(`That image is over ${MAX_IMAGE_MB} MB. Choose a smaller one.`);
      return;
    }
    setError('');
    onChange(candidate);
  }

  function clear() {
    setError('');
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  function onDrop(event) {
    event.preventDefault();
    setDragging(false);
    if (!disabled) accept(event.dataTransfer.files?.[0]);
  }

  return (
    <div className="uploader">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        hidden
        disabled={disabled}
        onChange={(e) => accept(e.target.files?.[0])}
      />
      {preview ? (
        <div className="uploader-preview">
          <img src={preview} alt="Selected upload preview" />
          <button type="button" className="icon-btn" onClick={clear} disabled={disabled} aria-label="Remove image">
            <X size={18} />
          </button>
          <p className="muted small">{file?.name}</p>
        </div>
      ) : (
        <div
          className={`dropzone${dragging ? ' is-dragging' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <ImagePlus size={30} aria-hidden="true" />
          <strong>Drop a photo here, or browse</strong>
          <span className="muted small">{hint || `JPG, PNG or WebP, up to ${MAX_IMAGE_MB} MB`}</span>
          {sample && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ marginTop: '0.5rem', pointerEvents: 'auto' }}
              onClick={(e) => {
                e.stopPropagation();
                loadSample();
              }}
              disabled={disabled}
            >
              ✨ Try sample image
            </button>
          )}
        </div>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
