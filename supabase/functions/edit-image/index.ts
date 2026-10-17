const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { imageUrl, tool, instruction, bgReplacement, outpaintDirection } = await req.json();

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "Image is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");

    if (!apiKey) {
      return new Response(JSON.stringify({
        error: "AI image editing provider not configured. Set OPENAI_API_KEY in edge function secrets.",
      }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let editPrompt = instruction || "";
    if (tool === "bg-remove") {
      const bgDesc = bgReplacement === "white" ? "a plain white background" : bgReplacement === "black" ? "a plain black background" : "a transparent background";
      editPrompt = `Remove the background and replace it with ${bgDesc}.`;
    } else if (tool === "upscale") {
      editPrompt = "Enhance and upscale this image to higher resolution and quality.";
    } else if (tool === "outpaint") {
      const dirDesc = outpaintDirection === "horizontal" ? "horizontally (left and right)" : outpaintDirection === "vertical" ? "vertically (top and bottom)" : "in all directions";
      editPrompt = instruction || `Expand the image by extending the scene naturally ${dirDesc}.`;
    }

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
      body: await buildFormData(imageUrl, editPrompt),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Image edit error:", errText);
      return new Response(JSON.stringify({
        error: "Image editing failed. The AI provider returned an error.",
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const resultUrl = data.data?.[0]?.url;

    if (!resultUrl) {
      return new Response(JSON.stringify({
        error: "No result image was returned.",
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ resultUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({
      error: "Internal server error during image editing.",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function buildFormData(imageUrl: string, prompt: string): Promise<FormData> {
  const formData = new FormData();

  if (imageUrl.startsWith("data:")) {
    const base64 = imageUrl.split(",")[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "image/png" });
    formData.append("image", blob, "image.png");
  } else {
    const imgResponse = await fetch(imageUrl);
    const blob = await imgResponse.blob();
    formData.append("image", blob, "image.png");
  }

  formData.append("prompt", prompt);
  formData.append("model", "dall-e-2");
  formData.append("n", "1");
  formData.append("size", "1024x1024");

  return formData;
}
