import {
  BriefcaseBusiness,
  Code2,
  Dumbbell,
  Folder,
  GraduationCap,
  HeartPulse,
  House,
  Inbox,
  Lightbulb,
  Plane,
  ShoppingCart,
  Wallet,
} from "lucide-react";

export const LIST_ICON_COMPONENTS = {
  inbox: Inbox,
  folder: Folder,
  dumbbell: Dumbbell,
  briefcase: BriefcaseBusiness,
  graduationCap: GraduationCap,
  shoppingCart: ShoppingCart,
  plane: Plane,
  wallet: Wallet,
  heartPulse: HeartPulse,
  house: House,
  code: Code2,
  lightbulb: Lightbulb,
};

export const LIST_ICON_OPTIONS = [
  { value: "folder", label: "General" },
  { value: "dumbbell", label: "Fitness" },
  { value: "briefcase", label: "Work" },
  { value: "graduationCap", label: "Study" },
  { value: "shoppingCart", label: "Shopping" },
  { value: "plane", label: "Travel" },
  { value: "wallet", label: "Finance" },
  { value: "heartPulse", label: "Health" },
  { value: "house", label: "Home" },
  { value: "code", label: "Code" },
  { value: "lightbulb", label: "Ideas" },
];

const ICON_RULES = [
  {
    icon: "dumbbell",
    keywords: [
      "gym",
      "workout",
      "fitness",
      "exercise",
      "training",
      "ورزش",
      "باشگاه",
    ],
  },
  {
    icon: "briefcase",
    keywords: ["work", "job", "office", "career", "business", "کار", "شغل"],
  },
  {
    icon: "graduationCap",
    keywords: [
      "study",
      "school",
      "course",
      "learning",
      "lesson",
      "دانشگاه",
      "درس",
      "مطالعه",
    ],
  },
  {
    icon: "shoppingCart",
    keywords: ["shopping", "shop", "grocery", "خرید"],
  },
  {
    icon: "plane",
    keywords: ["travel", "trip", "vacation", "holiday", "سفر"],
  },
  {
    icon: "wallet",
    keywords: ["finance", "money", "budget", "expense", "مالی", "پول"],
  },
  {
    icon: "heartPulse",
    keywords: ["health", "medical", "doctor", "سلامت"],
  },
  {
    icon: "house",
    keywords: ["home", "house", "family", "خانه"],
  },
  {
    icon: "code",
    keywords: [
      "code",
      "coding",
      "programming",
      "developer",
      "development",
      "برنامه",
      "کدنویسی",
    ],
  },
  {
    icon: "lightbulb",
    keywords: ["idea", "ideas", "project", "ایده"],
  },
];

export function getSuggestedListIcon(name) {
  const tokens = name
    .toLowerCase()
    .trim()
    .split(/[^a-z0-9\u0600-\u06ff]+/)
    .filter(Boolean);

  for (const rule of ICON_RULES) {
    const matched = rule.keywords.some((keyword) =>
      tokens.includes(keyword.toLowerCase()),
    );

    if (matched) {
      return rule.icon;
    }
  }

  return "folder";
}
