import { useCallback, useEffect, useState } from "react";
import type { IShoppingCartItem } from "~/types";
import { shoppingCardsList } from "~/shared";
import { ShoppingCardItem } from "~/pages/shopping-card/modules/shopping-card-item";

export const ShoppingCard = () => {
  const [cardsList, setCardsList] = useState<IShoppingCartItem[]>([]);

  const handleQuantityChange = useCallback(
    (id: string, selectedQuantity: number) => {
      setCardsList((prev) =>
        prev.map((card) =>
          card.id === id ? { ...card, selectedQuantity } : card,
        ),
      );
    },
    [],
  );

  useEffect(() => {
    const updatedList = shoppingCardsList.map((item) => ({
      ...item,
      selectedQuantity: 0,
    }));
    setCardsList(updatedList);
  }, []);

  return (
    <div className=" l flex flex-wrap gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs">
      {cardsList.map((card) => {
        return (
          <ShoppingCardItem
            key={card.id}
            handleQuantityChange={handleQuantityChange}
            {...card}
          />
        );
      })}
    </div>
  );
};
