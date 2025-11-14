export const getSubdomain = () => {
  const host = window.location.host;
  const parts = host.split('.');
  if (parts.length > 2) {
    return parts[0];
  }
  return null;
};