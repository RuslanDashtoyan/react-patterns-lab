export type ShoppingCardActionType = "add" | "remove";

export interface IShoppingCartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  selectedQuantity?: number;
  handleQuantityChange?: (id: string, selectedQuantity: number) => void;
}
