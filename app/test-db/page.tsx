"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Motorcycle = {
  id: number;
  lot_number: string;
  motorcycle_name: string;
};

export default function TestDbPage() {
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function testConnection() {
      const { data, error } = await supabase
        .from("motorcycles")
        .select("id, lot_number, motorcycle_name")
        .order("lot_number");

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setMotorcycles(data || []);
    }

    testConnection();
  }, []);

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold">Supabase Test Page</h1>

      {errorMessage && (
        <p className="mt-4 rounded border border-red-500 p-3 text-red-600">
          Error: {errorMessage}
        </p>
      )}

      {!errorMessage && motorcycles.length === 0 && (
        <p className="mt-4">Loading or no motorcycles found...</p>
      )}

      {motorcycles.length > 0 && (
        <div className="mt-6 space-y-3">
          <p className="font-bold text-green-600">
            Connection works. Motorcycles loaded from Supabase:
          </p>

          {motorcycles.map((bike) => (
            <div key={bike.id} className="rounded border p-4">
              <p>
                <strong>Lot:</strong> {bike.lot_number}
              </p>
              <p>
                <strong>Motorcycle:</strong> {bike.motorcycle_name}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
