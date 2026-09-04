import type { IShoppingCartItem, ShoppingCardActionType } from "~/types";
import { cn } from "~/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDebounce } from "~/hooks";
import { Card, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";

const btnClass =
  "border-2 border-orange-300 p-0 size-8 rounded-full cursor-pointer [&:hover]:bg-orange-300 [&:hover]:text-white";

export const ShoppingCardItem = ({
  id,
  name,
  price,
  quantity,
  selectedQuantity,
  handleQuantityChange,
}: IShoppingCartItem) => {
  const [localSelectedQuantity, setLocalSelectedQuantity] = useState(
    selectedQuantity ?? 0,
  );
  const debouncedSelectedQuantity = useDebounce(localSelectedQuantity, 500);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    handleQuantityChange?.(id, debouncedSelectedQuantity);
  }, [debouncedSelectedQuantity]);

  const handleChange = useCallback(
    (action: ShoppingCardActionType) => {
      setLocalSelectedQuantity((prev) => {
        const next = action === "add" ? prev + 1 : prev - 1;
        return Math.min(Math.max(next, 0), quantity);
      });
    },
    [quantity],
  );

  return (
    <Card className="flex xs:w-full xsm:w-[calc(50%-8px)] md:w-[calc(33.3%-10.5px)]">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl truncate">
          {name}
        </CardTitle>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="line-clamp-1 flex gap-2 font-medium">
          Price: {price}$
        </div>
        <div className="text-muted-foreground">
          <div className="flex flex-nowrap gap-2 w-full">
            Quantity: {quantity - localSelectedQuantity}
          </div>
        </div>
        <div className="flex flex-nowrap justify-between items-center w-full  mt-auto pt-3">
          In Card:
          <div className="flex items-center gap-2">
            <button className={btnClass} onClick={() => handleChange("remove")}>
              -
            </button>
            <div
              className={cn("size-4 text-center", {
                "text-green-500": localSelectedQuantity,
              })}
            >
              {localSelectedQuantity}
            </div>
            <button className={btnClass} onClick={() => handleChange("add")}>
              +
            </button>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
};
