import React, { useState, useCallback } from "react";
import { Upload, FileText, Loader2 } from "lucide-react";

export default function DocumentUpload({ onUpload }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFiles = useCallback(
    async (fileList) => {
      const files = Array.from(fileList).filter((f) =>
        [".pdf", ".csv"].some((ext) => f.name.toLowerCase().endsWith(ext))
      );
      if (!files.length) return;

      setUploading(true);
      try {
        await onUpload(files);
      } finally {
        setUploading(false);
      }
    },
    [onUpload]
  );

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  return (
    <div
      className={`upload-zone ${dragging ? "upload-zone--active" : ""}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={() => setDragging(false)}
      onClick={() => {
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = true;
        input.accept = ".pdf,.csv";
        input.onchange = (e) => handleFiles(e.target.files);
        input.click();
      }}
    >
      {uploading ? (
        <>
          <Loader2 size={36} className="spin" />
          <p>Processing upload…</p>
        </>
      ) : (
        <>
          <Upload size={36} />
          <p className="upload-zone__title">
            Drop PDFs or CSVs here, or click to browse
          </p>
          <p className="upload-zone__hint">
            Invoices, receipts, expense reports — up to 50 MB each
          </p>
        </>
      )}
    </div>
  );
}
