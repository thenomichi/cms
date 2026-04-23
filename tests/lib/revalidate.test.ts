describe("cms revalidate helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.WEBSITE_URL = "https://website.test";
    process.env.REVALIDATION_SECRET = "secret";
  });

  it("skips outbound revalidation when env vars are missing", async () => {
    process.env.WEBSITE_URL = "";
    const { revalidateWebsite } = await import("@/lib/revalidate");
    await revalidateWebsite(["/"]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts the correct payload to the website revalidation endpoint", async () => {
    const { revalidateWebsite } = await import("@/lib/revalidate");
    await revalidateWebsite(["/", "/about"], ["site-features"]);

    expect(fetch).toHaveBeenCalledWith("https://website.test/api/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: "secret",
        paths: ["/", "/about"],
        tags: ["site-features"],
      }),
    });
  });

  it("logs and swallows fetch failures", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network"));
    const { revalidateWebsite } = await import("@/lib/revalidate");

    await expect(revalidateWebsite(["/"])).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("exposes helper shortcuts for trips, reviews, home and static pages", async () => {
    const module = await import("@/lib/revalidate");

    await module.revalidateTrip("spiti");
    expect(fetch).toHaveBeenNthCalledWith(1, "https://website.test/api/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: "secret",
        paths: [
          "/",
          "/join-a-trip",
          "/beyond-ordinary",
          "/signature-journeys",
          "/trips/spiti",
        ],
        tags: [],
      }),
    });

    await module.revalidateReview("spiti");
    expect(fetch).toHaveBeenNthCalledWith(2, "https://website.test/api/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: "secret",
        paths: ["/", "/trips/spiti"],
        tags: [],
      }),
    });

    await module.revalidateReview();
    expect(fetch).toHaveBeenNthCalledWith(3, "https://website.test/api/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: "secret",
        paths: ["/"],
        tags: [],
      }),
    });

    await module.revalidateHome();
    expect(fetch).toHaveBeenNthCalledWith(4, "https://website.test/api/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: "secret",
        paths: ["/"],
        tags: [],
      }),
    });

    await module.revalidateAbout();
    expect(fetch).toHaveBeenNthCalledWith(5, "https://website.test/api/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: "secret",
        paths: ["/about"],
        tags: [],
      }),
    });

    await module.revalidateCareers();
    expect(fetch).toHaveBeenNthCalledWith(6, "https://website.test/api/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: "secret",
        paths: ["/careers"],
        tags: [],
      }),
    });
  });
});
