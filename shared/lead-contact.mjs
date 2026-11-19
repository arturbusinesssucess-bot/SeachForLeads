const MAP_HOSTS = new Set(["google.com", "www.google.com", "maps.google.com", "maps.app.goo.gl"]);

function plainText(value, limit) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= limit && !/[\u0000-\u001f\u007f]/u.test(text) ? text : null;
}

function webURL(value) {
  const raw = plainText(value, 300);
  if (!raw) return null;
  const link = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+(?::\d+)?(?:[/#?]|$)/iu.test(raw) ? `https://${raw}` : raw;
  try {
    const url = new URL(link);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password && url.href.length <= 300 ? url : null;
  } catch { return null; }
}

export function dialLeadPhone(value) {
  const phone = plainText(value, 30);
  if (!phone || !/^\+?[\d(). -]+$/u.test(phone)) return null;
  const digits = phone.replace(/\D/gu, "");
  if (digits.length < 8 || digits.length > 15) return null;
  if (phone.startsWith("+") || /^55\d{10,11}$/u.test(digits)) return `+${digits}`;
  return digits.length === 10 || digits.length === 11 ? `+55${digits}` : null;
}

export function readLeadContact(lead) {
  const details = {};
  const address = plainText(lead.address, 300);
  const source = plainText(lead.source, 60);
  const phone = plainText(lead.phone, 30);
  const website = webURL(lead.website);
  const map = webURL(lead.mapsUrl);
  if (address) details.address = address;
  if (source) details.source = source;
  if (dialLeadPhone(phone)) details.phone = phone;
  if (website) details.website = website.href;
  if (map && MAP_HOSTS.has(map.hostname) && (map.hostname.startsWith("maps.") || map.pathname.startsWith("/maps"))) details.mapsUrl = map.href;
  if (typeof lead.websiteChecked === "boolean") details.websiteChecked = lead.websiteChecked;
  if (typeof lead.rating === "number" && lead.rating >= 0 && lead.rating <= 5) details.rating = lead.rating;
  if (Number.isInteger(lead.reviewCount) && lead.reviewCount >= 0 && lead.reviewCount <= 100000000) details.reviewCount = lead.reviewCount;
  return details;
}

export function leadMapURL(lead, contact) {
  if (contact.mapsUrl) return contact.mapsUrl;
  if (!lead.id.startsWith("vps:") && !contact.address) return null;
  const query = new URLSearchParams({ api: "1", query: `${lead.company}, ${contact.address || lead.location}` });
  return `https://www.google.com/maps/search/?${query}`;
}
