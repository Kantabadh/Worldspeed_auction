"use client";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-100 px-4 py-6">
      <section className="mx-auto flex min-h-[calc(100vh-48px)] max-w-5xl items-center justify-center">
        <div className="w-full rounded-[2rem] bg-white p-6 shadow-xl ring-1 ring-gray-200 md:p-10">
          <div className="text-center">
            <div className="mx-auto flex justify-center">
              <div className="flex w-full max-w-xl items-center justify-center rounded-3xl bg-white px-8 py-5 shadow-md ring-1 ring-gray-200">
                <img
                  src="/worldspeed-logo.png"
                  alt="เวิลด์สปีด"
                  className="h-auto max-h-24 w-full object-contain"
                />
              </div>
            </div>

            <h1 className="mt-8 text-4xl font-extrabold tracking-tight text-gray-950 md:text-5xl">
              ระบบเสนอราคารถจักรยานยนต์
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-gray-600 md:text-xl">
              ระบบสำหรับร้านค้าเสนอราคารถจักรยานยนต์ และผู้ดูแลระบบจัดการคลังรถ
              รายการ Auction ราคาเสนอ ประวัติ และรายงานสรุปผล
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <section className="rounded-3xl border bg-gray-50 p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Merchant
              </p>

              <h2 className="mt-2 text-3xl font-bold text-gray-950">
                สำหรับร้านค้า
              </h2>

              <p className="mt-3 text-base leading-7 text-gray-600">
                เข้าสู่ระบบเพื่อดูรายการรถที่เปิดรับราคา และส่งราคาที่ต้องการเสนอ
              </p>

              <div className="mt-7 space-y-3">
                <a
                  href="/merchant-login"
                  className="flex w-full items-center justify-center rounded-2xl bg-black px-5 py-4 text-lg font-bold text-white shadow-sm hover:bg-gray-800"
                >
                  เข้าสู่ระบบร้านค้า
                </a>

                <a
                  href="/merchant-signup"
                  className="flex w-full items-center justify-center rounded-2xl border bg-white px-5 py-4 text-lg font-bold text-gray-900 hover:bg-gray-100"
                >
                  สมัครร้านค้าใหม่
                </a>
              </div>
            </section>

            <section className="rounded-3xl border bg-gray-50 p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Admin
              </p>

              <h2 className="mt-2 text-3xl font-bold text-gray-950">
                สำหรับผู้ดูแลระบบ
              </h2>

              <p className="mt-3 text-base leading-7 text-gray-600">
                จัดการคลังรถ รายการ Auction ร้านค้า ราคาเสนอ และตรวจสอบผลการเสนอราคา
              </p>

              <div className="mt-7">
                <a
                  href="/staff-login"
                  className="flex w-full items-center justify-center rounded-2xl border bg-white px-5 py-4 text-lg font-bold text-gray-900 shadow-sm hover:bg-gray-100"
                >
                  เข้าสู่ระบบผู้ดูแล
                </a>
              </div>
            </section>
          </div>

          <div className="mt-9 text-center">
            <p className="text-sm text-gray-500">
              กรุณาเลือกประเภทการใช้งานเพื่อเข้าสู่ระบบ
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}