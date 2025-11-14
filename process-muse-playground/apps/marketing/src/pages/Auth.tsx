import { Auth, ParticleBackground } from "@prossmind/shared/components";
import prossmindLogo from "@/assets/prossmind-logo-transparent.png";
import { useReducedMotion } from "@prossmind/shared/context";

const AuthPage = () => {
  const prefersReducedMotion = useReducedMotion();
  const appUrl = import.meta.env.VITE_APP_URL || "http://localhost:8080";

  return (
    <Auth
      logoUrl={prossmindLogo}
      redirectUrl={appUrl}
      homeUrl="/"
      ParticleBackgroundComponent={ParticleBackground}
      useReducedMotion={useReducedMotion}
    />
  );
};

export default AuthPage;
