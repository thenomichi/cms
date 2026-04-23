import { useRef, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { FormSection } from "@/components/ui/FormSection";
import { ImagePicker } from "@/components/ui/ImagePicker";
import { RichTextInput, fromHtml, toHtml } from "@/components/ui/RichTextInput";
import { UploadZone } from "@/components/ui/UploadZone";
import {
  fetchHeroMediaImagesAction,
  uploadHeroImageAction,
  uploadHeroVideoAction,
} from "../actions";
import { getString } from "./settings-form-utils";

interface ContentSettingsSectionProps {
  data: Record<string, unknown>;
  onUpdate: (path: string, value: unknown) => void;
}

type HeroMediaMode = "auto" | "image" | "video";

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <input
      className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-rust"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function getHeroMediaMode(data: Record<string, unknown>): HeroMediaMode {
  const raw = getString(data, "hero.media.mode");
  return raw === "image" || raw === "video" ? raw : "auto";
}

function HeroMediaField({
  data,
  onUpdate,
}: {
  data: Record<string, unknown>;
  onUpdate: (path: string, value: unknown) => void;
}) {
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const mode = getHeroMediaMode(data);
  const imageUrl = getString(data, "hero.media.imageUrl");
  const videoUrl = getString(data, "hero.media.videoUrl");
  const posterUrl = getString(data, "hero.media.posterUrl");

  const setMode = (nextMode: HeroMediaMode) => {
    onUpdate("hero.media.mode", nextMode);
  };

  const uploadVideo = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setVideoUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", files[0]);
      const result = await uploadHeroVideoAction(formData);
      if (!result.success || !result.url) {
        throw new Error(result.error || "Video upload failed");
      }
      onUpdate("hero.media.videoUrl", result.url);
      toast.success("Hero video uploaded");
    } catch (error) {
      toast.error((error as Error).message || "Video upload failed");
    } finally {
      setVideoUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-surface2 p-4">
        <div className="flex flex-wrap gap-2">
          {[
            {
              value: "auto" as const,
              title: "Automatic",
              body: "Nomichi picks the current homepage visual automatically.",
            },
            {
              value: "image" as const,
              title: "Fixed image",
              body: "Use one chosen image every time the homepage opens.",
            },
            {
              value: "video" as const,
              title: "Video background",
              body: "Upload a looping hero video and keep the image poster optional.",
            },
          ].map((option) => {
            const active = mode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => setMode(option.value)}
                className={[
                  "min-w-[180px] flex-1 rounded-xl border px-4 py-3 text-left transition-colors",
                  active
                    ? "border-rust bg-rust-tint shadow-[0_0_0_1px_rgba(201,75,26,0.14)]"
                    : "border-line bg-surface hover:border-fog",
                ].join(" ")}
              >
                <div className="text-sm font-semibold text-ink">{option.title}</div>
                <div className="mt-1 text-xs leading-5 text-mid">{option.body}</div>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs leading-5 text-fog">
          Tip: use <span className="font-semibold text-ink">Automatic</span> if you want the
          homepage to keep following the live gallery. Choose a fixed image or video only when you
          want full control over the first visual people see.
        </p>
      </div>

      {mode === "auto" && (
        <div className="rounded-xl border border-dashed border-line bg-surface2 px-4 py-3 text-sm leading-6 text-mid">
          The homepage will keep using the live automatic hero media. No upload is required.
        </div>
      )}

      {mode === "image" && (
        <FormField
          label="Hero image"
          hint="Choose an existing banner image or upload a new one. This image will stay fixed until you change it."
        >
          <ImagePicker
            value={imageUrl}
            onChange={(value) => onUpdate("hero.media.imageUrl", value)}
            fetchImages={fetchHeroMediaImagesAction}
            uploadImage={uploadHeroImageAction}
            label="hero image"
            aspectHint="Recommended: wide cinematic image, at least 1600px wide."
          />
        </FormField>
      )}

      {mode === "video" && (
        <div className="space-y-4">
          <FormField
            label="Hero video"
            hint="Upload an MP4/WebM/QuickTime file. Uploading fills the video URL automatically."
          >
            <div className="space-y-3">
              {videoUrl ? (
                <div className="overflow-hidden rounded-xl border border-line bg-surface2">
                  <video
                    src={videoUrl}
                    controls
                    muted
                    playsInline
                    className="h-44 w-full bg-black object-cover"
                  />
                  <div className="space-y-3 p-3">
                    <div className="break-all text-xs text-fog">{videoUrl}</div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => videoInputRef.current?.click()}
                        className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-mid hover:text-ink"
                      >
                        Replace video
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdate("hero.media.videoUrl", "")}
                        className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-mid hover:text-ink"
                      >
                        Remove video
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <UploadZone
                  onUpload={uploadVideo}
                  uploading={videoUploading}
                  accept="video/mp4,video/webm,video/quicktime"
                  className="py-8"
                />
              )}
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="hidden"
                onChange={(event) => uploadVideo(event.target.files)}
              />
              <TextInput
                value={videoUrl}
                onChange={(value) => onUpdate("hero.media.videoUrl", value)}
                placeholder="https://.../hero-video.mp4"
              />
            </div>
          </FormField>

          <FormField
            label="Poster image (optional)"
            hint="Shown while the video loads or if video playback is not available."
          >
            <ImagePicker
              value={posterUrl}
              onChange={(value) => onUpdate("hero.media.posterUrl", value)}
              fetchImages={fetchHeroMediaImagesAction}
              uploadImage={uploadHeroImageAction}
              label="poster image"
              aspectHint="Recommended: use a still from the same video for a seamless first frame."
            />
          </FormField>
        </div>
      )}
    </div>
  );
}

