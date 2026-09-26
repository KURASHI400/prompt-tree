import { DeletionProvider } from "./Deletion";
import { t } from "./i18n/ja";
import { lazy, Suspense } from "react";
import {
  NavLink,
  Route,
  Routes,
  useLocation,
  type Location,
} from "react-router-dom";
import { APP_NAME } from "./config";
import Home from "./Home";
const Search = lazy(() => import("./Search")),
  Settings = lazy(() => import("./Settings"));
const Gallery = lazy(() => import("./Gallery"));
const Tree = lazy(() => import("./Tree")),
  TreePicker = lazy(() =>
    import("./Tree").then((m) => ({ default: m.TreePicker })),
  );
const Editor = lazy(() => import("./Editor")),
  Detail = lazy(() => import("./Detail"));
export default function App() {
  const location = useLocation();
  const background = (location.state as { background?: Location } | null)
    ?.background;
  return (
    <DeletionProvider>
      <div className="app">
        <header>
          <h1>{APP_NAME}</h1>
          <button
            aria-label={t("app_002")}
            onClick={() => window.dispatchEvent(new Event("app-lock"))}
          >
            ⌑
          </button>
        </header>
        <Suspense fallback={<p>{t("app_003")}</p>}>
          <Routes location={background ?? location}>
            <Route path="/search" element={<Search />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/images" element={<Gallery />} />
            <Route path="/tree" element={<TreePicker />} />
            <Route path="/series/:seriesId/tree" element={<Tree />} />
            <Route path="/home" element={<Home />} />
            <Route path="/cards/:id" element={<Detail />} />
            <Route path="/new" element={<Editor />} />
            <Route path="*" element={<Home />} />
          </Routes>
          {background && (
            <Routes>
              <Route path="/cards/:id" element={<Detail />} />
              <Route path="/new" element={<Editor />} />
            </Routes>
          )}
        </Suspense>
        <nav>
          {[
            ["/home", t("app_004")],
            ["/tree", t("app_005")],
            ["/images", t("app_006")],
            ["/search", t("app_007")],
            ["/settings", t("app_008")],
          ].map(([to, label]) => (
            <NavLink key={to} to={to}>
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </DeletionProvider>
  );
}
