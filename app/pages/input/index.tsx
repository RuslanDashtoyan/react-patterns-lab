import React, { useCallback, useState } from "react";

import { useDebounce, useGithubSearch } from "~/hooks";

export const Input = () => {
  const [value, setValue] = useState("");
  const debouncedValue = useDebounce(value, 500);
  const { repos, isLoading, error } = useGithubSearch(debouncedValue);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  }, []);

  return (
    <div className="flex flex-col items-start gap-2">
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder="Search GitHub repositories"
        className="h-10 border border-gray-500 p-4 rounded-md"
      />

      {!value ? (
        "Type in input for data"
      ) : isLoading ? (
        <div>Loading ...</div>
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : repos.length > 0 ? (
        <ul>
          {repos.map((repo) => (
            <li key={repo.id}>
              <a href={repo.html_url} target="_blank" rel="noreferrer">
                {repo.full_name}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        "No Results"
      )}
    </div>
  );
};
