type SlugOptions = {
  fallback?: string;
  maxLength?: number;
};

export function slugify(value: string, { fallback = "item", maxLength = 170 }: SlugOptions = {}) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}
