const axios = require('axios');
const { ShopModel } = require('../models/Shop');

async function getShopifyOrdersFromAPI(shop, status = 'open', limit = 20, accessTokenFromDB) {
  try {
    if (!shop) {
      throw new Error('Shop parametresi gerekli.');
    }

    // 🔹 Eğer token frontend’den gelmediyse MongoDB’den al
    let accessToken = accessTokenFromDB;
    if (!accessToken) {
      const shopRecord = await ShopModel.findOne({ shop });
      if (!shopRecord) {
        throw new Error('Mağaza bulunamadı veya token alınmamış.');
      }
      accessToken = shopRecord.accessToken;
    }

    const response = await axios.get(
      `https://${shop}/admin/api/2025-10/orders.json`,
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
          : '',
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
