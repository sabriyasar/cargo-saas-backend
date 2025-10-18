// backend/services/shopifyService.js
const axios = require('axios');

async function getShopifyOrdersFromAPI(status = 'open', limit = 20) {
  try {
    const shopDomain = process.env.SHOPIFY_SHOP; // Örn: 'myshop.myshopify.com'
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

    if (!shopDomain || !accessToken) {
      throw new Error('SHOPIFY_SHOP veya SHOPIFY_ACCESS_TOKEN tanımlı değil.');
    }

    const response = await axios.get(
      `https://${shopDomain}/admin/api/2025-10/orders.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        params: {
          status,
          limit
        }
      }
    );

    // Shopify'tan gelen veriyi sadeleştirme
    return response.data.orders.map(order => ({
      id: order.id,
      name: order.name,
      total_price: order.total_price,
      currency: order.currency,
      order_status_url: order.order_status_url,
      line_items: order.line_items?.map(item => ({
        title: item.title,
        quantity: item.quantity
      })),
      customer: {
        name: order.customer
          ? `${order.customer.first_name} ${order.customer.last_name}`
          : 'Anonim',
        email: order.customer?.email || '-'
      },
      created_at: order.created_at
    }));
  } catch (error) {
    console.error('❌ Shopify siparişleri alınamadı:', error.response?.data || error.message);
    throw new Error('Shopify siparişleri alınamadı.');
  }
}

module.exports = { getShopifyOrdersFromAPI };
