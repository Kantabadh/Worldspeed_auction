export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
      <section className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-gray-200">
        <div className="bg-black px-6 py-8 text-white">
          <p className="text-sm font-medium uppercase tracking-wide text-gray-300">
            Motorcycle Auction System
          </p>

          <h1 className="mt-3 text-3xl font-bold">
            Digital Offer Box
          </h1>

          <p className="mt-3 max-w-xl text-sm text-gray-300">
            Submit one-time motorcycle offers digitally and manage auction
            results from the admin dashboard.
          </p>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2">
          <a
            href="/merchant-login"
            className="rounded-3xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-900 text-xl font-bold text-white">
              M
            </div>

            <h2 className="mt-5 text-xl font-bold text-gray-900">
              Merchant Login
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              Enter your phone number and merchant code to submit offers.
            </p>

            <p className="mt-5 font-semibold text-gray-900">
              Continue →
            </p>
          </a>

          <a
            href="/admin"
            className="rounded-3xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-900 text-xl font-bold text-white">
              A
            </div>

            <h2 className="mt-5 text-xl font-bold text-gray-900">
              Admin Dashboard
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              Manage motorcycles, merchants, auction status, and results.
            </p>

            <p className="mt-5 font-semibold text-gray-900">
              Continue →
            </p>
          </a>
        </div>

        <div className="border-t bg-gray-50 px-6 py-4">
          <p className="text-center text-xs text-gray-500">
            Prototype system for motorcycle second-hand auction field testing.
          </p>
        </div>
      </section>
    </main>
  );
}