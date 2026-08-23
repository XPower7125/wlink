import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function Redirector({ slug }) {
  const link = useQuery(api.links.getBySlug, { slug });

  useEffect(() => {
    if (link) {
      window.location.replace(link.url);
    }
  }, [link]);

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <p className="text-slate-500 dark:text-slate-400">
        {link === null ? "Link not found." : "Redirecting…"}
      </p>
    </div>
  );
}
