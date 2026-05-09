/**
 * GalleryTab — direct-upload integration tests.
 * Tests validate → prepare → uploadWithTicket → register flow.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GalleryTab } from "../GalleryTab";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const prepareMock = vi.fn();
const registerMock = vi.fn();
const fetchGalleryMock = vi.fn(async () => []);
const uploadWithTicketMock = vi.fn(async () => {});
const maybeConvertHeicMock = vi.fn(async (f: File) => f);

vi.mock("@/app/(cms)/media/actions", () => ({
  prepareTripGalleryUploadAction: (...args: unknown[]) => prepareMock(...args),
  registerTripGalleryAction: (...args: unknown[]) => registerMock(...args),
  fetchTripGalleryImages: (...args: unknown[]) => fetchGalleryMock(...args),
  deleteGalleryImageAction: vi.fn(async () => ({ success: true })),
  toggleGalleryFeaturedAction: vi.fn(async () => ({ success: true })),
  toggleGalleryCoverAction: vi.fn(async () => ({ success: true })),
}));

// Alias for the module path used inside GalleryTab (relative import becomes absolute via alias)
vi.mock("../../../media/actions", () => ({
  prepareTripGalleryUploadAction: (...args: unknown[]) => prepareMock(...args),
  registerTripGalleryAction: (...args: unknown[]) => registerMock(...args),
  fetchTripGalleryImages: (...args: unknown[]) => fetchGalleryMock(...args),
  deleteGalleryImageAction: vi.fn(async () => ({ success: true })),
  toggleGalleryFeaturedAction: vi.fn(async () => ({ success: true })),
  toggleGalleryCoverAction: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/lib/storage/client-upload", () => ({
  uploadWithTicket: (...args: unknown[]) => uploadWithTicketMock(...args),
  runWithConcurrency: async (
    items: File[],
    _cap: number,
    fn: (f: File) => Promise<void>,
    onProgress?: (done: number) => void,
  ) => {
    const results = [];
    for (let i = 0; i < items.length; i++) {
      try {
        results.push(await fn(items[i]));
      } catch (e) {
        results.push(e instanceof Error ? e : new Error(String(e)));
      }
      onProgress?.(i + 1);
    }
    return results;
  },
}));

vi.mock("@/lib/storage/heic-convert", () => ({
  maybeConvertHeic: (...args: unknown[]) => maybeConvertHeicMock(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(name = "photo.jpg", size = 1024, type = "image/jpeg"): File {
  return new File(["x".repeat(size)], name, { type });
}

function makeFileList(files: File[]): FileList {
  // jsdom doesn't implement DataTransfer; construct a FileList-like object
  return Object.assign(files, {
    item: (i: number) => files[i] ?? null,
  }) as unknown as FileList;
}

const defaultProps = {
  tripId: "trip-123",
  gallery: [],
  onGalleryChange: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GalleryTab upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prepareMock.mockResolvedValue({
      success: true,
      ticket: { path: "trip-gallery/trip-123/photo.jpg", publicUrl: "https://cdn.example.com/photo.jpg", uploadUrl: "https://upload.example.com", method: "PUT", headers: {} },
    });
    registerMock.mockResolvedValue({ success: true });
    fetchGalleryMock.mockResolvedValue([]);
  });

  it("renders Upload input that getByLabelText finds", () => {
    render(<GalleryTab {...defaultProps} />);
    expect(screen.getByLabelText(/upload/i)).toBeDefined();
  });

  it("calls prepare, uploadWithTicket, and register for a valid file", async () => {
    render(<GalleryTab {...defaultProps} />);
    const input = screen.getByLabelText(/upload/i) as HTMLInputElement;
    const file = makeFile("photo.jpg", 1024, "image/jpeg");
    fireEvent.change(input, { target: { files: makeFileList([file]) } });

    await waitFor(() => expect(prepareMock).toHaveBeenCalledTimes(1));
    expect(prepareMock).toHaveBeenCalledWith({
      tripId: "trip-123",
      fileName: "photo.jpg",
      contentType: "image/jpeg",
      size: 1024,
    });
    expect(uploadWithTicketMock).toHaveBeenCalledTimes(1);
    expect(registerMock).toHaveBeenCalledTimes(1);
    expect(registerMock).toHaveBeenCalledWith(
      expect.objectContaining({ tripId: "trip-123", category: "gallery" }),
    );
  });

  it("rejects an oversized file without calling prepare", async () => {
    const { toast } = await import("sonner");
    render(<GalleryTab {...defaultProps} />);
    const input = screen.getByLabelText(/upload/i) as HTMLInputElement;
    // UPLOAD_RULES.tripGallery.maxBytes = 20MB; 25MB exceeds it
    const bigFile = makeFile("big.jpg", 25 * 1024 * 1024, "image/jpeg");
    fireEvent.change(input, { target: { files: makeFileList([bigFile]) } });

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(prepareMock).not.toHaveBeenCalled();
    expect(uploadWithTicketMock).not.toHaveBeenCalled();
  });

  it("rejects a wrong MIME type without calling prepare", async () => {
    const { toast } = await import("sonner");
    render(<GalleryTab {...defaultProps} />);
    const input = screen.getByLabelText(/upload/i) as HTMLInputElement;
    const badFile = makeFile("doc.pdf", 1024, "application/pdf");
    fireEvent.change(input, { target: { files: makeFileList([badFile]) } });

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(prepareMock).not.toHaveBeenCalled();
  });

  it("shows no-tripId error if tripId is null", async () => {
    const { toast } = await import("sonner");
    render(<GalleryTab {...defaultProps} tripId={null} />);
    const input = screen.getByLabelText(/upload/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: makeFileList([makeFile()]) } });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/save the trip/i)));
    expect(prepareMock).not.toHaveBeenCalled();
  });

  it("shows prepare error as toast and skips uploadWithTicket", async () => {
    prepareMock.mockResolvedValue({ success: false, error: "Server error" });
    const { toast } = await import("sonner");
    render(<GalleryTab {...defaultProps} />);
    const input = screen.getByLabelText(/upload/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: makeFileList([makeFile()]) } });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("photo.jpg: Server error"));
    expect(uploadWithTicketMock).not.toHaveBeenCalled();
    expect(registerMock).not.toHaveBeenCalled();
  });
});
