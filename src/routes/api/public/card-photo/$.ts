import { createFileRoute } from "@tanstack/react-router";
import { CARD_PHOTO_BUCKET, isCardPhotoFile } from "@/lib/card-photo";

// Serves admin-uploaded card photos from the private bucket. Only random UUID
// file names are accepted, so nothing else in storage can be read through here.
export const Route = createFileRoute("/api/public/card-photo/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const file = params._splat ?? "";
        if (!isCardPhotoFile(file)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from(CARD_PHOTO_BUCKET).download(file);
        if (error || !data) return new Response("Not found", { status: 404 });
        return new Response(data, {
          headers: {
            "Content-Type": file.endsWith(".webp") ? "image/webp" : file.endsWith(".png") ? "image/png" : "image/jpeg",
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
