import { BrowserRouter, Routes, Route } from "react-router";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";
import HomePage from "@/pages/home";
import PlayersPage from "@/pages/players";
import GamesListPage from "@/pages/games-list";
import NewGamePage from "@/pages/new-game";
import GameDetailPage from "@/pages/game-detail";

function NotFound() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 w-full">
      <h1 className="text-2xl font-semibold">Not found</h1>
    </div>
  );
}

export default function App() {
  return (
    <>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="players" element={<PlayersPage />} />
            <Route path="games" element={<GamesListPage />} />
            <Route path="games/new" element={<NewGamePage />} />
            <Route path="games/:id" element={<GameDetailPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </>
  );
}
