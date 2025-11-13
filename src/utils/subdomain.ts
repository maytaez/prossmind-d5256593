export const getSubdomain = () => {
  const host = window.location.host;
  const parts = host.split('.');
  if (parts.length > 2) {
    return parts[0];
  }
  return null;
};

export const navigateToBpmn = (newTab: boolean = false) => {
  const url = window.location.protocol + '//bpmn.' + window.location.host.split('.').slice(-2).join('.');
  if (newTab) {
    window.open(url, '_blank');
  } else {
    window.location.href = url;
  }
};

export const navigateToPid = (newTab: boolean = false) => {
  const url = window.location.protocol + '//pid.' + window.location.host.split('.').slice(-2).join('.');
  if (newTab) {
    window.open(url, '_blank');
  } else {
    window.location.href = url;
  }
};