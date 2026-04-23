import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsClient } from "@/app/(cms)/settings/_components/SettingsClient";

const updateSettingsActionMock = vi.fn();
const fetchHeroMediaImagesActionMock = vi.fn();
const uploadHeroImageActionMock = vi.fn();
const uploadHeroVideoActionMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock("@/app/(cms)/settings/actions", () => ({
  updateSettingsAction: (...args: unknown[]) => updateSettingsActionMock(...args),
  fetchHeroMediaImagesAction: (...args: unknown[]) => fetchHeroMediaImagesActionMock(...args),
  uploadHeroImageAction: (...args: unknown[]) => uploadHeroImageActionMock(...args),
  uploadHeroVideoAction: (...args: unknown[]) => uploadHeroVideoActionMock(...args),
}));
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));
vi.mock("@/components/ui/RichTextInput", () => ({
  RichTextInput: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      aria-label={placeholder ?? "rich-text-input"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
  toHtml: (value: string) => value,
  fromHtml: (value: string) => value,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("SettingsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchHeroMediaImagesActionMock.mockResolvedValue([]);
    uploadHeroImageActionMock.mockResolvedValue({ success: true, url: "https://cdn.test/hero.jpg" });
    uploadHeroVideoActionMock.mockResolvedValue({
      success: true,
      url: "https://cdn.test/hero.mp4",
    });
  });

  it("renders the site-surface controls, updates toggles, and saves nested feature state", async () => {
    const user = userEvent.setup();
    updateSettingsActionMock.mockResolvedValue({ success: true });
    render(
      <SettingsClient
        initialSettings={{
          features: {
            join_a_trip: { enabled: true },
            beyond_ordinary: { enabled: false },
          },
          hero: { headline: "Hello", subline: "World" },
          stats: {},
          contact: { phone: "+91" },
          brand: {},
        }}
      />,
    );

    expect(screen.getByText("Feature Controls")).toBeInTheDocument();
    expect(screen.getByText("Trips people can browse")).toBeInTheDocument();
    expect(screen.getByText("Planning and gifting")).toBeInTheDocument();
    expect(screen.getByText("Brand and company pages")).toBeInTheDocument();
    expect(screen.getAllByText("Live").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hidden").length).toBeGreaterThan(0);

    const switches = screen.getAllByRole("switch");
    await user.click(switches[0]);
    await user.click(screen.getByRole("button", { name: /save all settings/i }));

    await waitFor(() => {
      expect(updateSettingsActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          features: expect.objectContaining({
            join_a_trip: { enabled: false },
            beyond_ordinary: { enabled: false },
          }),
        }),
      );
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Settings saved!");
  });

  it("updates nested string fields and refreshes when initial settings change", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <SettingsClient
        initialSettings={{
          features: {},
          hero: { headline: "Hello", subline: "Original subline" },
          stats: {},
          contact: { phone: "+91" },
          brand: {},
        }}
      />,
    );

    expect(screen.getByText("Content Settings")).toBeInTheDocument();
    expect(screen.getByText("Homepage & Storytelling")).toBeInTheDocument();
    expect(screen.getByText("Brand & Contact")).toBeInTheDocument();
    expect(screen.getByText("Hero background media")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /automatic/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const sublineInput = screen.getByDisplayValue("Original subline");
    await user.clear(sublineInput);
    await user.type(sublineInput, "Updated subline");

    rerender(
      <SettingsClient
        initialSettings={{
          features: { plan_a_trip: { enabled: false } },
          hero: { headline: "Fresh", subline: "Server copy" },
          stats: {},
          contact: { phone: "+92" },
          brand: {},
        }}
      />,
    );

    expect(screen.getByDisplayValue("Server copy")).toBeInTheDocument();
    expect(screen.getByDisplayValue("+92")).toBeInTheDocument();
    expect(screen.getByText("Hidden")).toBeInTheDocument();
  });

  it("saves nested hero media settings from the content controls", async () => {
    const user = userEvent.setup();
    updateSettingsActionMock.mockResolvedValue({ success: true });

    render(
      <SettingsClient
        initialSettings={{
          features: {},
          hero: {
            media: {
              mode: "auto",
              imageUrl: "",
              videoUrl: "",
              posterUrl: "",
            },
          },
          stats: {},
          contact: {},
          brand: {},
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /video background/i }));
    const videoUrlInput = screen.getByPlaceholderText("https://.../hero-video.mp4");
    await user.clear(videoUrlInput);
    await user.type(videoUrlInput, "https://cdn.test/fixed-hero.mp4");

    await user.click(screen.getByRole("button", { name: /save all settings/i }));

    await waitFor(() => {
      expect(updateSettingsActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          hero: expect.objectContaining({
            media: expect.objectContaining({
              mode: "video",
              videoUrl: "https://cdn.test/fixed-hero.mp4",
            }),
          }),
        }),
      );
    });
  });

  it("shows a failure toast when the save action returns an error", async () => {
    const user = userEvent.setup();
    updateSettingsActionMock.mockResolvedValue({ success: false, error: "Failed badly" });

    render(
      <SettingsClient
        initialSettings={{
          features: {},
          hero: {},
          stats: {},
          contact: {},
          brand: {},
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /save all settings/i }));
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Failed to save settings");
    });
  });

  it("shows a pending save state while the action is in flight", async () => {
    const user = userEvent.setup();
    const pending = deferred<{ success: boolean }>();
    updateSettingsActionMock.mockReturnValue(pending.promise);

    render(
      <SettingsClient
        initialSettings={{
          features: {},
          hero: {},
          stats: {},
          contact: {},
          brand: {},
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /save all settings/i }));
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();

    pending.resolve({ success: true });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save all settings/i })).toBeEnabled();
    });
  });
});
