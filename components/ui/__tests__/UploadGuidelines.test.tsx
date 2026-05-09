// components/ui/__tests__/UploadGuidelines.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UploadGuidelines } from "@/components/ui/UploadGuidelines";

describe("<UploadGuidelines />", () => {
  it("shows accepted formats for tripGallery", () => {
    render(<UploadGuidelines kind="tripGallery" />);
    expect(screen.getByText(/JPG/)).toBeInTheDocument();
    expect(screen.getByText(/20 MB/)).toBeInTheDocument();
  });

  it("shows recommended resolution", () => {
    render(<UploadGuidelines kind="heroImage" />);
    expect(screen.getByText(/1920\s*×\s*1080/)).toBeInTheDocument();
  });

  it("shows max count + concurrency for multi-upload kinds", () => {
    render(<UploadGuidelines kind="tripGallery" />);
    expect(screen.getByText(/30/)).toBeInTheDocument();
    expect(screen.getByText(/5/)).toBeInTheDocument();
  });

  it("hides 'in parallel' for single-upload kinds", () => {
    render(<UploadGuidelines kind="banner" />);
    expect(screen.queryByText(/in parallel/i)).not.toBeInTheDocument();
  });

  it("shows aspect guidance and notes", () => {
    render(<UploadGuidelines kind="heroImage" />);
    expect(screen.getByText(/16:9/)).toBeInTheDocument();
  });
});
