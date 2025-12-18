import { imageRouter } from "~/server/api/routers/image";
import { projectRouter } from "~/server/api/routers/project";
import { variantRouter } from "~/server/api/routers/variant";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * Primary tRPC router for LocaleLens
 *
 * Routers:
 * - image: Test generation and utilities
 * - project: Project CRUD and demo asset loading
 * - variant: Variant generation pipeline
 */
export const appRouter = createTRPCRouter({
  image: imageRouter,
  project: projectRouter,
  variant: variantRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 */
export const createCaller = createCallerFactory(appRouter);
