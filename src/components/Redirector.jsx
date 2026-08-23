import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

// F1c fix: only follow http(s) destinations, never attacker-chosen schemes
// like javascript:, data:, or vbscript:.
function isSafeDestination(url) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function Redirector({ slug }) {
  const link = useQuery(api.links.getBySlug, { slug });

  useEffect(() => {
    if (!link) return;
    if (isSafeDestination(link.url)) {
      window.location.replace(link.url);
    }
  }, [link]);

  const blocked = link !== undefined && !isSafeDestination(link.url);

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <p className="text-slate-500 dark:text-slate-400">
        {link === null
          ? "Link not found."
          : blocked
            ? "This link points to an unsupported destination."
            : "Redirecting…"}
      </p>
    </div>
  );
}
