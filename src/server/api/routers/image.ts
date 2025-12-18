import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { getOpenAIImageService } from "~/server/services/openaiImage";
import { saveTestOutput } from "~/server/services/fileStore";

export const imageRouter = createTRPCRouter({
  /**
   * Test generate endpoint - produces a simple test image to verify the pipeline works
   */
  testGenerate: publicProcedure.mutation(async () => {
    const service = getOpenAIImageService();
    const result = await service.testGenerate();

    if (!result.success || !result.imageBuffer) {
      return {
        success: false,
        error: result.error ?? "Unknown error generating image",
      };
    }

    // Save the generated image
    const timestamp = Date.now();
    const filename = `test_${timestamp}.png`;
    const filePath = await saveTestOutput(filename, result.imageBuffer);

    // Convert to base64 for display
    const base64 = result.imageBuffer.toString("base64");

    return {
      success: true,
      filename,
      filePath,
      modelUsed: result.modelUsed,
      revisedPrompt: result.revisedPrompt,
      imageBase64: `data:image/png;base64,${base64}`,
    };
  }),

  /**
   * Generate image from custom prompt (for testing)
   */
  generate: publicProcedure
    .input(
      z.object({
        prompt: z.string().min(1).max(4000),
        size: z.enum(["1024x1024", "1024x1536", "1536x1024", "auto"]).optional(),
        quality: z.enum(["low", "medium", "high", "auto"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const service = getOpenAIImageService();
      const result = await service.generateImage({
        prompt: input.prompt,
        size: input.size,
        quality: input.quality,
      });

      if (!result.success || !result.imageBuffer) {
        return {
          success: false,
          error: result.error ?? "Unknown error generating image",
        };
      }

      // Save the generated image
      const timestamp = Date.now();
      const filename = `generated_${timestamp}.png`;
      const filePath = await saveTestOutput(filename, result.imageBuffer);

      // Convert to base64 for display
      const base64 = result.imageBuffer.toString("base64");

      return {
        success: true,
        filename,
        filePath,
        modelUsed: result.modelUsed,
        revisedPrompt: result.revisedPrompt,
        imageBase64: `data:image/png;base64,${base64}`,
      };
    }),
});
