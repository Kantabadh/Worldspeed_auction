"use client";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-100 px-3 py-4 sm:px-4 sm:py-6">
      <section className="mx-auto flex min-h-[calc(100vh-32px)] max-w-5xl items-center justify-center sm:min-h-[calc(100vh-48px)]">
        <div className="w-full rounded-3xl bg-white p-4 shadow-xl ring-1 ring-gray-200 sm:p-6 md:rounded-[2rem] md:p-10">
          <div className="text-center">
            <div className="mx-auto flex justify-center">
              <div className="flex w-full max-w-sm items-center justify-center rounded-3xl bg-white px-5 py-4 shadow-md ring-1 ring-gray-200 sm:max-w-xl sm:px-8 sm:py-5">
                <img
                  src="/worldspeed-logo.png"
                  alt="เวิลด์สปีด"
                  className="h-auto max-h-20 w-full object-contain sm:max-h-24"
                />
              </div>
            </div>

            <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-gray-950 sm:text-4xl md:mt-8 md:text-5xl">
              ระบบเสนอราคารถจักรยานยนต์
            </h1>

            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-gray-600 sm:mt-4 sm:text-lg sm:leading-8 md:text-xl">
              ระบบสำหรับร้านค้าเสนอราคารถจักรยานยนต์ และผู้ดูแลระบบจัดการรายการรอบเสนอราคา
            </p>
          </div>

          <div className="mt-7 grid gap-4 md:mt-10 md:grid-cols-2 md:gap-5">
            <section className="rounded-3xl border bg-gray-50 p-4 shadow-sm sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 sm:text-sm">
                Merchant
              </p>

              <h2 className="mt-2 text-2xl font-bold text-gray-950 sm:text-3xl">
                สำหรับร้านค้า
              </h2>

              <p className="mt-2 text-sm leading-7 text-gray-600 sm:mt-3 sm:text-base">
                เข้าสู่ระบบเพื่อดูรายการรถที่เปิดรับราคา และส่งราคาที่ต้องการเสนอ
              </p>

              <div className="mt-5 space-y-3 sm:mt-7">
                <a
                  href="/merchant-login"
                  className="flex w-full items-center justify-center rounded-2xl bg-black px-5 py-4 text-base font-bold text-white shadow-sm transition hover:bg-gray-800 active:scale-[0.99] sm:text-lg"
                >
                  เข้าสู่ระบบร้านค้า
                </a>

                <a
                  href="/merchant-signup"
                  className="flex w-full items-center justify-center rounded-2xl border bg-white px-5 py-4 text-base font-bold text-gray-900 transition hover:bg-gray-100 active:scale-[0.99] sm:text-lg"
                >
                  สมัครร้านค้าใหม่
                </a>
              </div>
            </section>

            <section className="rounded-3xl border bg-white p-4 shadow-sm sm:bg-gray-50 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 sm:text-sm">
                Admin
              </p>

              <h2 className="mt-2 text-2xl font-bold text-gray-950 sm:text-3xl">
                สำหรับผู้ดูแลระบบ
              </h2>

              <p className="mt-2 text-sm leading-7 text-gray-600 sm:mt-3 sm:text-base">
                จัดการคลังรถ รายการรอบเสนอราคา ร้านค้า ราคาเสนอ และตรวจสอบผลการเสนอราคา
              </p>

              <div className="mt-5 sm:mt-7">
                <a
                  href="/staff-login"
                  className="flex w-full items-center justify-center rounded-2xl border bg-white px-5 py-4 text-base font-bold text-gray-900 shadow-sm transition hover:bg-gray-100 active:scale-[0.99] sm:text-lg"
                >
                  เข้าสู่ระบบผู้ดูแล
                </a>
              </div>
            </section>
          </div>

          <div className="mt-7 text-center sm:mt-9">
            <p className="text-xs text-gray-500 sm:text-sm">
              กรุณาเลือกประเภทการใช้งานเพื่อเข้าสู่ระบบ
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
