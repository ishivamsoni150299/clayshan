-- Optional seed data for local dev
insert into public.products (name, slug, price, currency, images, description, category, tags)
values
('Kundan Statement Necklace','kundan-statement-necklace',12999,'INR',ARRAY['/assets/products/kundan-necklace-1.jpg','/assets/placeholder.svg'],'A modern take on classic Kundan work with subtle gold tones.','Necklaces',ARRAY['kundan','gold','statement']),
('Pearl Drop Earrings','pearl-drop-earrings',4999,'INR',ARRAY['/assets/products/pearl-earrings-1.jpg','/assets/placeholder.svg'],'Delicate freshwater pearls with gold-plated finish for everyday elegance.','Earrings',ARRAY['pearls','minimal']),
('Temple Coin Bracelet','temple-coin-bracelet',6999,'INR',ARRAY['/assets/products/coin-bracelet-1.jpg','/assets/placeholder.svg'],'Inspired by traditional motifs with a clean, modern profile.','Bracelets',ARRAY['temple','coin']),
('Gemstone Stack Ring','gemstone-stack-ring',3499,'INR',ARRAY['/assets/products/stack-ring-1.jpg','/assets/placeholder.svg'],'Stackable ring with a pop of color and polished finish.','Rings',ARRAY['gemstone','stackable'])
on conflict (slug) do nothing;

