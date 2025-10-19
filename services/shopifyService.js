const axios = require('axios');
const { ShopModel } = require('../models/Shop');

/**
 * shop: myshop.myshopify.com gibi domain
 * status: open, closed, any
 * limit: çekilecek sipariş sayısı
 */
async function getShopifyOrdersFromAPI(shop, status = 'open', limit = 20) {
  try {
    // MongoDB'den token'ı al
    const shopData = await ShopModel.findOne({ shop });
    if (!shopData || !shopData.accessToken) {
      throw new Error(`Token bulunamadı veya mağaza kaydı yok: ${shop}`);
    }

    const response = await axios.get(
      `https://${shop}/admin/api/2025-10/orders.json`,
      {
        headers: {
          'X-Shopify-Access-Token': shopData.accessToken,
          'Content-Type': 'application/json'
        },
        params: { status, limit }
      }
    );

    // Gelen veriyi sadeleştir
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
