Clayshan Assets Guide (Images)

Goals
- Consistent, crisp product visuals across devices
- Small payloads with modern formats (WebP) and clean fallbacks

Recommended specs
- PDP (main gallery): square 1200Ã—1200 (or larger), optimized JPG + WebP pair
- Product card grid: square 600Ã—600 (served via responsive sizes)
- Category tiles: 800Ã—600 (4:3)

File naming
- Use lowercase, hyphenated slugs matching product slug when possible
  - Example: pearl-drop-earrings.jpg and pearl-drop-earrings.webp
- Keep pairs together (jpg/png + webp). Our UI auto-picks WebP when available.

Where to store
- Supabase Storage (bucket: product-images)
  - Path convention: products/YYYY/MM/<uuid-or-slug>.<ext>
  - Make bucket "public" so the UI can read images without signed URLs.
  - Ensure correct Content-Type on upload (image/webp, image/jpeg, image/png, image/svg+xml).

How UI resolves images
- Product cards and PDP wrap images in <picture> with a conditional WebP <source>.
  - If you provide my-image.webp next to my-image.jpg, browsers that support WebP will use it; others fall back to JPG/PNG.
  - SVGs are used for placeholders and will bypass WebP logic.

Angular sizes used
- Product cards: sizes="(max-width: 700px) 50vw, (max-width: 480px) 100vw, 25vw"
- PDP main image: sizes="(max-width: 900px) 100vw, 50vw"

Updating products
- When creating/editing products, set images to an array of public URLs. Put the WebP next to JPG/PNG with identical names.
- Example images array:
  [
    "https://<project>.supabase.co/storage/v1/object/public/product-images/products/2025/10/pearl-drop-earrings.jpg",
    "https://<project>.supabase.co/storage/v1/object/public/product-images/products/2025/10/pearl-drop-earrings-alt.jpg"
  ]

Quality tips
- Use high-quality source, then compress:
  - JPG: 75–82 quality (visually lossless)
  - WebP: 70â€“80 quality
- Remove EXIF/metadata to reduce size.

Accessibility
- Provide descriptive alt text (e.g., "Pearl drop earrings in gold-plated setting").


## Local WebP generation + upload
- Install optional tool: 
pm i -D sharp (skip on CI).
- Ensure env set: SUPABASE_URL, SUPABASE_SERVICE_ROLE, SUPABASE_STORAGE_BUCKET (default product-images).
- Run: 
pm run images:gen-upload (scans public/assets/products, uploads originals and .webp to bucket).
- Options: 
ode scripts/generate-webp-upload.mjs --dir ./path/to/images --prefix products/2025/10/ --bucket product-images.
