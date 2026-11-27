export function contactRingPath(rate) {
  if (!Number.isFinite(rate) || rate <= 0) return "";

  const radius = 44;
  const start = "99 55";
  if (rate >= 100) {
    return `M ${start} A ${radius} ${radius} 0 1 1 11 55 A ${radius} ${radius} 0 1 1 ${start}`;
  }

  const angle = rate / 100 * 2 * Math.PI;
  const capAngle = Math.asin(4.5 / radius);
  const point = (at) => `${(55 + radius * Math.cos(at)).toFixed(3)} ${(55 + radius * Math.sin(at)).toFixed(3)}`;
  if (angle <= capAngle * 2) {
    const center = point(angle / 2);
    return `M ${center} L ${center}`;
  }

  const sweep = angle - capAngle * 2;
  return `M ${point(capAngle)} A ${radius} ${radius} 0 ${sweep > Math.PI ? 1 : 0} 1 ${point(angle - capAngle)}`;
}
