import { BrowserRouter, Routes, Route } from "react-router-dom";
import BlueCrossAdminPage from "./pages/BlueCrossAdminPage";
import BlueCrossStaticPage from "./pages/BlueCrossStaticPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <BlueCrossAdminPage
              authUser={null}
              onSignOut={() => {}}
            />
          }
        />

        <Route
          path="/blue_cross"
          element={
            <BlueCrossAdminPage
              authUser={null}
              onSignOut={() => {}}
            />
          }
        />

        <Route
          path="/blue_cross/chat"
          element={
            <BlueCrossStaticPage
              authUser={null}
              onSignOut={() => {}}
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}