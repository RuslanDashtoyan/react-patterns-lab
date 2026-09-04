import type { IAppRoutes } from "~/types";

export const appRoutes: IAppRoutes[] = [
  {
    path: "",
    label: "Layout",
    file: "routes/layout.tsx",
    layout: true,
    routes: [
      { path: "", label: "Home", file: "routes/home/index.tsx" },
      { path: "input", label: "Input", file: "routes/input/index.tsx" },
      { path: "shop", label: "Shop", file: "routes/shopping/index.tsx" },
    ],
  },
];

export const shoppingCardsList = [
  { id: "item_01", name: "Mechanical Keyboard", price: 2, quantity: 4 },
  { id: "item_02", name: "Wireless Mouse", price: 10, quantity: 3 },
  { id: "item_03", name: "USB-C Hub", price: 10, quantity: 5 },
  { id: "item_04", name: '27 4K Monitor', price: 20, quantity: 12 },
  { id: "item_05", name: "Laptop Stand", price: 5, quantity: 3 },
  { id: "item_06", name: "Noise", price: 5, quantity: 1 },
  { id: "item_07", name: "Webcam 1080p", price: 10, quantity: 1 },
  { id: "item_08", name: "Desk Mat", price: 50, quantity: 2 },
  { id: "item_09", name: "Cable Organizer Set", price: 100, quantity: 4 },
  { id: "item_10", name: "Ergonomic Chair", price: 45, quantity: 1 },
];
