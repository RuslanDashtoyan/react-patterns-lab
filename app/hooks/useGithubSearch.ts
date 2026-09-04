import { useEffect, useState } from "react";

export interface GithubRepo {
  id: number;
  full_name: string;
  html_url: string;
  description: string | null;
}

interface GithubSearchResponse {
  items: GithubRepo[];
}

interface TaggedResult {
  query: string;
  repos: GithubRepo[];
}

interface TaggedError {
  query: string;
  message: string;
}

const searchUrl = (query: string) =>
  `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=10`;

export const useGithubSearch = (query: string) => {
  const [result, setResult] = useState<TaggedResult | null>(null);
  const [error, setError] = useState<TaggedError | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!query) return;

    setLoading(true);

    const controller = new AbortController();

    fetch(searchUrl(query), { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
        return res.json() as Promise<GithubSearchResponse>;
      })
      .then((json) => setResult({ query, repos: json.items ?? [] }))
      .catch((err: Error) => {
        if (err.name !== "AbortError")
          setError({ query, message: err.message });
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [query]);

  return {
    repos: result?.query === query ? result.repos : [],
    isLoading: loading,
    error: error?.message ?? null,
  };
};
