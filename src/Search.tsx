import { t } from "./i18n/ja";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { searchRepository } from "./local/repository/searchRepository";
import { Thumb } from "./Thumb";
interface Result {
  id: string;
  display_id: string;
  title: string;
  cover_image_id: string;
  snippet: string;
}
export default function Search() {
  const [query, setQuery] = useState(
      sessionStorage.getItem("search-query") ?? "",
    ),
    [results, setResults] = useState<Result[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [error, setError] = useState("");
  const nav = useNavigate(),
    location = useLocation();
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      sessionStorage.setItem("search-query", query);
      void searchRepository
        .search(query)
        .then((r) => {
          if (alive) {
            setResults(r.items);
            setCursor(r.cursor);
            setError("");
          }
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);
  return (
    <main className="page search-page">
      <h2>{t("app_007")}</h2>
      <label>
        {t("search_136")}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search_137")}
          autoComplete="off"
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <div className="search-results">
        {results.map((r) => (
          <button
            key={r.id}
            className="search-result"
            onClick={() =>
              nav(`/cards/${r.id}`, { state: { background: location } })
            }
          >
            <Thumb id={r.cover_image_id} alt="" />
            <span>
              <b>{r.display_id}</b>
              {r.title && <strong>{r.title}</strong>}
              <small>{r.snippet}</small>
            </span>
          </button>
        ))}
      </div>
      {query && !results.length && !error && (
        <p className="empty">{t("search_138")}</p>
      )}
      {cursor && (
        <button
          onClick={() =>
            void searchRepository
              .search(query, cursor)
              .then((r) => {
                setResults([...results, ...r.items]);
                setCursor(r.cursor);
              })
              .catch((e) => setError(e.message))
          }
        >
          {t("search_139")}
        </button>
      )}
    </main>
  );
}
