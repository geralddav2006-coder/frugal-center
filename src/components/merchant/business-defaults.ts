export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export interface BusinessFormValue {
  name: string;
  category_slug: string;
  description: string;
  address_line: string;
  city: string;
  state: string;
  zip: string;
  lat: number | null;
  lng: number | null;
  phone: string;
  website: string;
  contact_email: string;
  hours: Record<string, { open: string; close: string } | null>;
  logo_url: string | null;
  cover_url: string | null;
}

export const EMPTY_BUSINESS: BusinessFormValue = {
  name: "", category_slug: "", description: "", address_line: "", city: "Dracut", state: "MA", zip: "01826",
  lat: null, lng: null, phone: "", website: "", contact_email: "",
  hours: Object.fromEntries(DAY_KEYS.map((d) => [d, d === "sun" ? null : { open: "09:00", close: "18:00" }])),
  logo_url: null, cover_url: null,
};
