/**
 * Shopify Storefront API client for Dozeage
 *
 * Env vars required (set in Netlify dashboard or .env.local):
 *   VITE_SHOPIFY_DOMAIN  = yourstore.myshopify.com
 *   VITE_SHOPIFY_TOKEN   = your-storefront-api-token   (public, read-only)
 *
 * To enable: flip VITE_USE_SHOPIFY=true in .env
 * While false, the app falls back to the local ALL[] mock catalog.
 */

const DOMAIN = import.meta.env.VITE_SHOPIFY_DOMAIN;
const TOKEN  = import.meta.env.VITE_SHOPIFY_TOKEN;
const USE    = import.meta.env.VITE_USE_SHOPIFY === "true";

const ENDPOINT = `https://${DOMAIN}/api/2024-10/graphql.json`;

async function gql(query, variables = {}) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Shopify API ${res.status}`);
  const { data, errors } = await res.json();
  if (errors?.length) throw new Error(errors[0].message);
  return data;
}

// ─── Product normaliser ──────────────────────────────────────────────────────
// Maps Shopify product shape → Dozeage ALL[] shape so the rest of the app
// doesn't need to change.
function normalise(node) {
  const variant  = node.variants.edges[0]?.node;
  const price    = parseFloat(variant?.price?.amount || 0);
  const mrp      = parseFloat(variant?.compareAtPrice?.amount || price);
  const imageUrl = node.images.edges[0]?.node?.url || null;

  // Shopify metafields used for Dozeage-specific fields
  // Set these up in Shopify: namespace "dozeage", keys below
  const meta = (key) =>
    node.metafields?.edges?.find((e) => e.node.key === key)?.node?.value;

  return {
    id:      parseInt(node.id.replace("gid://shopify/Product/", ""), 10),
    gid:     node.id,
    name:    node.title,
    brand:   node.vendor,
    cat:     node.productType || "All",
    dept:    meta("dept") || "skin",            // skin | hair | wellness
    concern: meta("concern") || "",             // acne | glow | hairfall …
    price:   Math.round(price),
    mrp:     Math.round(mrp),
    badge:   meta("badge") || "",               // BESTSELLER | DERM PICK …
    sold:    parseInt(meta("sold") || "0", 10),
    rating:  parseFloat(meta("rating") || "4.5"),
    reviews: parseInt(meta("reviews") || "0", 10),
    bg:      meta("bg") || "#F5F0E8",           // card background hex
    img:     imageUrl,                           // null until images added
    desc:    node.description || "",
    handle:  node.handle,
    stock:   variant?.quantityAvailable ?? 99,
    tags:    node.tags || [],
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch all products (auto-paginates up to 1000 products).
 * Uses cursor-based pagination in 250-product pages.
 */
export async function fetchAllProducts() {
  if (!USE) return null; // signal caller to use local mock

  const QUERY = `
    query Products($cursor: String) {
      products(first: 250, after: $cursor, sortKey: BEST_SELLING) {
        edges {
          cursor
          node {
            id handle title vendor productType description tags
            images(first: 1) { edges { node { url altText } } }
            variants(first: 1) {
              edges {
                node {
                  price { amount }
                  compareAtPrice { amount }
                  quantityAvailable
                }
              }
            }
            metafields(
              identifiers: [
                {namespace:"dozeage", key:"dept"},
                {namespace:"dozeage", key:"concern"},
                {namespace:"dozeage", key:"badge"},
                {namespace:"dozeage", key:"sold"},
                {namespace:"dozeage", key:"rating"},
                {namespace:"dozeage", key:"reviews"},
                {namespace:"dozeage", key:"bg"},
              ]
            ) { edges { node { key value } } }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  `;

  let products = [];
  let cursor   = null;
  let hasMore  = true;

  while (hasMore) {
    const data = await gql(QUERY, { cursor });
    const page = data.products;
    products = products.concat(page.edges.map((e) => normalise(e.node)));
    hasMore  = page.pageInfo.hasNextPage;
    cursor   = page.pageInfo.endCursor;
  }

  return products;
}

/**
 * Fetch a single product by Shopify GID or numeric ID.
 */
export async function fetchProduct(id) {
  if (!USE) return null;

  const gid = String(id).startsWith("gid://")
    ? id
    : `gid://shopify/Product/${id}`;

  const QUERY = `
    query Product($id: ID!) {
      product(id: $id) {
        id handle title vendor productType description tags
        images(first: 6) { edges { node { url altText } } }
        variants(first: 10) {
          edges {
            node {
              id title price { amount } compareAtPrice { amount }
              quantityAvailable selectedOptions { name value }
            }
          }
        }
        metafields(
          identifiers: [
            {namespace:"dozeage", key:"dept"},
            {namespace:"dozeage", key:"concern"},
            {namespace:"dozeage", key:"badge"},
            {namespace:"dozeage", key:"sold"},
            {namespace:"dozeage", key:"rating"},
            {namespace:"dozeage", key:"reviews"},
            {namespace:"dozeage", key:"bg"},
            {namespace:"dozeage", key:"ingredients"},
            {namespace:"dozeage", key:"how_to_use"},
          ]
        ) { edges { node { key value } } }
      }
    }
  `;

  const data = await gql(QUERY, { id: gid });
  return data.product ? normalise(data.product) : null;
}

/**
 * Search products by query string.
 */
export async function searchProducts(query) {
  if (!USE) return null;

  const QUERY = `
    query Search($query: String!) {
      products(first: 40, query: $query, sortKey: RELEVANCE) {
        edges { node {
          id handle title vendor productType
          images(first: 1) { edges { node { url } } }
          variants(first: 1) { edges { node { price { amount } compareAtPrice { amount } } } }
          metafields(identifiers: [
            {namespace:"dozeage", key:"badge"},
            {namespace:"dozeage", key:"rating"},
            {namespace:"dozeage", key:"bg"},
          ]) { edges { node { key value } } }
        }}
      }
    }
  `;

  const data = await gql(QUERY, { query });
  return data.products.edges.map((e) => normalise(e.node));
}

export const shopifyEnabled = USE;
