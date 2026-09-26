import { t } from "./i18n/ja";
import { useEffect, useRef, useState } from "react";
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
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    const refresh = () => {
      generation.current++;
      setRevision((value) => value + 1);
    };
    window.addEventListener("data-changed", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("data-changed", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => {
    let alive = true;
    const request = ++generation.current;
    const timer = setTimeout(() => {
      sessionStorage.setItem("search-query", query);
      void searchRepository
        .search(query)
        .then((r) => {
          if (alive && request === generation.current) {
            setResults(r.items);
            setCursor(r.cursor);
            setError("");
          }
        })
        .catch((e) => {
          if (alive && request === generation.current) setError(e.message);
        });
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, revision]);
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
          onClick={() => {
            const request = generation.current;
            void searchRepository
              .search(query, cursor)
              .then((r) => {
                if (request !== generation.current) return;
                setResults([...results, ...r.items]);
                setCursor(r.cursor);
              })
              .catch((e) => {
                if (request === generation.current) setError(e.message);
              });
          }}
        >
          {t("search_139")}
        </button>
      )}
    </main>
  );
}
