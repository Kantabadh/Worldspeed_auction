// This page runs in the browser.
"use client";

// Import useEffect and useState.
// useEffect runs when the page loads.
// useState stores the submitted data.
import { useEffect, useState } from "react";

// Define the structure of submission data needed here.
type Submission = {
  // Receipt number.
  receiptNo: string;

  // Submission date and time.
  submittedAt: string;
};

// This function creates the Success Page.
export default function SuccessPage() {
  // submission stores receipt data.
  // It starts as null before loading localStorage.
  const [submission, setSubmission] = useState<Submission | null>(null);

  // This runs once when the success page opens.
  useEffect(() => {
    // Get latestSubmission from browser storage.
    const saved = localStorage.getItem("latestSubmission");

    // If saved data exists, load it into React state.
    if (saved) {
      // Convert saved text into JavaScript object.
      setSubmission(JSON.parse(saved));
    }
  }, []);

  // Show the success page.
  return (
    // Main container.
    <main className="min-h-screen p-8">
      {/* Page title. */}
      <h1 className="text-2xl font-bold">Submitted Successfully</h1>

      {/* If submission exists, show receipt details. */}
      {submission && (
        <section className="mt-6 rounded border p-4">
          {/* Show receipt number. */}
          <p>
            <strong>Receipt No:</strong> {submission.receiptNo}
          </p>

          {/* Show submitted time. */}
          <p>
            <strong>Submitted at:</strong> {submission.submittedAt}
          </p>
        </section>
      )}

      {/* Tell merchant to screenshot this page. */}
      <p className="mt-6">
        Please take a screenshot of this page as your confirmation.
      </p>

      {/* Link back to homepage. */}
      <a
        href="/"
        className="mt-6 inline-block rounded bg-black px-4 py-2 text-white"
      >
        Back to Home
      </a>
    </main>
  );
}