import { Auth, ParticleBackground } from "@prossmind/shared/components";
import { useNavigate } from "react-router-dom";
import { useReducedMotion } from "@prossmind/shared/context";
import prossmindLogo from "@/assets/prossmind-logo-transparent.png";

const Login = () => {
  const navigate = useNavigate();
  const appUrl = import.meta.env.VITE_APP_URL || "http://localhost:8081";

  const handleSuccess = () => {
    navigate("/dashboard", { replace: true });
  };

  return (
    <Auth
      logoUrl={prossmindLogo}
      redirectUrl={appUrl}
      homeUrl="/dashboard"
      ParticleBackgroundComponent={ParticleBackground}
      useReducedMotion={useReducedMotion}
      onSuccess={handleSuccess}
    />
  );
};

export default Login;
