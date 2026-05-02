"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import BackButton from "@/components/BackButton";
import StaffGuard from "@/components/StaffGuard";

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

  async function uploadMultiplePhotos(
    files: File[],
    motorcycleId: number,
    lot: string
  ) {
    if (files.length === 0) return;

    const photoRows = [];

    for (const file of files) {
      const imageUrl = await uploadPhoto(file, lot);

      photoRows.push({
        motorcycle_id: motorcycleId,
        image_url: imageUrl,
      });
    }

    const { error } = await supabase.from("motorcycle_photos").insert(photoRows);

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

  const activeCount = motorcycles.filter((bike) => bike.active).length;
  const hiddenCount = motorcycles.filter((bike) => !bike.active).length;
  const totalPhotos = motorcycles.reduce((sum, bike) => {
    return sum + (bike.motorcycle_photos?.length || 0);
  }, 0);

  return (
    <StaffGuard>
      <main className="min-h-screen bg-gray-50 pb-10">
        <section className="mx-auto max-w-6xl px-4 py-6">
          <BackButton />

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
                Admin Management
              </p>

              <h1 className="mt-1 text-2xl font-bold text-gray-900">
                Motorcycle Lots
              </h1>

              <p className="mt-1 text-sm text-gray-600">
                Add lots, upload photos, edit details, and hide or show motorcycles.
              </p>
            </div>

            <button
              onClick={loadMotorcycles}
              className="rounded-xl border bg-white px-4 py-2 font-medium shadow-sm hover:bg-gray-100"
            >
              Refresh
            </button>
          </div>

          {errorMessage && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              <p className="font-semibold">Error</p>
              <p className="text-sm">{errorMessage}</p>
            </div>
          )}

          <section className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">Total Lots</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {motorcycles.length}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">Active Lots</p>
              <p className="mt-2 text-3xl font-bold text-green-600">
                {activeCount}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Hidden: {hiddenCount}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="text-sm font-medium text-gray-500">Photos Uploaded</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {totalPhotos}
              </p>
            </div>
          </section>

          <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Add Motorcycle Lot</h2>

            <p className="mt-1 text-sm text-gray-600">
              Create a new lot and upload multiple photos at once.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Lot Number
                </label>

                <input
                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  placeholder="Example: 004"
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Motorcycle Name
                </label>

                <input
                  className="mt-2 w-full rounded-2xl border p-3 outline-none focus:ring-2 focus:ring-black"
                  placeholder="Example: Honda PCX 160"
                  value={motorcycleName}
                  onChange={(e) => setMotorcycleName(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700">
                Motorcycle Photos
              </label>

              <input
                type="file"
                accept="image/*"
                multiple
                className="mt-2 w-full rounded-2xl border bg-gray-50 p-3"
                onChange={(e) => setPhotoFiles(Array.from(e.target.files || []))}
              />

              {photoFiles.length > 0 && (
                <p className="mt-2 text-sm text-gray-600">
                  Selected {photoFiles.length} photo(s)
                </p>
              )}
            </div>

            <button
              onClick={addMotorcycle}
              disabled={isAdding}
              className="mt-5 rounded-2xl bg-black px-5 py-3 font-semibold text-white shadow disabled:bg-gray-400"
            >
              {isAdding ? "Adding..." : "Add Motorcycle"}
            </button>
          </section>

          <section className="mt-8 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              Motorcycle Lot List
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              Manage all motorcycle lots shown to merchants.
            </p>

            {isLoading && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5">
                <p className="text-gray-600">Loading motorcycles...</p>
              </div>
            )}

            {!isLoading && motorcycles.length === 0 && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-5">
                <p className="text-gray-600">No motorcycles found.</p>
              </div>
            )}

            {!isLoading && motorcycles.length > 0 && (
              <div className="mt-5 space-y-5">
                {motorcycles.map((bike) => (
                  <article
                    key={bike.id}
                    className="overflow-hidden rounded-2xl border bg-white shadow-sm"
                  >
                    <div className="border-b bg-gray-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                            Lot {bike.lot_number}
                          </p>

                          <h3 className="mt-1 text-lg font-bold text-gray-900">
                            {bike.motorcycle_name}
                          </h3>
                        </div>

                        {bike.active ? (
                          <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
                            Active
                          </span>
                        ) : (
                          <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">
                            Hidden
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-4">
                      {bike.motorcycle_photos?.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                          {bike.motorcycle_photos.map((photo) => (
                            <div
                              key={photo.id}
                              className="overflow-hidden rounded-2xl border bg-gray-50"
                            >
                              <img
                                src={photo.image_url}
                                alt={bike.motorcycle_name}
                                className="h-28 w-full object-cover"
                              />

                              <button
                                onClick={() => deletePhoto(photo.id)}
                                className="w-full bg-red-600 px-2 py-2 text-xs font-semibold text-white hover:bg-red-700"
                              >
                                Delete Photo
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
                          No photos uploaded.
                        </div>
                      )}

                      {editingId === bike.id ? (
                        <div className="mt-5 rounded-2xl border bg-gray-50 p-4">
                          <h4 className="font-semibold text-gray-900">
                            Edit Lot
                          </h4>

                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div>
                              <label className="text-sm font-medium text-gray-700">
                                Lot Number
                              </label>

                              <input
                                className="mt-1 w-full rounded-xl border p-3"
                                value={editLotNumber}
                                onChange={(e) =>
                                  setEditLotNumber(e.target.value)
                                }
                              />
                            </div>

                            <div>
                              <label className="text-sm font-medium text-gray-700">
                                Motorcycle Name
                              </label>

                              <input
                                className="mt-1 w-full rounded-xl border p-3"
                                value={editMotorcycleName}
                                onChange={(e) =>
                                  setEditMotorcycleName(e.target.value)
                                }
                              />
                            </div>
                          </div>

                          <div className="mt-3">
                            <label className="text-sm font-medium text-gray-700">
                              Add More Photos
                            </label>

                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="mt-1 w-full rounded-xl border bg-white p-3"
                              onChange={(e) =>
                                setEditPhotoFiles(
                                  Array.from(e.target.files || [])
                                )
                              }
                            />

                            {editPhotoFiles.length > 0 && (
                              <p className="mt-2 text-sm text-gray-600">
                                Selected {editPhotoFiles.length} new photo(s)
                              </p>
                            )}
                          </div>

                          <div className="mt-4 flex flex-wrap gap-3">
                            <button
                              onClick={() => saveEdit(bike)}
                              className="rounded-xl bg-black px-4 py-2 font-semibold text-white"
                            >
                              Save
                            </button>

                            <button
                              onClick={cancelEditing}
                              className="rounded-xl border bg-white px-4 py-2 font-semibold hover:bg-gray-100"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-5 flex flex-wrap gap-3">
                          <button
                            onClick={() => startEditing(bike)}
                            className="rounded-xl border px-4 py-2 font-medium hover:bg-gray-100"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => toggleActive(bike)}
                            className={
                              bike.active
                                ? "rounded-xl bg-yellow-500 px-4 py-2 font-medium text-white hover:bg-yellow-600"
                                : "rounded-xl bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700"
                            }
                          >
                            {bike.active ? "Hide" : "Show"}
                          </button>

                          <button
                            onClick={() => deleteMotorcycle(bike.id)}
                            className="rounded-xl bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
                          >
                            Delete Lot
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      </main>
    </StaffGuard>
  );
}