export default {
  id: "nvidia",
  priority: 20,
  hasFree: true,
  alias: "nvidia",
  display: {
    name: "NVIDIA NIM",
    icon: "developer_board",
    color: "#76B900",
    textIcon: "NV",
    website: "https://developer.nvidia.com/nim",
    notice: {
      text: "Free access for NVIDIA Developer Program members (prototyping & testing).",
      apiKeyUrl: "https://build.nvidia.com/settings/api-keys",
    },
  },
  category: "freeTier",
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://integrate.api.nvidia.com/v1/chat/completions",
    validateUrl: "https://integrate.api.nvidia.com/v1/models",
  },
  // Ids must exist in the live catalog (GET /v1/models): NVIDIA's gateway answers an unlisted
  // model with a bare-text 404 "page not found", retired ids with 410.
  models: [
    { id: "minimaxai/minimax-m3.1-flash", name: "MiniMax M3.1 Flash" },
    { id: "z-ai/glm-5.3-flash", name: "GLM 5.3 Flash" },
    { id: "deepseek-ai/deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash" },
    { id: "moonshotai/kimi-k2.6", name: "Kimi K2.6" },
    { id: "nvidia/nemotron-3-ultra-550b-a55b", name: "Nemotron 3 Ultra" },
    { id: "nvidia/nemotron-3-embed-1b", name: "Nemotron 3 Embed 1B", kind: "embedding" },
    { id: "nvidia/parakeet-ctc-1.1b-asr", name: "Parakeet CTC 1.1B", params: ["language"], kind: "stt" },
    { id: "fastpitch", name: "FastPitch", kind: "tts" },
    { id: "tacotron2", name: "Tacotron2", kind: "tts" },
  ],
  serviceKinds: ["llm","tts","embedding"],
  ttsConfig: {
    baseUrl: "https://integrate.api.nvidia.com/v1/audio/speech",
    authType: "apikey",
    authHeader: "bearer",
    format: "nvidia-tts",
  },
  embeddingConfig: { baseUrl: "https://integrate.api.nvidia.com/v1/embeddings", authType: "apikey", authHeader: "bearer" },
};
