"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type MotorcyclePhoto = {
  id: number;
  image_url: string;
};

type Motorcycle = {
  id: number;
  lot_number: string;
  motorcycle_name: string;
  active: boolean;
  created_at: string;
  motorcycle_photos: MotorcyclePhoto[];
};

export default function AdminMotorcyclesPage() {
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [lotNumber, setLotNumber] = useState("");
  const [motorcycleName, setMotorcycleName] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLotNumber, setEditLotNumber] = useState("");
  const [editMotorcycleName, setEditMotorcycleName] = useState("");
  const [editPhotoFiles, setEditPhotoFiles] = useState<File[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function uploadPhoto(file: File, lot: string) {
    const fileExtension = file.name.split(".").pop();
    const safeLot = lot.replaceAll(" ", "-");
    const filePath = `${safeLot}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${fileExtension}`;

    const { error: uploadError } = await supabase.storage
      .from("motorcycle-photos")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from("motorcycle-photos")
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function uploadMultiplePhotos(files: File[], motorcycleId: number, lot: string) {
    if (files.length === 0) return;

    const photoRows = [];

    for (const file of files) {
      const imageUrl = await uploadPhoto(file, lot);

      photoRows.push({
        motorcycle_id: motorcycleId,
        image_url: imageUrl,
      });
    }

    const { error } = await supabase
      .from("motorcycle_photos")
      .insert(photoRows);

    if (error) {
      throw error;
    }
  }

  async function loadMotorcycles() {
    setIsLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("motorcycles")
      .select(`
        id,
        lot_number,
        motorcycle_name,
        active,
        created_at,
        motorcycle_photos (
          id,
          image_url
        )
      `)
      .order("lot_number");

    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
      return;
    }

    setMotorcycles((data as Motorcycle[]) || []);
    setIsLoading(false);
  }

  async function addMotorcycle() {
    if (!lotNumber || !motorcycleName) {
      alert("Please enter lot number and motorcycle name.");
      return;
    }

    setIsAdding(true);
    setErrorMessage("");

    try {
      const { data: motorcycleData, error: motorcycleError } = await supabase
        .from("motorcycles")
        .insert({
          lot_number: lotNumber,
          motorcycle_name: motorcycleName,
          active: true,
        })
        .select()
        .single();

      if (motorcycleError) {
        throw motorcycleError;
      }

      await uploadMultiplePhotos(photoFiles, motorcycleData.id, lotNumber);

      setLotNumber("");
      setMotorcycleName("");
      setPhotoFiles([]);
      setIsAdding(false);
      loadMotorcycles();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to add motorcycle."
      );
      setIsAdding(false);
    }
  }

  function startEditing(bike: Motorcycle) {
    setEditingId(bike.id);
    setEditLotNumber(bike.lot_number);
    setEditMotorcycleName(bike.motorcycle_name);
    setEditPhotoFiles([]);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditLotNumber("");
    setEditMotorcycleName("");
    setEditPhotoFiles([]);
  }

  async function saveEdit(bike: Motorcycle) {
    if (!editLotNumber || !editMotorcycleName) {
      alert("Please enter lot number and motorcycle name.");
      return;
    }

    setErrorMessage("");

    try {
      const { error } = await supabase
        .from("motorcycles")
        .update({
          lot_number: editLotNumber,
          motorcycle_name: editMotorcycleName,
        })
        .eq("id", bike.id);

      if (error) {
        throw error;
      }

      await uploadMultiplePhotos(editPhotoFiles, bike.id, editLotNumber);

      cancelEditing();
      loadMotorcycles();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save edit."
      );
    }
  }

  async function deletePhoto(photoId: number) {
    const confirmDelete = confirm("Delete this photo?");

    if (!confirmDelete) return;

    setErrorMessage("");

    const { error } = await supabase
      .from("motorcycle_photos")
      .delete()
      .eq("id", photoId);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    loadMotorcycles();
  }

  async function toggleActive(bike: Motorcycle) {
    setErrorMessage("");

    const { error } = await supabase
      .from("motorcycles")
      .update({
        active: !bike.active,
      })
      .eq("id", bike.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    loadMotorcycles();
  }

  async function deleteMotorcycle(id: number) {
    const confirmDelete = confirm(
      "Delete permanently? If this motorcycle has offers, deletion may fail. Hide is safer."
    );

    if (!confirmDelete) return;

    setErrorMessage("");

    const { error } = await supabase.from("motorcycles").delete().eq("id", id);

    if (error) {
      setErrorMessage(
        "Cannot delete this motorcycle because it may already have offers. Use Hide instead."
      );
      return;
    }

    loadMotorcycles();
  }

  useEffect(() => {
    loadMotorcycles();
  }, []);

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold">Motorcycle Management</h1>

      <div className="mt-4 flex gap-4">
        <a href="/admin" className="rounded border px-4 py-2">
          Back to Admin
        </a>

        <button onClick={loadMotorcycles} className="rounded border px-4 py-2">
          Refresh
        </button>
      </div>

      {errorMessage && (
        <p className="mt-4 rounded border border-red-500 p-3 text-red-600">
          Error: {errorMessage}
        </p>
      )}

      <section className="mt-6 max-w-md rounded border p-4">
        <h2 className="text-xl font-semibold">Add Motorcycle Lot</h2>

        <input
          className="mt-4 w-full rounded border p-2"
          placeholder="Lot number, example: 004"
          value={lotNumber}
          onChange={(e) => setLotNumber(e.target.value)}
        />

        <input
          className="mt-3 w-full rounded border p-2"
          placeholder="Motorcycle name, example: Honda PCX 160"
          value={motorcycleName}
          onChange={(e) => setMotorcycleName(e.target.value)}
        />

        <input
          type="file"
          accept="image/*"
          multiple
          className="mt-3 w-full rounded border p-2"
          onChange={(e) => setPhotoFiles(Array.from(e.target.files || []))}
        />

        {photoFiles.length > 0 && (
          <p className="mt-2 text-sm text-gray-600">
            Selected {photoFiles.length} photo(s)
          </p>
        )}

        <button
          onClick={addMotorcycle}
          disabled={isAdding}
          className="mt-4 rounded bg-black px-4 py-2 text-white disabled:bg-gray-400"
        >
          {isAdding ? "Adding..." : "Add Motorcycle"}
        </button>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Motorcycle Lots</h2>

        {isLoading && <p className="mt-4">Loading motorcycles...</p>}

        {!isLoading && motorcycles.length > 0 && (
          <table className="mt-3 w-full border">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">Photos</th>
                <th className="border p-2">Lot Number</th>
                <th className="border p-2">Motorcycle Name</th>
                <th className="border p-2">Status</th>
                <th className="border p-2">Action</th>
              </tr>
            </thead>

            <tbody>
              {motorcycles.map((bike) => (
                <tr key={bike.id}>
                  <td className="border p-2">
                    {bike.motorcycle_photos?.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {bike.motorcycle_photos.map((photo) => (
                          <div key={photo.id} className="space-y-1">
                            <img
                              src={photo.image_url}
                              alt={bike.motorcycle_name}
                              className="h-20 w-28 rounded object-cover"
                            />

                            <button
                              onClick={() => deletePhoto(photo.id)}
                              className="rounded bg-red-600 px-2 py-1 text-xs text-white"
                            >
                              Delete Photo
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span>No photo</span>
                    )}
                  </td>

                  <td className="border p-2">
                    {editingId === bike.id ? (
                      <input
                        className="w-full rounded border p-1"
                        value={editLotNumber}
                        onChange={(e) => setEditLotNumber(e.target.value)}
                      />
                    ) : (
                      bike.lot_number
                    )}
                  </td>

                  <td className="border p-2">
                    {editingId === bike.id ? (
                      <input
                        className="w-full rounded border p-1"
                        value={editMotorcycleName}
                        onChange={(e) =>
                          setEditMotorcycleName(e.target.value)
                        }
                      />
                    ) : (
                      bike.motorcycle_name
                    )}
                  </td>

                  <td className="border p-2">
                    {bike.active ? (
                      <span className="font-bold text-green-600">Active</span>
                    ) : (
                      <span className="font-bold text-red-600">Hidden</span>
                    )}
                  </td>

                  <td className="space-x-2 border p-2">
                    {editingId === bike.id ? (
                      <>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="mb-2 block rounded border p-1"
                          onChange={(e) =>
                            setEditPhotoFiles(Array.from(e.target.files || []))
                          }
                        />

                        {editPhotoFiles.length > 0 && (
                          <p className="mb-2 text-sm text-gray-600">
                            Selected {editPhotoFiles.length} new photo(s)
                          </p>
                        )}

                        <button
                          onClick={() => saveEdit(bike)}
                          className="rounded bg-black px-3 py-1 text-white"
                        >
                          Save
                        </button>

                        <button
                          onClick={cancelEditing}
                          className="rounded border px-3 py-1"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEditing(bike)}
                          className="rounded border px-3 py-1"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => toggleActive(bike)}
                          className={
                            bike.active
                              ? "rounded bg-yellow-500 px-3 py-1 text-white"
                              : "rounded bg-green-600 px-3 py-1 text-white"
                          }
                        >
                          {bike.active ? "Hide" : "Show"}
                        </button>

                        <button
                          onClick={() => deleteMotorcycle(bike.id)}
                          className="rounded bg-red-600 px-3 py-1 text-white"
                        >
                          Delete Lot
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}