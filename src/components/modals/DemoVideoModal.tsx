interface Props {
  open: boolean;
  onClose: () => void;
  videoRef: React.RefObject<HTMLVideoElement>;
}

export default function DemoVideoModal({ open, onClose, videoRef }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-4xl w-full p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <video
          ref={videoRef}
          controls
          autoPlay
          className="w-full rounded-lg"
        >
          <source src="/videos/demo-contilisto.mp4" type="video/mp4" />
        </video>

        <button
          onClick={onClose}
          className="mt-4 text-sm text-gray-600 hover:text-gray-900"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}