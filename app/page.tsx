import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-200 px-4 py-8">
      <section className="mx-auto max-w-4xl">
        <div className="overflow-hidden rounded-[32px] bg-white shadow-2xl ring-1 ring-black/5">
          {/* Top Hero */}
          <div className="bg-black px-6 py-10 text-white sm:px-10 sm:py-12">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                Motorcycle Auction System
              </p>

              <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">
                Digital Offer Box
              </h1>

              <p className="mt-4 max-w-xl text-sm leading-7 text-gray-300 sm:text-base">
                Submit one-time motorcycle offers digitally using your merchant
                phone number and merchant code. Fast, simple, and easy to manage
                during on-site auctions.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-gray-200">
                  One-time price submission
                </span>
                <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-gray-200">
                  Merchant access
                </span>
                <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-gray-200">
                  Admin controlled
                </span>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="px-6 py-8 sm:px-10 sm:py-10">
            <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
              {/* Main Merchant Card */}
              <Link
                href="/merchant-login"
                className="group rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="flex h-full flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-900 text-xl font-bold text-white shadow">
                        M
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                          Main Entry
                        </p>
                        <h2 className="text-2xl font-bold text-gray-900">
                          Merchant Login
                        </h2>
                      </div>
                    </div>

                    <p className="mt-5 max-w-xl text-sm leading-7 text-gray-600">
                      Log in with your assigned phone number and merchant code
                      to enter one-time offers for motorcycle lots in the
                      auction.
                    </p>

                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl bg-gray-50 p-4">
                        <p className="text-sm font-semibold text-gray-900">
                          Easy Access
                        </p>
                        <p className="mt-1 text-xs leading-6 text-gray-600">
                          Simple login using phone number and code.
                        </p>
                      </div>

                      <div className="rounded-2xl bg-gray-50 p-4">
                        <p className="text-sm font-semibold text-gray-900">
                          One-Time Offer
                        </p>
                        <p className="mt-1 text-xs leading-6 text-gray-600">
                          Submit your prices once for the lots you want.
                        </p>
                      </div>

                      <div className="rounded-2xl bg-gray-50 p-4">
                        <p className="text-sm font-semibold text-gray-900">
                          Review First
                        </p>
                        <p className="mt-1 text-xs leading-6 text-gray-600">
                          Check your offer summary before final submission.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">
                      For auction merchants
                    </span>

                    <span className="inline-flex items-center gap-2 rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white transition group-hover:bg-gray-800">
                      Continue
                      <span aria-hidden="true">→</span>
                    </span>
                  </div>
                </div>
              </Link>

              {/* Side Info Panel */}
              <div className="rounded-[28px] border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  How it works
                </p>

                <h3 className="mt-3 text-2xl font-bold text-gray-900">
                  Quick Process
                </h3>

                <div className="mt-6 space-y-4">
                  <div className="flex gap-3">
                    <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-black text-sm font-bold text-white">
                      1
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Login</p>
                      <p className="text-sm leading-6 text-gray-600">
                        Enter your phone number and merchant code.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-black text-sm font-bold text-white">
                      2
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Enter Offers</p>
                      <p className="text-sm leading-6 text-gray-600">
                        Fill in your prices for the motorcycle lots you want.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-black text-sm font-bold text-white">
                      3
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Review</p>
                      <p className="text-sm leading-6 text-gray-600">
                        Check the summary page before you confirm submission.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-black text-sm font-bold text-white">
                      4
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Submit</p>
                      <p className="text-sm leading-6 text-gray-600">
                        Your one-time offers are recorded for the auction staff.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white p-4">
                  <p className="text-sm font-medium text-gray-900">
                    Staff / Admin Access
                  </p>
                  <p className="mt-1 text-sm leading-6 text-gray-600">
                    For auction staff only.
                  </p>

                  <Link
                    href="/staff-login"
                    className="mt-4 inline-flex text-sm font-semibold text-gray-700 underline underline-offset-4 hover:text-black"
                  >
                    Open staff login
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t bg-gray-50 px-6 py-5 text-center sm:px-10">
            <p className="text-sm text-gray-500">
              Digital sealed-offer workflow for on-site motorcycle auctions.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}