export type CartProductRules = {
  name: string;
  allowMultipleUnits?: boolean;
  allowNonMembers?: boolean;
};

export function cartAddBlockReason(
  product: CartProductRules,
  addQuantity: number,
  alreadyInCart: number,
  isMember: boolean,
): string | null {
  if (product.allowNonMembers === false && !isMember) {
    return `${product.name} is available to members only.`;
  }
  if (product.allowMultipleUnits === false && alreadyInCart + addQuantity > 1) {
    return `${product.name} can only be added once.`;
  }
  return null;
}
