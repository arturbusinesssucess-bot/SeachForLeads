const MAP_HOSTS = new Set(["google.com", "www.google.com", "maps.google.com", "maps.app.goo.gl"]);
const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com", "m.instagram.com"]);
const INSTAGRAM_NON_PROFILES = new Set(["about", "accounts", "direct", "explore", "p", "reel", "reels", "stories", "tv"]);

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

function whatsappNumber(value) {
  const direct = dialLeadPhone(value);
  if (direct) return /^\+[1-9]\d{7,14}$/u.test(direct) ? direct : null;
  const url = webURL(value);
  if (!url || url.protocol !== "https:" || url.port) return null;
  const digits = url.hostname === "wa.me" ? url.pathname.slice(1).replace(/\/$/u, "")
    : url.hostname === "api.whatsapp.com" && url.pathname === "/send" ? url.searchParams.get("phone")
    : null;
  return digits && /^[1-9]\d{7,14}$/u.test(digits) ? `+${digits}` : null;
}

function instagramProfile(value) {
  const raw = plainText(value, 300);
  if (!raw) return null;
  let handle = raw.replace(/^@/u, "");
  if (raw.includes("/")) {
    const url = webURL(raw);
    if (!url || !INSTAGRAM_HOSTS.has(url.hostname) || url.port) return null;
    handle = url.pathname.slice(1).replace(/\/$/u, "");
  }
  return /^[a-z0-9_.]{1,30}$/iu.test(handle) && /[a-z0-9_]/iu.test(handle)
    && !INSTAGRAM_NON_PROFILES.has(handle.toLowerCase())
    ? `https://www.instagram.com/${handle}/` : null;
}

export function readLeadContact(lead) {
  const details = {};
  const address = plainText(lead.address, 300);
  const source = plainText(lead.source, 60);
  const phone = plainText(lead.phone, 30);
  const website = webURL(lead.website);
  const map = webURL(lead.mapsUrl);
  const whatsapp = whatsappNumber(lead.whatsapp === true ? lead.phone : lead.whatsapp)
    ?? whatsappNumber(lead.whatsappPhone) ?? whatsappNumber(lead.whatsappUrl);
  const instagram = instagramProfile(lead.instagram) ?? instagramProfile(lead.instagramUrl);
  if (address) details.address = address;
  if (source) details.source = source;
  if (dialLeadPhone(phone)) details.phone = phone;
  if (website) details.website = website.href;
  if (map && MAP_HOSTS.has(map.hostname) && (map.hostname.startsWith("maps.") || map.pathname.startsWith("/maps"))) details.mapsUrl = map.href;
  if (whatsapp) details.whatsapp = whatsapp;
  if (instagram) details.instagram = instagram;
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
