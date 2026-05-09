/**
 * ImagePicker — direct-upload integration tests.
 * Verifies validate → prepare → uploadWithTicket → register dance.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ImagePicker } from "@/components/ui/ImagePicker";
import type { UploadTicket } from "@/lib/storage/provider";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const uploadWithTicketMock = vi.fn(async () => {});
const maybeConvertHeicMock = vi.fn(async (f: File) => f);

vi.mock("@/lib/storage/client-upload", () => ({
  uploadWithTicket: (...args: unknown[]) => uploadWithTicketMock(...args),
  runWithConcurrency: vi.fn(),
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

const ticket: UploadTicket = {
  path: "banner/test.jpg",
  publicUrl: "https://cdn.example.com/banner/test.jpg",
  uploadUrl: "https://upload.example.com",
  method: "PUT",
  headers: {},
};

function makeFile(name = "banner.jpg", size = 1024, type = "image/jpeg"): File {
  return new File(["x".repeat(size)], name, { type });
}

function makeFileList(files: File[]): FileList {
  return Object.assign(files, { item: (i: number) => files[i] ?? null }) as unknown as FileList;
}

const prepareMock = vi.fn();
const registerMock = vi.fn();
const fetchImagesMock = vi.fn(async () => []);
const onChangeMock = vi.fn();

const defaultProps = {
  value: "",
  onChange: onChangeMock,
  fetchImages: fetchImagesMock,
  prepareUpload: prepareMock,
  registerUpload: registerMock,
  kind: "banner" as const,
  label: "Banner Image",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ImagePicker upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prepareMock.mockResolvedValue({ success: true, ticket });
    registerMock.mockResolvedValue({ success: true, url: ticket.publicUrl });
    fetchImagesMock.mockResolvedValue([]);
  });

  it("renders trigger button", () => {
    render(<ImagePicker {...defaultProps} />);
    expect(screen.getByRole("button", { name: /choose or upload/i })).toBeDefined();
  });

  it("calls prepare, uploadWithTicket, and register for a valid file", async () => {
    render(<ImagePicker {...defaultProps} />);
    // Open picker first
    fireEvent.click(screen.getByRole("button", { name: /choose or upload/i }));

    await waitFor(() => expect(screen.getByLabelText(/upload banner image/i)).toBeDefined());
    const input = screen.getByLabelText(/upload banner image/i) as HTMLInputElement;
    const file = makeFile("banner.jpg", 1024, "image/jpeg");
    fireEvent.change(input, { target: { files: makeFileList([file]) } });

    await waitFor(() => expect(prepareMock).toHaveBeenCalledTimes(1));
    expect(prepareMock).toHaveBeenCalledWith({
      fileName: "banner.jpg",
      contentType: "image/jpeg",
      size: 1024,
    });
    expect(uploadWithTicketMock).toHaveBeenCalledTimes(1);
    expect(registerMock).toHaveBeenCalledWith({
      path: ticket.path,
      publicUrl: ticket.publicUrl,
    });
    expect(onChangeMock).toHaveBeenCalledWith(ticket.publicUrl);
  });

  it("rejects an oversized file without calling prepare", async () => {
    const { toast } = await import("sonner");
    render(<ImagePicker {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /choose or upload/i }));
    await waitFor(() => expect(screen.getByLabelText(/upload banner image/i)).toBeDefined());

    const input = screen.getByLabelText(/upload banner image/i) as HTMLInputElement;
    // banner maxBytes = 10MB; 15MB exceeds it
    const bigFile = makeFile("big.jpg", 15 * 1024 * 1024, "image/jpeg");
    fireEvent.change(input, { target: { files: makeFileList([bigFile]) } });

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(prepareMock).not.toHaveBeenCalled();
    expect(uploadWithTicketMock).not.toHaveBeenCalled();
  });

  it("rejects a wrong MIME type without calling prepare", async () => {
    const { toast } = await import("sonner");
    render(<ImagePicker {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /choose or upload/i }));
    await waitFor(() => expect(screen.getByLabelText(/upload banner image/i)).toBeDefined());

    const input = screen.getByLabelText(/upload banner image/i) as HTMLInputElement;
    const badFile = makeFile("vid.mp4", 1024, "video/mp4");
    fireEvent.change(input, { target: { files: makeFileList([badFile]) } });

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(prepareMock).not.toHaveBeenCalled();
  });

  it("shows prepare error as toast and skips uploadWithTicket", async () => {
    prepareMock.mockResolvedValue({ success: false, error: "Quota exceeded" });
    const { toast } = await import("sonner");
    render(<ImagePicker {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /choose or upload/i }));
    await waitFor(() => expect(screen.getByLabelText(/upload banner image/i)).toBeDefined());

    const input = screen.getByLabelText(/upload banner image/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: makeFileList([makeFile()]) } });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Quota exceeded"));
    expect(uploadWithTicketMock).not.toHaveBeenCalled();
    expect(registerMock).not.toHaveBeenCalled();
  });
});
