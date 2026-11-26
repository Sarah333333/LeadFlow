// Starter content per trade so onboarding takes minutes, not an hour.
export const TRADES = [
  { id: "roofing", label: "Roofing", services: ["Roof repair", "Leak repair", "New roof", "Gutter cleaning & repair", "Chimney repair"] },
  { id: "plumbing", label: "Plumbing", services: ["Emergency call-out", "Leak repair", "Boiler service", "Bathroom installation", "Blocked drains"] },
  { id: "electrical", label: "Electrical", services: ["Fault finding", "Rewiring", "Fuse board upgrade", "EV charger installation", "Lighting installation"] },
  { id: "hvac", label: "Heating & HVAC", services: ["Boiler service", "Heat pump installation", "AC installation", "Heating repair", "Radiator installation"] },
  { id: "landscaping", label: "Landscaping", services: ["Garden maintenance", "Lawn care", "Patio & paving", "Hedge cutting", "Garden design"] },
  { id: "cleaning", label: "Cleaning", services: ["Regular home cleaning", "Deep clean", "End of tenancy clean", "Office cleaning", "Window cleaning"] },
  { id: "painting", label: "Painting & decorating", services: ["Interior painting", "Exterior painting", "Wallpapering", "Wood staining", "Commercial painting"] },
  { id: "home_services", label: "Other home service", services: [] },
] as const;

export const DEFAULT_FAQ_QUESTIONS = [
  "Do you offer free quotes?",
  "Are you fully insured?",
  "How soon can you come out?",
  "Do you offer a guarantee on your work?",
  "How can I pay?",
];

export const TIMEZONES = [
  "Europe/Dublin", "Europe/London", "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "America/Toronto", "Australia/Sydney",
];
export const CURRENCIES = ["EUR", "GBP", "USD", "CAD", "AUD"];

export const DEFAULT_HOURS = {
  mon: { open: "08:00", close: "18:00", closed: false }, tue: { open: "08:00", close: "18:00", closed: false },
  wed: { open: "08:00", close: "18:00", closed: false }, thu: { open: "08:00", close: "18:00", closed: false },
  fri: { open: "08:00", close: "18:00", closed: false }, sat: { open: "09:00", close: "13:00", closed: false },
  sun: { open: "09:00", close: "13:00", closed: true },
};
