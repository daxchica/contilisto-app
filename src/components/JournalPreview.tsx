// src/components/JournalPreview.tsx

interface Props {
  previewText: string;
}

export default function JournalPreview({ previewText }: Props) {
  return (
    <div className="mt-6 p-4 bg-gray-100 rounded shadow max-h-64 overflow-auto text-xs font-mono">
      <h2 className="font-bold text-gray-700 mb-2">📝 Raw JSON Preview</h2>
      <pre>{previewText}</pre>
    </div>
  );
}