export function ContentSettingsSection({ data, onUpdate }: ContentSettingsSectionProps) {
  return (
    <section>
      <div className="mb-3">
        <h3 className="text-base font-semibold text-ink">Content Settings</h3>
        <p className="mt-1 text-sm leading-6 text-mid">
          Edit the words and contact details people see across the site. These fields do not turn
          sections on or off.
        </p>
      </div>

      <div className="space-y-5">
        <Card
          title="Homepage & Storytelling"
          subtitle="Messaging that shapes the first impression of the brand and the story visitors see."
        >
          <div className="space-y-4">
            <FormSection
              title="Hero banner"
              description="Homepage headline, supporting copy, and the main image or video people see first."
            >
              <div className="flex flex-col gap-3">
                <FormField label="Headline">
                  <RichTextInput
                    value={fromHtml(getString(data, "hero.headline"))}
                    onChange={(v) => onUpdate("hero.headline", toHtml(v))}
                    placeholder="e.g. Travel experiences for people who want to *feel something*"
                  />
                </FormField>
                <FormField label="Subline">
                  <TextInput
                    value={getString(data, "hero.subline")}
                    onChange={(value) => onUpdate("hero.subline", value)}
                    placeholder="Community-first. Handcrafted. Always offbeat."
                  />
                </FormField>
                <FormField label="Hero background media">
                  <HeroMediaField data={data} onUpdate={onUpdate} />
                </FormField>
              </div>
            </FormSection>

            <FormSection
              title="About page stats"
              description="Numbers shown in the stats band on the about page."
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <FormField label="Trips Completed">
                  <TextInput
                    value={getString(data, "stats.trips_completed")}
                    onChange={(value) => onUpdate("stats.trips_completed", value)}
                    placeholder="100+"
                  />
                </FormField>
                <FormField label="Travellers Count">
                  <TextInput
                    value={getString(data, "stats.travellers_count")}
                    onChange={(value) => onUpdate("stats.travellers_count", value)}
                    placeholder="350+"
                  />
                </FormField>
                <FormField label="Average Rating">
                  <TextInput
                    value={getString(data, "stats.avg_rating")}
                    onChange={(value) => onUpdate("stats.avg_rating", value)}
                    placeholder="4.9"
                  />
                </FormField>
              </div>
            </FormSection>
          </div>
        </Card>

        <Card
          title="Brand & Contact"
          subtitle="Public contact details and core brand messaging used across the website."
        >
          <div className="space-y-4">
            <FormSection
              title="Contact information"
              description="Shown in support surfaces like the footer and contact pages."
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FormField label="Phone">
                  <TextInput
                    value={getString(data, "contact.phone")}
                    onChange={(value) => onUpdate("contact.phone", value)}
                    placeholder="+91 70009 62406"
                  />
                </FormField>
                <FormField label="Email">
                  <TextInput
                    value={getString(data, "contact.email")}
                    onChange={(value) => onUpdate("contact.email", value)}
                    placeholder="hello@thenomichi.com"
                  />
                </FormField>
                <FormField label="Instagram URL">
                  <TextInput
                    value={getString(data, "contact.instagram")}
                    onChange={(value) => onUpdate("contact.instagram", value)}
                    placeholder="https://instagram.com/thenomichi"
                  />
                </FormField>
                <FormField label="WhatsApp Number">
                  <TextInput
                    value={getString(data, "contact.whatsapp")}
                    onChange={(value) => onUpdate("contact.whatsapp", value)}
                    placeholder="917000962406"
                  />
                </FormField>
                <FormField label="Location" className="md:col-span-2">
                  <TextInput
                    value={getString(data, "contact.location")}
                    onChange={(value) => onUpdate("contact.location", value)}
                    placeholder="Bengaluru, India"
                  />
                </FormField>
              </div>
            </FormSection>

            <FormSection
              title="Brand copy"
              description="Reusable brand text shown in the footer and other shared surfaces."
            >
              <div className="flex flex-col gap-3">
                <FormField label="Brand Description">
                  <textarea
                    className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-rust"
                    rows={3}
                    value={getString(data, "brand.description")}
                    onChange={(e) => onUpdate("brand.description", e.target.value)}
                    placeholder="Travel experiences for people who want to feel something..."
                  />
                </FormField>
                <FormField label="Footer Tagline">
                  <TextInput
                    value={getString(data, "brand.tagline")}
                    onChange={(value) => onUpdate("brand.tagline", value)}
                    placeholder="Find Your Kind of Travel"
                  />
                </FormField>
              </div>
            </FormSection>
          </div>
        </Card>
      </div>
    </section>
  );
}
