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

    const { prompt, aspectRatio, stylePreset, numImages, model } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");

    if (!apiKey) {
      return new Response(JSON.stringify({
        error: "AI image provider not configured. Set OPENAI_API_KEY in edge function secrets to enable image generation.",
      }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const enhancedPrompt = stylePreset
      ? `${prompt}, ${stylePreset} style, high quality, detailed`
      : `${prompt}, high quality, detailed`;

    const sizeMap: Record<string, string> = {
      "1:1": "1024x1024",
      "16:9": "1792x1024",
      "9:16": "1024x1792",
      "4:3": "1792x1024",
      "3:2": "1792x1024",
      "21:9": "1792x1024",
    };

    const size = sizeMap[aspectRatio] || "1024x1024";

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_IMAGE_MODEL") || "dall-e-3",
        prompt: enhancedPrompt,
        n: Math.min(numImages || 1, model === "dall-e-3" ? 1 : 4),
        size,
        quality: "standard",
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Image generation error:", errText);
      return new Response(JSON.stringify({
        error: "Image generation failed. The AI provider returned an error.",
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const images = (data.data || []).map((item: { url?: string; b64_json?: string }) =>
      item.url || (item.b64_json ? `data:image/png;base64,${item.b64_json}` : null)
    ).filter(Boolean);

    if (images.length === 0) {
      return new Response(JSON.stringify({
        error: "No images were returned by the provider.",
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ images }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({
      error: "Internal server error during image generation.",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
