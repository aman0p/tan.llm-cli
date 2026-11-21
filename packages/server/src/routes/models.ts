import { Hono } from "hono";
import { getOpenRouterModels } from "../lib/models";

const app = new Hono().get("/", async (c) => {
  try {
    return c.json(await getOpenRouterModels());
  } catch (error) {
    console.error("Failed to load OpenRouter models", error);
    return c.json({ error: "Unable to load OpenRouter models" }, 503);
  }
});

export default app;
