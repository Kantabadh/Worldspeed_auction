"use client";

export default function BackButton() {
  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/";
    }
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full border bg-white text-2xl hover:bg-gray-100"
      aria-label="Go back"
    >
      ←
    </button>
  );
}