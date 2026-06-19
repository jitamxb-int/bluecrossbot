import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  selectProducts,
  selectProductsStatus,
  selectProductsError,
  selectLastProductIngest,
} from '../features/selectors/productsSelectors';

export function useProducts() {
  const dispatch   = useAppDispatch();
  const items      = useAppSelector(selectProducts);
  const status     = useAppSelector(selectProductsStatus);
  const error      = useAppSelector(selectProductsError);
  const lastIngest = useAppSelector(selectLastProductIngest);

  return { items, status, error, lastIngest, dispatch };
}
