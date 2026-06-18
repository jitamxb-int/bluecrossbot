import { useState } from "react";
import { GoogleAuthScreen, AuthUser } from "@/components/livekit_bank/GoogleAuthScreen";

export const LivekitProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [authed, setAuthed] = useState(
    sessionStorage.getItem("authenticated") === "true"
  );

  if (!authed) {
    return (
      <GoogleAuthScreen
        onUnlock={() => setAuthed(true)}
      />
    );
  }

  return <>{children}</>;
};