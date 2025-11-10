export interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  images: string[];
  description: string;
  category: string;
  tags?: string[];
  inventory?: number | null;
  featured?: boolean;
  variants?: any[];
}
