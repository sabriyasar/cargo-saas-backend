const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

async function getShopifyOrdersFromAPI(shop, status = 'open', limit = 20) {
  try {
    const accessToken = process.env.ADMIN_API_TOKEN;
    const store = process.env.SHOPIFY_STORE;

    if (!accessToken || !store) {
      throw new Error('ADMIN_API_TOKEN veya SHOPIFY_STORE tanımlı değil.');
    }

    if (shop !== store) {
      throw new Error(`Shop uyuşmuyor: Beklenen ${store}, gelen ${shop}`);
    }

    const response = await axios.get(
      `https://${store}/admin/api/2025-10/orders.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        params: { status, limit },
      }
    );

    return response.data.orders.map(order => ({
      id: order.id,
      name: order.name,
      total_price: order.total_price,
      currency: order.currency,
      order_status_url: order.order_status_url,
      line_items: order.line_items?.map(item => ({
        title: item.title,
        quantity: item.quantity,
      })),
      customer: {
        name: order.customer
          ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()
          : '', // artık Anonim yok, boş string
        email: order.customer?.email || '',
        phone: order.shipping_address?.phone || order.customer?.phone || '',
        cityName: order.shipping_address?.city || '',
        districtName: order.shipping_address?.province || '',
        address: order.shipping_address?.address1 || '',
      },      
      created_at: order.created_at,
    }));

  } catch (error) {
    console.error('❌ Shopify siparişleri alınamadı:', error.response?.data || error.message);
    throw new Error('Shopify siparişleri alınamadı.');
  }
}

module.exports = { getShopifyOrdersFromAPI };
