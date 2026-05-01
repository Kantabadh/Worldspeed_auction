// This function creates the homepage.
export default function Home() {
  // return means "show this HTML/JSX on the screen".
  return (
    // main is the main area of the page.
    // min-h-screen means minimum height = full screen height.
    // p-8 means padding around the page.
    <main className="min-h-screen p-8">
      {/* h1 is the main title of the page. */}
      {/* text-3xl makes text large. */}
      {/* font-bold makes text bold. */}
      <h1 className="text-3xl font-bold">Motorcycle Digital Offer Box</h1>

      {/* p is a paragraph. */}
      {/* mt-4 means margin-top spacing. */}
      <p className="mt-4">
        Welcome. Merchants can submit one-time offers for motorcycle lots.
      </p>

      {/* div groups the two buttons together. */}
      {/* mt-6 adds space above. */}
      {/* flex makes the links sit beside each other. */}
      {/* gap-4 adds space between the buttons. */}
      <div className="mt-6 flex gap-4">
        {/* This link goes to the merchant page. */}
        {/* href="/merchant" means clicking it opens /merchant. */}
        <a href="/merchant" className="rounded bg-black px-4 py-2 text-white">
          Merchant Page
        </a>

        {/* This link goes to the admin page. */}
        {/* href="/admin" means clicking it opens /admin. */}
        <a href="/admin" className="rounded border px-4 py-2">
          Admin Page
        </a>
      </div>
    </main>
  );
}