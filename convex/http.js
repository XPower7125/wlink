import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth, { cors: true });

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=30",
    },
  });

http.route({
  pathPrefix: "/api/link/",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const slug = new URL(req.url).pathname.slice("/api/link/".length);
    if (!/^[a-zA-Z0-9-]{1,40}$/.test(slug)) {
      return json({ error: "Invalid slug." }, 400);
    }
    const link = await ctx.runQuery(api.links.getBySlug, { slug });
    if (!link) {
      return json({ error: "Not found." }, 404);
    }
    return json({
      title: link.title,
      description: link.description,
      icon: link.icon ?? null,
      color: link.color ?? null,
      image: link.image ?? null,
    });
  }),
});

export default http;
